import { checkDatabaseHealth } from '../../config/database';
import { config } from '../../config/environment';

export interface HealthCheckData {
  status: string;
  database: {
    status: 'connected' | 'disconnected';
    latencyMs?: number;
    error?: string;
  };
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}

export class SystemService {
  async getHealth(): Promise<HealthCheckData> {
    const dbHealth = await checkDatabaseHealth();

    return {
      status: 'ok',
      database: {
        status: dbHealth.connected ? 'connected' : 'disconnected',
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      },
      version: config.version,
      environment: config.env,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  getSystemInfo() {
    return {
      appName: 'AI STAFF OPERATIONS INTELLIGENCE PLATFORM',
      phase: 'Phase 12 - Final Integration & Production Release',
      version: config.version,
      environment: config.env,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };
  }
}

export const systemService = new SystemService();
