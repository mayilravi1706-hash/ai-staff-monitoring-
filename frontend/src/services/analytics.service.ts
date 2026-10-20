export interface PerformanceWeights {
  attendanceWeight: number;
  taskCompletionWeight: number;
  onTimeCompletionWeight: number;
  classCompletionWeight: number;
  operationalActivityWeight: number;
}

export interface AdminOverviewAnalytics {
  totalStaff: number;
  presentStaff: number;
  absentStaff: number;
  halfDayStaff: number;
  staffOnApprovedLeave: number;
  currentlyTeaching: number;
  scheduledClassesToday: number;
  completedClassesToday: number;
  classCoveragePercentage: number | null;
  tasks: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  openOperationalAlerts: number;
  departmentsSummary: Array<{
    id: string;
    name: string;
    code: string;
    staffCount: number;
    classCount: number;
    subjectCount: number;
  }>;
  timestamp: string;
}

export interface AdminWorkloadAnalytics {
  totalEvaluated: number;
  averageWorkloadScore: number | null;
  statusDistribution: Record<string, number>;
  aggregateTotals: {
    totalTeachingHours: number;
    totalActiveTasks: number;
    totalOverdueTasks: number;
    totalAdminActivities: number;
  };
  departmentSummary: Array<{
    departmentId: string;
    departmentName: string;
    averageScore: number;
    staffEvaluated: number;
  }>;
  recentMetrics: Array<{
    id: string;
    staffId: string;
    staffName: string;
    departmentName?: string;
    teachingHours: number;
    activeTasks: number;
    overdueTasks: number;
    workloadScore: number | null;
    workloadStatus: string;
    workloadTrend: string;
    periodStart: string;
  }>;
}

export interface AdminPerformanceAnalytics {
  totalEvaluated: number;
  averageScores: {
    overall: number;
    attendance: number;
    taskCompletion: number;
    onTimeCompletion: number;
    classCompletion: number;
  } | null;
  scoreDistribution: Record<string, number>;
  configuredWeights: PerformanceWeights;
  recentRecords: Array<{
    id: string;
    staffId: string;
    staffName: string;
    departmentName?: string;
    overallScore: number | null;
    attendanceScore: number | null;
    taskCompletionScore: number | null;
    onTimeCompletionScore: number | null;
    classCompletionScore: number | null;
    operationalActivityScore: number | null;
    dataCompleteness: string;
    periodStart: string;
  }>;
}

export interface AdminAttendanceAnalytics {
  periodDays: number;
  totalRecords: number;
  timeline: Array<{
    date: string;
    present: number;
    absent: number;
    halfDay: number;
    leave: number;
    total: number;
    attendanceRate: number;
  }>;
}

export interface AdminTasksAnalytics {
  totalTasks: number;
  completionRate: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface StaffOverviewAnalytics {
  staff: {
    id: string;
    staffId: string;
    fullName: string;
    designation: string;
    departmentName?: string;
  };
  todayAttendance: string;
  todayActivitiesCount: number;
  tasksSummary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  currentWorkload: any;
  currentPerformance: any;
  activeOperationalAlerts: any[];
  timestamp: string;
}

class AnalyticsApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      throw new Error(resJson.error?.message || resJson.message || `Request failed with status ${response.status}`);
    }

    return resJson.data as T;
  }

  // ==========================================
  // ADMIN ANALYTICS
  // ==========================================

  async getAdminOverview(departmentId?: string): Promise<AdminOverviewAnalytics> {
    const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return await this.request<AdminOverviewAnalytics>(`/api/analytics/admin/overview${q}`);
  }

  async getAdminWorkload(departmentId?: string): Promise<AdminWorkloadAnalytics> {
    const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return await this.request<AdminWorkloadAnalytics>(`/api/analytics/admin/workload${q}`);
  }

  async getAdminPerformance(departmentId?: string): Promise<AdminPerformanceAnalytics> {
    const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return await this.request<AdminPerformanceAnalytics>(`/api/analytics/admin/performance${q}`);
  }

  async getAdminAttendance(departmentId?: string): Promise<AdminAttendanceAnalytics> {
    const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return await this.request<AdminAttendanceAnalytics>(`/api/analytics/admin/attendance${q}`);
  }

  async getAdminTasks(departmentId?: string): Promise<AdminTasksAnalytics> {
    const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return await this.request<AdminTasksAnalytics>(`/api/analytics/admin/tasks${q}`);
  }

  // ==========================================
  // STAFF ANALYTICS
  // ==========================================

  async getStaffOverview(staffId?: string): Promise<StaffOverviewAnalytics> {
    const q = staffId ? `?staffId=${encodeURIComponent(staffId)}` : '';
    return await this.request<StaffOverviewAnalytics>(`/api/analytics/staff/overview${q}`);
  }

  async getStaffWorkload(staffId?: string): Promise<{ current: any; history: any[] }> {
    const q = staffId ? `?staffId=${encodeURIComponent(staffId)}` : '';
    return await this.request<{ current: any; history: any[] }>(`/api/analytics/staff/workload${q}`);
  }

  async getStaffPerformance(staffId?: string): Promise<{ current: any; history: any[]; weights: PerformanceWeights }> {
    const q = staffId ? `?staffId=${encodeURIComponent(staffId)}` : '';
    return await this.request<{ current: any; history: any[]; weights: PerformanceWeights }>(
      `/api/analytics/staff/performance${q}`
    );
  }

  async getStaffAttendance(staffId?: string): Promise<any> {
    const q = staffId ? `?staffId=${encodeURIComponent(staffId)}` : '';
    return await this.request<any>(`/api/analytics/staff/attendance${q}`);
  }

  async getStaffTasks(staffId?: string): Promise<any> {
    const q = staffId ? `?staffId=${encodeURIComponent(staffId)}` : '';
    return await this.request<any>(`/api/analytics/staff/tasks${q}`);
  }

  // ==========================================
  // PERFORMANCE WEIGHTS
  // ==========================================

  async getPerformanceWeights(): Promise<PerformanceWeights> {
    return await this.request<PerformanceWeights>('/api/performance/weights');
  }

  async updatePerformanceWeights(weights: Partial<PerformanceWeights>): Promise<PerformanceWeights> {
    return await this.request<PerformanceWeights>('/api/performance/weights', {
      method: 'PUT',
      body: JSON.stringify(weights),
    });
  }
}

export const analyticsApi = new AnalyticsApiService();
