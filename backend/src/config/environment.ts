import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/staff_ops_db?schema=public'),
  SESSION_SECRET: z.string().default('phase1-dev-session-secret-change-in-production-min-32-chars'),
  APP_URL: z.string().default('http://localhost:3000'),
  GEMINI_API_KEY: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const config = {
  env: parsedEnv.data.NODE_ENV,
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isTest: parsedEnv.data.NODE_ENV === 'test',
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  sessionSecret: parsedEnv.data.SESSION_SECRET,
  appUrl: parsedEnv.data.APP_URL,
  geminiApiKey: parsedEnv.data.GEMINI_API_KEY,
  version: '1.0.0-release',
};

/**
 * Validates operational readiness and flags insecure production configurations.
 */
export function validateProductionConfig(): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (config.isProduction) {
    if (config.sessionSecret.includes('phase1-dev-session-secret')) {
      issues.push('CRITICAL: Default developmental SESSION_SECRET in production environment.');
    }
    if (config.sessionSecret.length < 32) {
      issues.push('CRITICAL: SESSION_SECRET must be at least 32 characters in production.');
    }
    if (!config.databaseUrl || config.databaseUrl.includes('localhost:5432/staff_ops_db')) {
      issues.push('WARNING: Production DATABASE_URL appears to use local development connection string.');
    }
  }
  return { isValid: issues.length === 0, issues };
}
