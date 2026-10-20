import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface OperationalConfig {
  classMonitoringGracePeriodMinutes: number;
  taskDueSoonThresholdHours: number;
  attendanceAnalysisPeriodDays: number;
  attendanceMinDataDays: number;
  attendanceExceptionThreshold: number;
  workloadMaxWeeklyHours: number;
  workloadMaxClassesPerDay: number;
  notificationCooldownMinutes: number;
}

export const DEFAULT_CONFIG: OperationalConfig = {
  classMonitoringGracePeriodMinutes: 10,
  taskDueSoonThresholdHours: 24,
  attendanceAnalysisPeriodDays: 30,
  attendanceMinDataDays: 10,
  attendanceExceptionThreshold: 4,
  workloadMaxWeeklyHours: 24,
  workloadMaxClassesPerDay: 5,
  notificationCooldownMinutes: 60,
};

const KEY_MAPPING: Record<keyof OperationalConfig, string> = {
  classMonitoringGracePeriodMinutes: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES',
  taskDueSoonThresholdHours: 'TASK_DUE_SOON_THRESHOLD_HOURS',
  attendanceAnalysisPeriodDays: 'ATTENDANCE_ANALYSIS_PERIOD_DAYS',
  attendanceMinDataDays: 'ATTENDANCE_MIN_DATA_DAYS',
  attendanceExceptionThreshold: 'ATTENDANCE_EXCEPTION_THRESHOLD',
  workloadMaxWeeklyHours: 'WORKLOAD_MAX_WEEKLY_HOURS',
  workloadMaxClassesPerDay: 'WORKLOAD_MAX_CLASSES_PER_DAY',
  notificationCooldownMinutes: 'NOTIFICATION_COOLDOWN_MINUTES',
};

export class ConfigService {
  /**
   * Retrieves all operational configurations with fallback defaults.
   */
  async getAllOperationalConfigs(): Promise<OperationalConfig> {
    try {
      const keys = Object.values(KEY_MAPPING);
      const settings = await prisma.setting.findMany({
        where: { key: { in: keys } },
      });

      const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

      const result: OperationalConfig = { ...DEFAULT_CONFIG };

      for (const [prop, key] of Object.entries(KEY_MAPPING) as [keyof OperationalConfig, string][]) {
        const val = settingsMap.get(key);
        if (val !== undefined && val !== null && val !== '') {
          const parsed = Number(val);
          if (!isNaN(parsed) && parsed >= 0) {
            result[prop] = parsed;
          }
        }
      }

      return result;
    } catch (error) {
      logger.warn('Failed to load operational settings from DB, using defaults', 'CONFIG_WARNING');
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Retrieves a single numeric config setting with default fallback.
   */
  async getConfigValue<K extends keyof OperationalConfig>(
    key: K,
    defaultValue: number = DEFAULT_CONFIG[key]
  ): Promise<number> {
    try {
      const dbKey = KEY_MAPPING[key];
      const setting = await prisma.setting.findUnique({
        where: { key: dbKey },
      });

      if (setting && setting.value) {
        const parsed = Number(setting.value);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback on error
    }
    return defaultValue;
  }

  /**
   * Updates an operational configuration setting.
   */
  async updateOperationalConfig(
    key: keyof OperationalConfig,
    value: number,
    userId?: string
  ): Promise<number> {
    const dbKey = KEY_MAPPING[key];
    await prisma.setting.upsert({
      where: { key: dbKey },
      update: {
        value: String(value),
        updated_by: userId || null,
      },
      create: {
        key: dbKey,
        value: String(value),
        data_type: 'NUMBER',
        updated_by: userId || null,
      },
    });
    return value;
  }

  /**
   * Batch updates multiple operational configuration values.
   */
  async updateMany(
    configs: Partial<OperationalConfig>,
    userId?: string
  ): Promise<OperationalConfig> {
    for (const [prop, val] of Object.entries(configs) as [keyof OperationalConfig, number][]) {
      if (val !== undefined && val !== null && !isNaN(val) && val >= 0) {
        await this.updateOperationalConfig(prop, val, userId);
      }
    }
    return this.getAllOperationalConfigs();
  }
}

export const configService = new ConfigService();
