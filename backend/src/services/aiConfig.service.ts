import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { settingsService } from './settings.service';

export interface AiHealthStatus {
  aiEnabled: boolean;
  configurationStatus: 'CONFIGURED' | 'CREDENTIALS_MISSING' | 'DISABLED';
  configuredModel: string;
  credentialsAvailable: boolean;
  lastSuccessfulRequest: string | null;
  lastErrorCategory: string | null;
}

export class AiConfigService {
  private lastSuccess: Date | null = null;
  private lastError: string | null = null;

  /**
   * Retrieves the Gemini API Key from secure environment variables.
   * NEVER exposed to the frontend, never stored in plaintext settings.
   */
  getApiKey(): string {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  /**
   * Returns true if a Gemini API key is configured in the environment.
   */
  hasApiKey(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Retrieves current AI settings from the database (Phase 9 settings service).
   */
  async getAiSettings() {
    const allSettings = await settingsService.getAllSettings();
    return allSettings.aiFoundation;
  }

  /**
   * Returns whether AI operations are enabled and properly configured.
   */
  async isAiOperational(): Promise<{ operational: boolean; reason?: string }> {
    const settings = await this.getAiSettings();
    if (!settings.aiEnabled) {
      return { operational: false, reason: 'AI operations intelligence layer is currently disabled in system settings.' };
    }
    if (!this.hasApiKey()) {
      return { operational: false, reason: 'Gemini API credentials are not configured in the server environment.' };
    }
    return { operational: true };
  }

  /**
   * Returns the configured Gemini model name.
   */
  async getConfiguredModel(): Promise<string> {
    const settings = await this.getAiSettings();
    return settings.aiModel || 'gemini-3.7-flash';
  }

  /**
   * Returns the maximum output tokens.
   */
  async getMaxTokens(): Promise<number> {
    const settings = await this.getAiSettings();
    return settings.maxTokens || 2048;
  }

  /**
   * Records a successful AI interaction.
   */
  recordSuccess() {
    this.lastSuccess = new Date();
    this.lastError = null;
  }

  /**
   * Records an AI error category.
   */
  recordError(category: string) {
    this.lastError = category;
  }

  /**
   * Returns a safe, sanitised health/status report for ADMIN users.
   * Strict security: Does NOT expose keys, secrets, or internal connection strings.
   */
  async getHealthStatus(): Promise<AiHealthStatus> {
    const settings = await this.getAiSettings();
    const hasKey = this.hasApiKey();

    let configurationStatus: 'CONFIGURED' | 'CREDENTIALS_MISSING' | 'DISABLED' = 'CONFIGURED';
    if (!settings.aiEnabled) {
      configurationStatus = 'DISABLED';
    } else if (!hasKey) {
      configurationStatus = 'CREDENTIALS_MISSING';
    }

    return {
      aiEnabled: settings.aiEnabled,
      configurationStatus,
      configuredModel: settings.aiModel || 'gemini-3.7-flash',
      credentialsAvailable: hasKey,
      lastSuccessfulRequest: this.lastSuccess ? this.lastSuccess.toISOString() : null,
      lastErrorCategory: this.lastError,
    };
  }
}

export const aiConfigService = new AiConfigService();
