import { api } from './api';

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
    credentialsAvailable: boolean;
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

export const settingsApi = {
  async getSettings(): Promise<SystemSettingsPayload> {
    const res = await api.get('/settings');
    return res.data.data;
  },

  async updateSettings(
    category: 'general' | 'monitoring' | 'notifications' | 'performanceWeights' | 'aiFoundation',
    payload: Record<string, any>
  ): Promise<SystemSettingsPayload> {
    const res = await api.put('/settings', { category, payload });
    return res.data.data;
  },
};
