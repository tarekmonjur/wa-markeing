import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().default('wa-media'),
  MINIO_USE_SSL: Joi.boolean().default(false),
  SESSION_FILES_PATH: Joi.string().default('./sessions'),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  OPENAI_API_KEY: Joi.string().optional().allow(''),
  OLLAMA_URL: Joi.string().default('http://ollama:11434'),
  OLLAMA_MODEL: Joi.string().default('llama3.2:3b'),
  SESSION_MANAGER_URL: Joi.string().default('http://session-manager:3002'),
});
