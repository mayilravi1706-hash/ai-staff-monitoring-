import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createAuditLog } from '../modules/audit/audit.service';
import { configService } from './config.service';
import { performanceService } from './performance.service';
import { jobScheduler } from './scheduler.service';

export interface SystemSettingsPayload {
  general: {
    appName: string;
    maintenanceMode: boolean;
    allowSelfRegistration: boolean;
  };
  monitoring: {
    classMonitoringGracePeriodMinutes: number;
    taskDueSoonThresholdHours: number;
    workloadWarningThreshold: number;
  };
  notifications: {
    notificationCooldownMinutes: number;
    emailNotificationsEnabled: boolean;
    overdueTaskAlertsEnabled: boolean;
    monitoringAlertsEnabled: boolean;
  };
  performanceWeights: {
    attendanceWeight: number;
    taskCompletionWeight: number;
    onTimeCompletionWeight: number;
    classCompletionWeight: number;
    operationalActivityWeight: number;
  };
  aiFoundation: {
    aiEnabled: boolean;
    aiModel: string;
    maxTokens: number;
    scheduleIntervalMinutes: number;
    aiAlertsEnabled: boolean;
    evidenceRequired: boolean;
    credentialsAvailable: boolean; // Computed safely
  };
  systemInfo: {
    appName: string;
    version: string;
    environment: string;
    dbStatus: string;
    backendUptimeSeconds: number;
    activeAcademicYear: string;
    schedulerStatus: string;
    registeredJobsCount: number;
    lastHealthCheck: string;
  };
}

