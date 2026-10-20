export type ActivityStatus =
  | 'TEACHING'
  | 'MEETING'
  | 'PREPARING_CLASS'
  | 'ADMINISTRATIVE_WORK'
  | 'AVAILABLE'
  | 'BREAK'
  | 'LEAVE';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'LEAVE'
  | 'PERMISSION';

export type ClassCoverageStatus = 'COVERED' | 'NOT_RECORDED' | 'NOT_SCHEDULED';

export interface ActivityEntity {
  id: string;
  staff_id: string;
  timetable_id?: string | null;
  activity_status: ActivityStatus;
  description: string | null;
  class_id?: string | null;
  subject_id?: string | null;
  room?: string | null;
  start_time: string;
  expected_end_time?: string | null;
  actual_end_time?: string | null;
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    staff_id: string;
    full_name: string;
    designation: string;
  };
  class?: {
    id: string;
    name: string;
    section?: string | null;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  timetable?: {
    id: string;
    start_time: string;
    end_time: string;
    room?: string | null;
  };
}

export interface ExpectedClassInfo {
  hasCurrentClass: boolean;
  currentClass: {
    timetableId: string;
    classId: string;
    className: string;
    section?: string | null;
    departmentId?: string;
    departmentName?: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    status: 'EXPECTED';
    timeStatus: 'CURRENT' | 'UPCOMING' | 'COMPLETED' | 'NO_CLASS';
  } | null;
  upcomingClass: {
    timetableId: string;
    classId: string;
    className: string;
    section?: string | null;
    departmentName?: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    timeStatus: 'UPCOMING';
  } | null;
  todaySchedule: Array<{
    timetableId: string;
    class: {
      id: string;
      name: string;
      section?: string | null;
    };
    subject: {
      id: string;
      name: string;
      code: string;
    };
    room?: string | null;
    startTime: string;
    endTime: string;
    timeStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    coverage: ClassCoverageStatus;
    recordedActivity?: {
      id: string;
      status: string;
      startTime: string;
      endTime?: string | null;
      description?: string | null;
    } | null;
  }>;
  serverTime: {
    iso: string;
    timeStr: string;
    dayOfWeek: number;
    dayName: string;
    dateStr: string;
  };
}

export interface AttendanceEntity {
  id: string;
  staff_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  remarks?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    staff_id: string;
    full_name: string;
    designation: string;
    department?: {
      name: string;
      code: string;
    };
  };
}

export interface ClassMonitoringAlertEntity {
  id: string;
  staff_id: string;
  timetable_id: string;
  class_id: string;
  subject_id: string;
  alert_date: string;
  expected_start_time: string;
  expected_end_time: string;
  rule_name: string;
  title: string;
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  resolved_at?: string | null;
  staff?: {
    id: string;
    staff_id: string;
    full_name: string;
    designation: string;
    email?: string;
  };
  class?: {
    id: string;
    name: string;
    section?: string | null;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  timetable?: {
    id: string;
    room?: string | null;
    start_time: string;
    end_time: string;
  };
}

export interface CurrentActivityResponse {
  hasActiveActivity: boolean;
  activity: ActivityEntity | null;
  expectedClass: ExpectedClassInfo['currentClass'];
  upcomingClass: ExpectedClassInfo['upcomingClass'];
  todaySchedule: ExpectedClassInfo['todaySchedule'];
  serverTime: ExpectedClassInfo['serverTime'];
}

export interface InstitutionalCoverageResponse {
  isInstitutional: boolean;
  date: string;
  dayOfWeek: number;
  totalSlots: number;
  summary: {
    total: number;
    covered: number;
    notRecorded: number;
    upcoming: number;
  };
  schedule: Array<{
    timetableId: string;
    staff: {
      id: string;
      staff_id: string;
      full_name: string;
      designation: string;
    };
    class: {
      id: string;
      name: string;
      section?: string | null;
      department?: {
        name: string;
        code: string;
      };
    };
    subject: {
      id: string;
      name: string;
      code: string;
    };
    startTime: string;
    endTime: string;
    room?: string | null;
    timeStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    coverage: ClassCoverageStatus;
    recordedActivityId?: string | null;
  }>;
}

// ==========================================
// PHASE 7: OPERATIONAL INTELLIGENCE & ALERTS
// ==========================================

export type OperationalAlertType =
  | 'CLASS_ACTIVITY_NOT_RECORDED'
  | 'TASK_OVERDUE'
  | 'TASK_HIGH_RISK'
  | 'ATTENDANCE_PATTERN'
  | 'TIMETABLE_CONFLICT'
  | 'WORKLOAD_CONCENTRATION'
  | 'NOTIFICATION_FAILURE'
  | 'SYSTEM_OPERATIONAL';

export type OperationalAlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type OperationalAlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export interface OperationalAlertEntity {
  id: string;
  alert_type: OperationalAlertType;
  severity: OperationalAlertSeverity;
  status: OperationalAlertStatus;
  dedup_key: string;
  rule_identifier: string;
  title: string;
  message: string;
  evidence?: string | null;
  staff_id?: string | null;
  department_id?: string | null;
  timetable_id?: string | null;
  task_id?: string | null;
  attendance_id?: string | null;
  detected_at: string;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  dismissed_at?: string | null;
  dismissed_by?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  staff?: {
    id: string;
    staff_id: string;
    full_name: string;
    designation: string;
    email?: string;
  } | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  task?: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string;
  } | null;
  timetable?: {
    id: string;
    start_time: string;
    end_time: string;
    room?: string | null;
    class?: {
      id: string;
      name: string;
      section?: string | null;
    };
    subject?: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
}

export interface OperationalAlertSummary {
  totalActive: number;
  open: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
  byType: Record<string, number>;
  bySeverity: Record<OperationalAlertSeverity, number>;
}

export interface ScheduledJobRuntimeState {
  name: string;
  description: string;
  intervalMs: number;
  isRunning: boolean;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastStatus: 'IDLE' | 'SUCCESS' | 'FAILED' | 'RUNNING';
  lastError: string | null;
  totalRuns: number;
  totalAlertsGenerated: number;
}

export interface ScheduledJobRunEntity {
  id: string;
  job_name: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  records_processed?: number;
  alerts_generated?: number;
  error_message?: string | null;
  metadata?: string | null;
}

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

export interface TimetableConflictItem {
  type: 'STAFF_OVERLAP' | 'CLASS_OVERLAP' | 'INVALID_TIME' | 'DUPLICATE_ENTRY';
  ruleIdentifier: string;
  severity: 'HIGH' | 'CRITICAL';
  description: string;
  entryA: {
    id: string;
    staffName: string;
    className: string;
    subjectName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
  };
  entryB?: {
    id: string;
    staffName: string;
    className: string;
    subjectName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
  };
}

