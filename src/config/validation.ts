import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  // Solana
  SOLANA_RPC_URL: Joi.string().uri().default('https://api.devnet.solana.com'),
  SOLANA_NETWORK: Joi.string()
    .valid('mainnet-beta', 'devnet', 'testnet')
    .default('devnet'),
  SOLANA_PROGRAM_ID: Joi.string(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // API
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('v1'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
});