export class SettingsService {
  /**
   * Retrieves all categorized system settings and computed system info safely.
   */
  async getAllSettings(): Promise<SystemSettingsPayload> {
    const keys = [
      'APP_NAME',
      'MAINTENANCE_MODE',
      'ALLOW_SELF_REGISTRATION',
      'EMAIL_NOTIFICATIONS_ENABLED',
      'OVERDUE_TASK_ALERTS_ENABLED',
      'MONITORING_ALERTS_ENABLED',
      'AI_ENABLED',
      'AI_MODEL',
      'AI_MAX_TOKENS',
      'AI_SCHEDULE_INTERVAL_MINUTES',
      'AI_ALERTS_ENABLED',
      'AI_EVIDENCE_REQUIRED',
    ];

    const settingsRows = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });

    const map = new Map(settingsRows.map((s) => [s.key, s.value]));

    const opConfig = await configService.getAllOperationalConfigs();
    const perfWeights = await performanceService.getPerformanceWeights();

    const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });

    // Check Gemini API Key presence in env safely without exposing it
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

    const schedulerStatuses = jobScheduler.getJobStatuses();

    return {
      general: {
        appName: map.get('APP_NAME') || 'AI Staff Operations Intelligence Platform',
        maintenanceMode: map.get('MAINTENANCE_MODE') === 'true',
        allowSelfRegistration: map.get('ALLOW_SELF_REGISTRATION') === 'true',
      },
      monitoring: {
        classMonitoringGracePeriodMinutes: opConfig.classMonitoringGracePeriodMinutes,
        taskDueSoonThresholdHours: opConfig.taskDueSoonThresholdHours,
        workloadWarningThreshold: opConfig.workloadMaxWeeklyHours,
      },
      notifications: {
        notificationCooldownMinutes: opConfig.notificationCooldownMinutes,
        emailNotificationsEnabled: map.get('EMAIL_NOTIFICATIONS_ENABLED') !== 'false',
        overdueTaskAlertsEnabled: map.get('OVERDUE_TASK_ALERTS_ENABLED') !== 'false',
        monitoringAlertsEnabled: map.get('MONITORING_ALERTS_ENABLED') !== 'false',
      },
      performanceWeights: perfWeights,
      aiFoundation: {
        aiEnabled: map.get('AI_ENABLED') === 'true',
        aiModel: map.get('AI_MODEL') || 'gemini-3.7-flash',
        maxTokens: Number(map.get('AI_MAX_TOKENS')) || 2048,
        scheduleIntervalMinutes: Number(map.get('AI_SCHEDULE_INTERVAL_MINUTES')) || 15,
        aiAlertsEnabled: map.get('AI_ALERTS_ENABLED') !== 'false',
        evidenceRequired: map.get('AI_EVIDENCE_REQUIRED') !== 'false',
        credentialsAvailable: hasGeminiKey,
      },
      systemInfo: {
        appName: 'AI Staff Operations Intelligence Platform',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        dbStatus: 'HEALTHY',
        backendUptimeSeconds: Math.floor(process.uptime()),
        activeAcademicYear: activeYear ? activeYear.name : 'None Active',
        schedulerStatus: jobScheduler.isSchedulerStarted() ? 'RUNNING' : 'STOPPED',
        registeredJobsCount: schedulerStatuses.length,
        lastHealthCheck: new Date().toISOString(),
      },
    };
  }

  /**
   * Updates categorized system settings transactional and creates audit log entries.
   */
  async updateSettings(
    category: 'general' | 'monitoring' | 'notifications' | 'performanceWeights' | 'aiFoundation',
    payload: Record<string, any>,
    userId: string
  ): Promise<SystemSettingsPayload> {
    const current = await this.getAllSettings();

    if (category === 'general') {
      if (payload.appName) {
        await this.setSettingKey('APP_NAME', String(payload.appName), userId);
      }
      if (payload.maintenanceMode !== undefined) {
        await this.setSettingKey('MAINTENANCE_MODE', String(payload.maintenanceMode), userId);
      }
      if (payload.allowSelfRegistration !== undefined) {
        await this.setSettingKey('ALLOW_SELF_REGISTRATION', String(payload.allowSelfRegistration), userId);
      }
    } else if (category === 'monitoring') {
      if (typeof payload.classMonitoringGracePeriodMinutes === 'number') {
        await configService.updateOperationalConfig('classMonitoringGracePeriodMinutes', payload.classMonitoringGracePeriodMinutes, userId);
      }
      if (typeof payload.taskDueSoonThresholdHours === 'number') {
        await configService.updateOperationalConfig('taskDueSoonThresholdHours', payload.taskDueSoonThresholdHours, userId);
      }
      if (typeof payload.workloadWarningThreshold === 'number') {
        await configService.updateOperationalConfig('workloadMaxWeeklyHours', payload.workloadWarningThreshold, userId);
      }
    } else if (category === 'notifications') {
      if (typeof payload.notificationCooldownMinutes === 'number') {
        await configService.updateOperationalConfig('notificationCooldownMinutes', payload.notificationCooldownMinutes, userId);
      }
      if (payload.emailNotificationsEnabled !== undefined) {
        await this.setSettingKey('EMAIL_NOTIFICATIONS_ENABLED', String(payload.emailNotificationsEnabled), userId);
      }
      if (payload.overdueTaskAlertsEnabled !== undefined) {
        await this.setSettingKey('OVERDUE_TASK_ALERTS_ENABLED', String(payload.overdueTaskAlertsEnabled), userId);
      }
      if (payload.monitoringAlertsEnabled !== undefined) {
        await this.setSettingKey('MONITORING_ALERTS_ENABLED', String(payload.monitoringAlertsEnabled), userId);
      }
    } else if (category === 'performanceWeights') {
      // Strictly validated to sum to 100% inside performanceService
      await performanceService.updatePerformanceWeights(payload, userId);
    } else if (category === 'aiFoundation') {
      if (payload.aiEnabled !== undefined) {
        await this.setSettingKey('AI_ENABLED', String(payload.aiEnabled), userId);
      }
      if (payload.aiModel) {
        await this.setSettingKey('AI_MODEL', String(payload.aiModel), userId);
      }
      if (typeof payload.maxTokens === 'number') {
        await this.setSettingKey('AI_MAX_TOKENS', String(payload.maxTokens), userId);
      }
      if (typeof payload.scheduleIntervalMinutes === 'number') {
        await this.setSettingKey('AI_SCHEDULE_INTERVAL_MINUTES', String(payload.scheduleIntervalMinutes), userId);
      }
      if (payload.aiAlertsEnabled !== undefined) {
        await this.setSettingKey('AI_ALERTS_ENABLED', String(payload.aiAlertsEnabled), userId);
      }
      if (payload.evidenceRequired !== undefined) {
        await this.setSettingKey('AI_EVIDENCE_REQUIRED', String(payload.evidenceRequired), userId);
      }
    }

    await createAuditLog({
      userId,
      action: category === 'performanceWeights' ? 'PERFORMANCE_WEIGHT_CHANGED' : category === 'aiFoundation' ? 'AI_CONFIGURATION_CHANGED' : 'SETTING_CHANGED',
      entityType: 'SETTING',
      entityId: category,
      beforeValue: current[category],
      afterValue: payload,
    });

    return this.getAllSettings();
  }

  private async setSettingKey(key: string, value: string, userId: string) {
    await prisma.setting.upsert({
      where: { key },
      update: { value, updated_by: userId },
      create: { key, value, updated_by: userId },
    });
  }
}

export const settingsService = new SettingsService();
