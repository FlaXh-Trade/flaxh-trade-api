import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private connection: Connection;
  private readonly network: string;
  private readonly programId?: PublicKey;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('solana.rpcUrl');
    if (!rpcUrl) {
      throw new Error('Solana RPC URL is required');
    }

    const commitment = this.configService.get<string>(
      'solana.commitment',
    ) as any;

    const network = this.configService.get<string>('solana.network');
    if (!network) {
      throw new Error('Solana network is required');
    }
    this.network = network;

    this.connection = new Connection(rpcUrl, commitment);

    const programIdStr = this.configService.get<string>('solana.programId');
    if (programIdStr) {
      this.programId = new PublicKey(programIdStr);
    }

    this.logger.log(`Connected to Solana ${this.network} network`);
  }

  getConnection(): Connection {
    return this.connection;
  }

  getNetwork(): string {
    return this.network;
  }

  getProgramId(): PublicKey | undefined {
    return this.programId;
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error(
        `Failed to get balance for ${publicKey.toString()}`,
        error,
      );
      throw error;
    }
  }

  async getTokenBalance(
    walletAddress: PublicKey,
    mintAddress: PublicKey,
  ): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        walletAddress,
      );
      const tokenBalance =
        await this.connection.getTokenAccountBalance(tokenAccount);
      return tokenBalance.value.uiAmount || 0;
    } catch (error) {
      this.logger.error(`Failed to get token balance`, error);
      return 0;
    }
  }

  async getTransactionHistory(publicKey: PublicKey, limit = 10) {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit },
      );
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          return {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            transaction: tx,
          };
        }),
      );
      return transactions;
    } catch (error) {
      this.logger.error(
        `Failed to get transaction history for ${publicKey.toString()}`,
        error,
      );
      throw error;
    }
  }

  async sendTransaction(
    transaction: Transaction,
    signers: Keypair[],
  ): Promise<string> {
    try {
      const signature = await this.connection.sendTransaction(
        transaction,
        signers,
      );
      await this.connection.confirmTransaction(signature);
      this.logger.log(`Transaction sent successfully: ${signature}`);
      return signature;
    } catch (error) {
      this.logger.error('Failed to send transaction', error);
      throw error;
    }
  }

  async createAssociatedTokenAccount(
    payer: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
  ): Promise<PublicKey> {
    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mint,
        owner,
      );

      // const transaction = new Transaction().add(
      //   createAssociatedTokenAccountInstruction(
      //     payer,
      //     associatedTokenAddress,
      //     owner,
      //     mint,
      //     TOKEN_PROGRAM_ID,
      //   ),
      // );

      return associatedTokenAddress;
    } catch (error) {
      this.logger.error('Failed to create associated token account', error);
      throw error;
    }
  }

  validatePublicKey(publicKeyString: string): boolean {
    try {
      new PublicKey(publicKeyString);
      return true;
    } catch {
      return false;
    }
  }

  async getLatestBlockhash() {
    return await this.connection.getLatestBlockhash();
  }

  async simulateTransaction(transaction: Transaction) {
    return await this.connection.simulateTransaction(transaction);
  }
}
