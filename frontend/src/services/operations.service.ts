import {
  ActivityEntity,
  ExpectedClassInfo,
  CurrentActivityResponse,
  AttendanceEntity,
  ClassMonitoringAlertEntity,
  InstitutionalCoverageResponse,
  ActivityStatus,
  AttendanceStatus,
  OperationalAlertEntity,
  OperationalAlertSummary,
  OperationalAlertType,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  ScheduledJobRuntimeState,
  ScheduledJobRunEntity,
  OperationalConfig,
  TimetableConflictItem,
} from '../types/operations';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: { message: string; code: string };
}

class OperationsService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; meta?: any; message?: string }> {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    let resJson: any;
    try {
      resJson = await response.json();
    } catch {
      throw new Error(`Server returned ${response.status} non-JSON response`);
    }

    if (!response.ok || !resJson.success) {
      const errorMsg =
        resJson.error?.message ||
        resJson.message ||
        `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return {
      data: resJson.data as T,
      meta: resJson.meta,
      message: resJson.message,
    };
  }

  // ==========================================
  // CURRENT WORK & ACTIVITY
  // ==========================================

  async getCurrentActivity(): Promise<CurrentActivityResponse> {
    const res = await this.request<CurrentActivityResponse>('/api/activity/current');
    return res.data;
  }

  async logActivity(payload: {
    activity_status: ActivityStatus;
    description?: string;
    notes?: string;
    duration_minutes?: number;
    timetable_id?: string | null;
    class_id?: string | null;
    subject_id?: string | null;
    room?: string | null;
    start_time?: string;
    expected_end_time?: string;
  }): Promise<ActivityEntity> {
    const res = await this.request<ActivityEntity>('/api/activity', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async updateActivity(
    id: string,
    payload: {
      activity_status?: ActivityStatus;
      description?: string;
      notes?: string;
      room?: string | null;
      actual_end_time?: string | null;
      expected_end_time?: string | null;
    }
  ): Promise<ActivityEntity> {
    const res = await this.request<ActivityEntity>(`/api/activity/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async getActivities(params?: {
    staffId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ activities: ActivityEntity[]; meta?: any }> {
    const query = new URLSearchParams();
    if (params?.staffId) query.set('staffId', params.staffId);
    if (params?.status) query.set('status', params.status);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const res = await this.request<ActivityEntity[]>(
      `/api/activity${query.toString() ? `?${query.toString()}` : ''}`
    );
    return { activities: res.data, meta: res.meta };
  }

  // ==========================================
  // TIMETABLE & EXPECTED CLASS & COVERAGE
  // ==========================================

  async getCurrentExpectedClass(staffId?: string): Promise<ExpectedClassInfo> {
    const query = staffId ? `?staffId=${encodeURIComponent(staffId)}` : '';
    const res = await this.request<ExpectedClassInfo>(`/api/timetable/current-class${query}`);
    return res.data;
  }

  async getClassCoverage(departmentId?: string): Promise<InstitutionalCoverageResponse> {
    const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    const res = await this.request<InstitutionalCoverageResponse>(`/api/timetable/coverage${query}`);
    return res.data;
  }

  // ==========================================
  // ATTENDANCE
  // ==========================================

  async getAttendance(params?: {
    staffId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ records: AttendanceEntity[]; meta?: any }> {
    const query = new URLSearchParams();
    if (params?.staffId) query.set('staffId', params.staffId);
    if (params?.date) query.set('date', params.date);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const res = await this.request<AttendanceEntity[]>(
      `/api/attendance${query.toString() ? `?${query.toString()}` : ''}`
    );
    return { records: res.data, meta: res.meta };
  }

  async markAttendance(payload: {
    staff_id?: string;
    attendance_date?: string;
    status: AttendanceStatus;
    remarks?: string;
  }): Promise<AttendanceEntity> {
    const res = await this.request<AttendanceEntity>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async updateAttendance(
    id: string,
    payload: {
      status?: AttendanceStatus;
      remarks?: string;
    }
  ): Promise<AttendanceEntity> {
    const res = await this.request<AttendanceEntity>(`/api/attendance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  // ==========================================
  // OPERATIONAL MONITORING ALERTS
  // ==========================================

  async getMonitoringAlerts(params?: {
    staffId?: string;
    status?: string;
    date?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ alerts: ClassMonitoringAlertEntity[]; meta?: any }> {
    const query = new URLSearchParams();
    if (params?.staffId) query.set('staffId', params.staffId);
    if (params?.status) query.set('status', params.status);
    if (params?.date) query.set('date', params.date);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const res = await this.request<ClassMonitoringAlertEntity[]>(
      `/api/monitoring/alerts${query.toString() ? `?${query.toString()}` : ''}`
    );
    return { alerts: res.data, meta: res.meta };
  }

  async updateMonitoringAlert(
    id: string,
    status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'
  ): Promise<ClassMonitoringAlertEntity> {
    const res = await this.request<ClassMonitoringAlertEntity>(`/api/monitoring/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return res.data;
  }

  async getGracePeriod(): Promise<{ gracePeriodMinutes: number; description: string }> {
    const res = await this.request<{ gracePeriodMinutes: number; description: string }>(
      '/api/monitoring/grace-period'
    );
    return res.data;
  }

  async updateGracePeriod(minutes: number): Promise<{ gracePeriodMinutes: number }> {
    const res = await this.request<{ gracePeriodMinutes: number }>(
      '/api/monitoring/grace-period',
      {
        method: 'PATCH',
        body: JSON.stringify({ gracePeriodMinutes: minutes }),
      }
    );
    return res.data;
  }

  // ==========================================
  // PHASE 7: OPERATIONAL ALERTS & INTELLIGENCE
  // ==========================================

  async getOperationalAlerts(params?: {
    alertType?: OperationalAlertType;
    severity?: OperationalAlertSeverity;
    status?: OperationalAlertStatus;
    staffId?: string;
    departmentId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ alerts: OperationalAlertEntity[]; meta?: any }> {
    const query = new URLSearchParams();
    if (params?.alertType) query.set('alertType', params.alertType);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.status) query.set('status', params.status);
    if (params?.staffId) query.set('staffId', params.staffId);
    if (params?.departmentId) query.set('departmentId', params.departmentId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const res = await this.request<{ alerts: OperationalAlertEntity[]; meta: any }>(
      `/api/operations/alerts${query.toString() ? `?${query.toString()}` : ''}`
    );
    return res.data;
  }

  async getOperationalAlertSummary(): Promise<OperationalAlertSummary> {
    const res = await this.request<OperationalAlertSummary>('/api/operations/alerts/summary');
    return res.data;
  }

  async acknowledgeOperationalAlert(id: string, remarks?: string): Promise<OperationalAlertEntity> {
    const res = await this.request<OperationalAlertEntity>(`/api/operations/alerts/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    return res.data;
  }

  async resolveOperationalAlert(id: string, resolutionNotes: string): Promise<OperationalAlertEntity> {
    const res = await this.request<OperationalAlertEntity>(`/api/operations/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNotes }),
    });
    return res.data;
  }

  async dismissOperationalAlert(id: string, reason: string): Promise<OperationalAlertEntity> {
    const res = await this.request<OperationalAlertEntity>(`/api/operations/alerts/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }

  // ==========================================
  // PHASE 7: SCHEDULED JOBS & EXECUTION
  // ==========================================

  async getScheduledJobs(): Promise<{ jobs: ScheduledJobRuntimeState[]; serverTime: string }> {
    const res = await this.request<{ jobs: ScheduledJobRuntimeState[]; serverTime: string }>(
      '/api/operations/jobs'
    );
    return res.data;
  }

  async getJobHistory(params?: { limit?: number; jobName?: string }): Promise<ScheduledJobRunEntity[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.jobName) query.set('jobName', params.jobName);

    const res = await this.request<ScheduledJobRunEntity[]>(
      `/api/operations/jobs/history${query.toString() ? `?${query.toString()}` : ''}`
    );
    return res.data;
  }

  async triggerJobRun(jobName: string): Promise<{ success: boolean; durationMs: number; error?: string }> {
    const res = await this.request<{ success: boolean; durationMs: number; error?: string }>(
      `/api/operations/jobs/${encodeURIComponent(jobName)}/run`,
      { method: 'POST' }
    );
    return res.data;
  }

  // ==========================================
  // PHASE 7: OPERATIONAL CONFIGURATION
  // ==========================================

  async getOperationalConfigs(): Promise<OperationalConfig> {
    const res = await this.request<OperationalConfig>('/api/operations/config');
    return res.data;
  }

  async updateOperationalConfigs(configs: Partial<OperationalConfig>): Promise<OperationalConfig> {
    const res = await this.request<OperationalConfig>('/api/operations/config', {
      method: 'PUT',
      body: JSON.stringify(configs),
    });
    return res.data;
  }

  // ==========================================
  // PHASE 7: TIMETABLE CONFLICTS
  // ==========================================

  async getTimetableConflicts(): Promise<{ conflicts: TimetableConflictItem[]; evaluation: any }> {
    const res = await this.request<{ conflicts: TimetableConflictItem[]; evaluation: any }>(
      '/api/operations/conflicts'
    );
    return res.data;
  }
}

export const operationsService = new OperationsService();
