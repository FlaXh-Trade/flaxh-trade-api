import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { CreateWalletDto } from '../dtos/create-wallet.dto';
import { SolanaService } from '../../../infra/solana/solana.service';
import { PublicKey } from '@solana/web3.js';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly solanaService: SolanaService,
  ) {}

  async create(
    userId: string,
    createWalletDto: CreateWalletDto,
  ): Promise<Wallet> {
    // Validate Solana address
    if (!this.solanaService.validatePublicKey(createWalletDto.address)) {
      throw new BadRequestException('Invalid Solana wallet address');
    }

    // Check if wallet already exists for this user
    const existingWallet = await this.walletRepository.findOne({
      where: { address: createWalletDto.address, userId },
    });

    if (existingWallet) {
      throw new ConflictException('Wallet already exists for this user');
    }

    const wallet = this.walletRepository.create({
      ...createWalletDto,
      userId,
    });

    const savedWallet = await this.walletRepository.save(wallet);

    // Update balance from blockchain
    await this.updateBalance(savedWallet.id);

    return savedWallet;
  }

  async findByUserId(userId: string): Promise<Wallet[]> {
    return await this.walletRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async findByAddress(address: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { address },
      relations: ['user'],
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async updateBalance(walletId: string): Promise<Wallet> {
    const wallet = await this.findById(walletId);

    try {
      const publicKey = new PublicKey(wallet.address);
      const balance = await this.solanaService.getBalance(publicKey);

      await this.walletRepository.update(walletId, { balance });

      return await this.findById(walletId);
    } catch {
      throw new BadRequestException('Failed to update wallet balance');
    }
  }

  async getTokenBalance(
    walletId: string,
    mintAddress: string,
  ): Promise<number> {
    const wallet = await this.findById(walletId);

    try {
      const walletPublicKey = new PublicKey(wallet.address);
      const mintPublicKey = new PublicKey(mintAddress);

      return await this.solanaService.getTokenBalance(
        walletPublicKey,
        mintPublicKey,
      );
    } catch {
      throw new BadRequestException('Failed to get token balance');
    }
  }

  async getTransactionHistory(walletId: string, limit = 10) {
    const wallet = await this.findById(walletId);

    try {
      const publicKey = new PublicKey(wallet.address);
      return await this.solanaService.getTransactionHistory(publicKey, limit);
    } catch {
      throw new BadRequestException('Failed to get transaction history');
    }
  }

  async update(id: string, updateData: Partial<Wallet>): Promise<Wallet> {
    const wallet = await this.findById(id);

    if (updateData.address && updateData.address !== wallet.address) {
      if (!this.solanaService.validatePublicKey(updateData.address)) {
        throw new BadRequestException('Invalid Solana wallet address');
      }

      const existingWallet = await this.walletRepository.findOne({
        where: { address: updateData.address, userId: wallet.userId },
      });

      if (existingWallet && existingWallet.id !== id) {
        throw new ConflictException(
          'Wallet address already exists for this user',
        );
      }
    }

    await this.walletRepository.update(id, updateData);
    return await this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const wallet = await this.findById(id);
    await this.walletRepository.remove(wallet);
  }

  async verifyWallet(walletId: string): Promise<Wallet> {
    return await this.update(walletId, { isVerified: true });
  }

  async deactivateWallet(walletId: string): Promise<Wallet> {
    return await this.update(walletId, { isActive: false });
  }

  async activateWallet(walletId: string): Promise<Wallet> {
    return await this.update(walletId, { isActive: true });
  }
}
