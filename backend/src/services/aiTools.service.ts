import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ToolEvidenceItem {
  entity_type: string;
  entity_id: string;
  evidence_type: string;
  explanation: string;
}

export interface ToolExecutionResult {
  toolName: string;
  recordCount: number;
  facts: string[];
  evidence: ToolEvidenceItem[];
  data: any[];
}

export interface AuthenticatedAiUser {
  id: string;
  role: string;
  staffRecordId?: string;
  email: string;
}

export interface ToolContextParams {
  targetStaffId?: string;
  targetDepartmentId?: string;
  targetDayOfWeek?: number;
  date?: string;
  status?: string;
  priority?: string;
  action?: string;
}

/**
 * Controlled, Allowlisted AI Tool System.
 * Strictly Read-Only.
 * Role-Enforced and IDOR-Protected.
 * Expanded to cover all institutional modules:
 * Staff profiles, Departments, Classes, Subjects, Timetables, Attendance, Tasks,
 * Leave, Activities/Coverage, Alerts, Notifications, Workload, Performance,
 * Reports, Timetable PDF Imports, Audit Logs, and System Settings.
 */
export class AiToolsService {
  /**
   * List of all 22 allowlisted tools covering every module.
   */
  readonly ALLOWED_TOOLS = [
    'get_staff',
    'get_staff_attendance',
    'get_staff_tasks',
    'get_current_activities',
    'get_timetable',
    'get_leave_requests',
    'get_workload_metrics',
    'get_department_statistics',
    'get_notifications',
    'get_performance',
    'get_audit_records',
    'get_class_coverage',
    'get_operational_alerts',
    'get_task_statistics',
    'get_attendance_statistics',
    'get_department_workload',
    'get_department_performance',
    // New tools for complete coverage
    'get_academic_structure',
    'get_reports_summary',
    'get_timetable_imports',
    'get_system_settings',
    'get_general_qa',
  ] as const;

  /**
   * Tools strictly restricted to administrators.
   */
  readonly ADMIN_ONLY_TOOLS = new Set([
    'get_audit_records',
    'get_department_statistics',
    'get_department_workload',
    'get_department_performance',
    'get_class_coverage',
    'get_system_settings',
    'get_timetable_imports',
  ]);

  /**
   * Asserts whether a user is authorized to call a specific tool.
   */
  assertToolAuthorization(toolName: string, user: AuthenticatedAiUser) {
    if (!this.ALLOWED_TOOLS.includes(toolName as any)) {
      throw new AppError(`Unrecognized or prohibited AI tool: ${toolName}`, 400, 'INVALID_AI_TOOL');
    }

    if (this.ADMIN_ONLY_TOOLS.has(toolName) && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new AppError(
        `Unauthorized tool invocation: '${toolName}' is strictly restricted to administrative users.`,
        403,
        'FORBIDDEN_TOOL_ACCESS'
      );
    }
  }

  // =========================================================================
  // 1. get_staff
  // =========================================================================
  async getStaff(user: AuthenticatedAiUser, params: { staffId?: string; departmentId?: string; searchTerm?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_staff', user);

    const where: any = { status: 'ACTIVE' };

    if (user.role === 'STAFF') {
      where.id = user.staffRecordId || 'none';
    } else {
      if (params.staffId) {
        where.id = params.staffId;
      } else if (params.searchTerm) {
        where.OR = [
          { full_name: { contains: params.searchTerm, mode: 'insensitive' } },
          { staff_id: { contains: params.searchTerm, mode: 'insensitive' } },
          { email: { contains: params.searchTerm, mode: 'insensitive' } },
        ];
      }
      if (params.departmentId) where.department_id = params.departmentId;
    }

    const records = await prisma.staff.findMany({
      where,
      include: { department: { select: { id: true, name: true, code: true } } },
      take: 25,
    });

    const evidence: ToolEvidenceItem[] = records.map((s) => ({
      entity_type: 'STAFF',
      entity_id: s.id,
      evidence_type: 'STAFF_RECORD',
      explanation: `Staff record: ${s.full_name} (Staff ID: ${s.staff_id}) - ${s.designation} in ${s.department?.name || 'Department'}. Email: ${s.email}, Joining: ${s.joining_date.toISOString().split('T')[0]}, Exp: ${s.experience ?? 0} yrs`,
    }));

    const facts = records.map(
      (s) =>
        `Staff member ${s.full_name} (Staff ID: ${s.staff_id}) holds designation "${s.designation}" in ${s.department?.name} (email: ${s.email}, phone: ${s.phone || 'N/A'}, qualification: ${s.qualification || 'N/A'}, experience: ${s.experience ?? 0} years).`
    );

    return {
      toolName: 'get_staff',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((s) => ({
        id: s.id,
        staffId: s.staff_id,
        name: s.full_name,
        designation: s.designation,
        department: s.department?.name,
        email: s.email,
        phone: s.phone,
        qualification: s.qualification,
        experience: s.experience,
        joiningDate: s.joining_date.toISOString().split('T')[0],
      })),
    };
  }

  // =========================================================================
  // 2. get_staff_attendance
  // =========================================================================
  async getStaffAttendance(user: AuthenticatedAiUser, params: { date?: string; status?: string; staffId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_staff_attendance', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.staff_id = params.staffId;
    }

    if (params.status) where.status = params.status as any;
    if (params.date) {
      const d = new Date(params.date);
      where.attendance_date = d;
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { staff: { select: { id: true, full_name: true, staff_id: true } } },
      orderBy: { attendance_date: 'desc' },
      take: 30,
    });

    const evidence: ToolEvidenceItem[] = records.map((a) => ({
      entity_type: 'ATTENDANCE',
      entity_id: a.id,
      evidence_type: 'ATTENDANCE_RECORD',
      explanation: `Attendance for ${a.staff.full_name} (${a.staff.staff_id}) on ${a.attendance_date.toISOString().split('T')[0]}: ${a.status}${a.remarks ? ` (Remarks: ${a.remarks})` : ''}`,
    }));

    const facts = records.map(
      (a) =>
        `Attendance for ${a.staff.full_name} on ${a.attendance_date.toISOString().split('T')[0]} is recorded as ${a.status}${a.remarks ? ` [${a.remarks}]` : ''}.`
    );

    return {
      toolName: 'get_staff_attendance',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((a) => ({
        id: a.id,
        staffName: a.staff.full_name,
        date: a.attendance_date.toISOString().split('T')[0],
        status: a.status,
        remarks: a.remarks,
      })),
    };
  }

  // =========================================================================
  // 3. get_staff_tasks
  // =========================================================================
  async getStaffTasks(user: AuthenticatedAiUser, params: { status?: string; priority?: string; staffId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_staff_tasks', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.assigned_staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.assigned_staff_id = params.staffId;
    }

    if (params.status) where.status = params.status as any;
    if (params.priority) where.priority = params.priority as any;

    const records = await prisma.task.findMany({
      where,
      include: { assigned_staff: { select: { id: true, full_name: true, staff_id: true } } },
      orderBy: { due_date: 'asc' },
      take: 30,
    });

    const evidence: ToolEvidenceItem[] = records.map((t) => ({
      entity_type: 'TASK',
      entity_id: t.id,
      evidence_type: 'TASK_RECORD',
      explanation: `Task "${t.title}" assigned to ${t.assigned_staff?.full_name}, status: ${t.status}, priority: ${t.priority}, due: ${t.due_date.toISOString().split('T')[0]}`,
    }));

    const facts = records.map(
      (t) =>
        `Task "${t.title}" (assigned to: ${t.assigned_staff?.full_name}) is ${t.status} (priority: ${t.priority}) with due date ${t.due_date.toISOString().split('T')[0]}.`
    );

    return {
      toolName: 'get_staff_tasks',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assigned_staff?.full_name,
        dueDate: t.due_date.toISOString().split('T')[0],
      })),
    };
  }

  // =========================================================================
  // 4. get_current_activities
  // =========================================================================
  async getCurrentActivities(user: AuthenticatedAiUser, params: { staffId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_current_activities', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.staff_id = params.staffId;
    }

    const records = await prisma.activity.findMany({
      where,
      include: {
        staff: { select: { id: true, full_name: true, staff_id: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { start_time: 'desc' },
      take: 20,
    });

    const evidence: ToolEvidenceItem[] = records.map((act) => ({
      entity_type: 'ACTIVITY',
      entity_id: act.id,
      evidence_type: 'OPERATIONAL_ACTIVITY',
      explanation: `Activity for ${act.staff.full_name}: ${act.activity_status} in room ${act.room || 'General'} starting at ${act.start_time.toISOString().split('T')[1]?.substring(0, 5) || ''}`,
    }));

    const facts = records.map(
      (act) =>
        `${act.staff.full_name} has recorded activity "${act.activity_status}" starting at ${act.start_time.toISOString().split('T')[1]?.substring(0, 5) || ''} (${act.class?.name || 'General'}, Subject: ${act.subject?.name || 'N/A'}, Room: ${act.room || 'N/A'}).`
    );

    return {
      toolName: 'get_current_activities',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((act) => ({
        id: act.id,
        staffName: act.staff.full_name,
        status: act.activity_status,
        startTime: act.start_time.toISOString(),
        className: act.class?.name,
        subjectName: act.subject?.name,
        room: act.room,
      })),
    };
  }

  // =========================================================================
  // 5. get_timetable
  // =========================================================================
  async getTimetable(user: AuthenticatedAiUser, params: { dayOfWeek?: number; staffId?: string; departmentId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_timetable', user);

    const where: any = { status: 'SCHEDULED' };

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.staff_id = params.staffId;
    }

    if (params.dayOfWeek !== undefined) {
      where.day_of_week = params.dayOfWeek;
    }

    if (params.departmentId) {
      where.class = { department_id: params.departmentId };
    }

    const records = await prisma.timetable.findMany({
      where,
      include: {
        staff: { select: { id: true, full_name: true, staff_id: true } },
        class: { select: { id: true, name: true, section: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
      take: 40,
    });

    const dayMap = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const evidence: ToolEvidenceItem[] = records.map((tt) => ({
      entity_type: 'TIMETABLE',
      entity_id: tt.id,
      evidence_type: 'SCHEDULED_CLASS',
      explanation: `Class schedule: ${tt.subject.code} (${tt.subject.name}) for ${tt.class.name}${tt.class.section ? ` Sec ${tt.class.section}` : ''} on ${dayMap[tt.day_of_week - 1]} ${tt.start_time}-${tt.end_time} in Room ${tt.room || 'TBD'} assigned to ${tt.staff?.full_name}`,
    }));

    const facts = records.map(
      (tt) =>
        `Scheduled class: ${tt.subject.name} (${tt.subject.code}) for class ${tt.class.name} is on ${dayMap[tt.day_of_week - 1]} at ${tt.start_time}-${tt.end_time} (Room: ${tt.room || 'TBD'}) assigned to ${tt.staff?.full_name}.`
    );

    return {
      toolName: 'get_timetable',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((tt) => ({
        id: tt.id,
        day: dayMap[tt.day_of_week - 1],
        dayNumber: tt.day_of_week,
        time: `${tt.start_time} - ${tt.end_time}`,
        className: tt.class.name,
        section: tt.class.section,
        subjectCode: tt.subject.code,
        subjectName: tt.subject.name,
        faculty: tt.staff?.full_name,
        facultyStaffId: tt.staff?.staff_id,
        room: tt.room,
      })),
    };
  }

  // =========================================================================
  // 6. get_leave_requests
  // =========================================================================
  async getLeaveRequests(user: AuthenticatedAiUser, params: { status?: string; staffId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_leave_requests', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.staff_id = params.staffId;
    }

    if (params.status) where.status = params.status as any;

    const records = await prisma.leaveRequest.findMany({
      where,
      include: { staff: { select: { id: true, full_name: true, staff_id: true } } },
      orderBy: { start_date: 'desc' },
      take: 20,
    });

    const evidence: ToolEvidenceItem[] = records.map((l) => ({
      entity_type: 'LEAVE_REQUEST',
      entity_id: l.id,
      evidence_type: 'LEAVE_RECORD',
      explanation: `Leave request by ${l.staff.full_name}: ${l.leave_type} (${l.duration} days) from ${l.start_date.toISOString().split('T')[0]} to ${l.end_date.toISOString().split('T')[0]}, status: ${l.status}${l.reason ? ` (Reason: ${l.reason})` : ''}`,
    }));

    const facts = records.map(
      (l) =>
        `Leave request for ${l.staff.full_name} (${l.leave_type}, ${l.duration} days) is ${l.status} from ${l.start_date.toISOString().split('T')[0]} to ${l.end_date.toISOString().split('T')[0]}${l.reason ? ` (Reason: ${l.reason})` : ''}.`
    );

    return {
      toolName: 'get_leave_requests',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((l) => ({
        id: l.id,
        staffName: l.staff.full_name,
        type: l.leave_type,
        startDate: l.start_date.toISOString().split('T')[0],
        endDate: l.end_date.toISOString().split('T')[0],
        duration: l.duration,
        status: l.status,
        reason: l.reason,
      })),
    };
  }

  // =========================================================================
  // 7. get_workload_metrics
  // =========================================================================
  async getWorkloadMetrics(user: AuthenticatedAiUser, params: { staffId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_workload_metrics', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.staff_id = params.staffId;
    }

    const records = await prisma.workloadMetric.findMany({
      where,
      include: { staff: { select: { id: true, full_name: true, department: { select: { name: true } } } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const evidence: ToolEvidenceItem[] = records.map((w) => ({
      entity_type: 'WORKLOAD',
      entity_id: w.id,
      evidence_type: 'WORKLOAD_METRIC',
      explanation: `Workload for ${w.staff.full_name}: ${w.teaching_hours} teaching hours, ${w.active_task_count} active tasks, status: ${w.workload_status}`,
    }));

    const facts = records.map(
      (w) =>
        `${w.staff.full_name} has recorded workload status "${w.workload_status}" (${w.teaching_hours} teaching hrs/wk, ${w.active_task_count} active tasks, ${w.overdue_task_count} overdue).`
    );

    return {
      toolName: 'get_workload_metrics',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((w) => ({
        id: w.id,
        staffName: w.staff.full_name,
        department: w.staff.department?.name,
        teachingHours: w.teaching_hours,
        activeTasks: w.active_task_count,
        overdueTasks: w.overdue_task_count,
        status: w.workload_status,
        trend: w.workload_trend,
      })),
    };
  }

  // =========================================================================
  // 8. get_department_statistics (ADMIN ONLY)
  // =========================================================================
  async getDepartmentStatistics(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_department_statistics', user);

    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { staff: true, classes: true, subjects: true },
        },
      },
      take: 20,
    });

    const evidence: ToolEvidenceItem[] = departments.map((d) => ({
      entity_type: 'DEPARTMENT',
      entity_id: d.id,
      evidence_type: 'DEPARTMENT_AGGREGATE',
      explanation: `Department ${d.name} (${d.code}) has ${d._count.staff} staff, ${d._count.classes} classes, ${d._count.subjects} subjects.`,
    }));

    const facts = departments.map(
      (d) =>
        `Department ${d.name} (${d.code}) has ${d._count.staff} registered staff members and ${d._count.classes} active classes.`
    );

    return {
      toolName: 'get_department_statistics',
      recordCount: departments.length,
      facts,
      evidence,
      data: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        staffCount: d._count.staff,
        classCount: d._count.classes,
        subjectCount: d._count.subjects,
      })),
    };
  }

  // =========================================================================
  // 9. get_notifications
  // =========================================================================
  async getNotifications(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_notifications', user);

    const records = await prisma.notification.findMany({
      where: { recipient_user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 15,
    });

    const evidence: ToolEvidenceItem[] = records.map((n) => ({
      entity_type: 'NOTIFICATION',
      entity_id: n.id,
      evidence_type: 'USER_NOTIFICATION',
      explanation: `Notification: "${n.title}" (${n.type}) received on ${n.created_at.toISOString().split('T')[0]}`,
    }));

    const facts = records.map((n) => `Notification "${n.title}": ${n.message} (Read: ${n.read_at ? 'Yes' : 'No'}).`);

    return {
      toolName: 'get_notifications',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: n.created_at.toISOString(),
        isRead: Boolean(n.read_at),
      })),
    };
  }

  // =========================================================================
  // 10. get_performance
  // =========================================================================
  async getPerformance(user: AuthenticatedAiUser, params: { staffId?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_performance', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    } else if (params.staffId) {
      where.staff_id = params.staffId;
    }

    const records = await prisma.performance.findMany({
      where,
      include: { staff: { select: { id: true, full_name: true } } },
      orderBy: { period_start: 'desc' },
      take: 20,
    });

    const evidence: ToolEvidenceItem[] = records.map((p) => ({
      entity_type: 'PERFORMANCE',
      entity_id: p.id,
      evidence_type: 'PERFORMANCE_SCORE',
      explanation: `Performance evaluation for ${p.staff.full_name}: Overall ${p.overall_score !== null ? `${p.overall_score}%` : 'INSUFFICIENT_DATA'}, attendance ${p.attendance_score}%, task completion ${p.task_completion_score}%`,
    }));

    const facts = records.map(
      (p) =>
        `Staff member ${p.staff.full_name} has recorded performance score of ${p.overall_score !== null ? `${p.overall_score}%` : 'INSUFFICIENT_DATA'} (Attendance: ${p.attendance_score}%, Tasks: ${p.task_completion_score}%).`
    );

    return {
      toolName: 'get_performance',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((p) => ({
        id: p.id,
        staffName: p.staff.full_name,
        overallScore: p.overall_score,
        attendanceScore: p.attendance_score,
        taskScore: p.task_completion_score,
        onTimeScore: p.on_time_completion_score,
        classScore: p.class_completion_score,
      })),
    };
  }

  // =========================================================================
  // 11. get_audit_records (ADMIN ONLY)
  // =========================================================================
  async getAuditRecords(user: AuthenticatedAiUser, params: { action?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_audit_records', user);

    const where: any = {};
    if (params.action) where.action = params.action;

    const records = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    const evidence: ToolEvidenceItem[] = records.map((l) => ({
      entity_type: 'AUDIT_LOG',
      entity_id: l.id,
      evidence_type: 'SYSTEM_AUDIT',
      explanation: `Audit event: ${l.action} on ${l.entity_type}:${l.entity_id} by ${l.user?.email || 'System'} at ${l.created_at.toISOString()}`,
    }));

    const facts = records.map(
      (l) =>
        `Action "${l.action}" performed on entity ${l.entity_type} by ${l.user?.email || 'System'} on ${l.created_at.toISOString().split('T')[0]}.`
    );

    return {
      toolName: 'get_audit_records',
      recordCount: records.length,
      facts,
      evidence,
      data: records.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entity_type,
        actor: l.user?.email,
        timestamp: l.created_at.toISOString(),
      })),
    };
  }

  // =========================================================================
  // 12. get_class_coverage (ADMIN ONLY)
  // =========================================================================
  async getClassCoverage(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_class_coverage', user);

    const alerts = await prisma.classMonitoringAlert.findMany({
      include: {
        staff: { select: { id: true, full_name: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: { alert_date: 'desc' },
      take: 25,
    });

    const evidence: ToolEvidenceItem[] = alerts.map((a) => ({
      entity_type: 'CLASS_MONITORING_ALERT',
      entity_id: a.id,
      evidence_type: 'UNRECORDED_CLASS_ACTIVITY',
      explanation: `Class monitoring alert: ${a.class.name} (${a.subject.name}) with ${a.staff.full_name} had unrecorded activity for ${a.expected_start_time}-${a.expected_end_time} on ${a.alert_date.toISOString().split('T')[0]}`,
    }));

    const facts = alerts.map(
      (a) =>
        `Scheduled class for ${a.subject.name} (${a.class.name}, faculty: ${a.staff.full_name}) had unrecorded activity during ${a.expected_start_time}-${a.expected_end_time} on ${a.alert_date.toISOString().split('T')[0]}.`
    );

    return {
      toolName: 'get_class_coverage',
      recordCount: alerts.length,
      facts,
      evidence,
      data: alerts.map((a) => ({
        id: a.id,
        className: a.class.name,
        subject: a.subject.name,
        faculty: a.staff.full_name,
        expectedTime: `${a.expected_start_time} - ${a.expected_end_time}`,
        date: a.alert_date.toISOString().split('T')[0],
        status: a.status,
      })),
    };
  }

  // =========================================================================
  // 13. get_operational_alerts
  // =========================================================================
  async getOperationalAlerts(user: AuthenticatedAiUser, params: { status?: string } = {}): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_operational_alerts', user);

    const where: any = {};

    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    }

    if (params.status) where.status = params.status;

    const alerts = await prisma.operationalAlert.findMany({
      where,
      include: {
        staff: { select: { id: true, full_name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { detected_at: 'desc' },
      take: 25,
    });

    const evidence: ToolEvidenceItem[] = alerts.map((a) => ({
      entity_type: 'OPERATIONAL_ALERT',
      entity_id: a.id,
      evidence_type: 'OPERATIONAL_SIGNAL',
      explanation: `Operational Alert [${a.severity}] "${a.title}": ${a.message} (Rule: ${a.rule_identifier}, Status: ${a.status})`,
    }));

    const facts = alerts.map(
      (a) =>
        `Operational Alert [${a.severity}] "${a.title}" is ${a.status} (detected: ${a.detected_at.toISOString().split('T')[0]}).`
    );

    return {
      toolName: 'get_operational_alerts',
      recordCount: alerts.length,
      facts,
      evidence,
      data: alerts.map((a) => ({
        id: a.id,
        type: a.alert_type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        status: a.status,
        staffName: a.staff?.full_name,
        detectedAt: a.detected_at.toISOString(),
      })),
    };
  }

  // =========================================================================
  // 14. get_task_statistics
  // =========================================================================
  async getTaskStatistics(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_task_statistics', user);

    const where: any = {};
    if (user.role === 'STAFF') {
      where.assigned_staff_id = user.staffRecordId || 'none';
    }

    const [total, pending, inProgress, completed, overdue] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.count({ where: { ...where, status: 'PENDING' } }),
      prisma.task.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.task.count({ where: { ...where, status: 'OVERDUE' } }),
    ]);

    const evidence: ToolEvidenceItem[] = [
      {
        entity_type: 'TASK_STATISTICS',
        entity_id: 'AGGREGATE',
        evidence_type: 'TASK_METRICS',
        explanation: `Task statistics: total ${total}, pending ${pending}, in-progress ${inProgress}, completed ${completed}, overdue ${overdue}`,
      },
    ];

    const facts = [
      `Tasks summary: ${total} total assigned tasks (${completed} completed, ${pending} pending, ${inProgress} in progress, ${overdue} overdue).`,
    ];

    return {
      toolName: 'get_task_statistics',
      recordCount: total,
      facts,
      evidence,
      data: [{ total, pending, inProgress, completed, overdue }],
    };
  }

  // =========================================================================
  // 15. get_attendance_statistics
  // =========================================================================
  async getAttendanceStatistics(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_attendance_statistics', user);

    const where: any = {};
    if (user.role === 'STAFF') {
      where.staff_id = user.staffRecordId || 'none';
    }

    const [total, present, absent, halfDay, leave] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.count({ where: { ...where, status: 'PRESENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'ABSENT' } }),
      prisma.attendance.count({ where: { ...where, status: 'HALF_DAY' } }),
      prisma.attendance.count({ where: { ...where, status: 'LEAVE' } }),
    ]);

    const presentRate = total > 0 ? Math.round((present / total) * 100) : 0;

    const evidence: ToolEvidenceItem[] = [
      {
        entity_type: 'ATTENDANCE_STATISTICS',
        entity_id: 'AGGREGATE',
        evidence_type: 'ATTENDANCE_METRICS',
        explanation: `Attendance statistics: total ${total} records, ${present} present (${presentRate}%), ${absent} absent, ${halfDay} half-day, ${leave} on leave`,
      },
    ];

    const facts = [
      `Recorded attendance: ${total} total entries with ${present} present (${presentRate}% attendance rate), ${absent} absent, ${halfDay} half-day, ${leave} on leave.`,
    ];

    return {
      toolName: 'get_attendance_statistics',
      recordCount: total,
      facts,
      evidence,
      data: [{ total, present, absent, halfDay, leave, presentRate }],
    };
  }

  // =========================================================================
  // 16. get_department_workload (ADMIN ONLY)
  // =========================================================================
  async getDepartmentWorkload(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_department_workload', user);

    const departments = await prisma.department.findMany({
      include: {
        staff: {
          select: {
            id: true,
            full_name: true,
            workload_metrics: {
              orderBy: { created_at: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: 20,
    });

    const summaryData: any[] = [];
    const evidence: ToolEvidenceItem[] = [];
    const facts: string[] = [];

    for (const d of departments) {
      let totalTeachingHours = 0;
      let staffWithWorkload = 0;

      for (const s of d.staff) {
        const metric = s.workload_metrics[0];
        if (metric) {
          totalTeachingHours += metric.teaching_hours;
          staffWithWorkload++;
        }
      }

      const avgHours = staffWithWorkload > 0 ? Math.round((totalTeachingHours / staffWithWorkload) * 10) / 10 : 0;

      summaryData.push({
        departmentId: d.id,
        departmentName: d.name,
        staffCount: d.staff.length,
        avgTeachingHours: avgHours,
        totalTeachingHours,
      });

      evidence.push({
        entity_type: 'DEPARTMENT_WORKLOAD',
        entity_id: d.id,
        evidence_type: 'WORKLOAD_DISTRIBUTION',
        explanation: `Department ${d.name}: ${d.staff.length} staff, average ${avgHours} teaching hours/week, total ${totalTeachingHours} hours`,
      });

      facts.push(`Department ${d.name} average teaching workload is ${avgHours} hours/week across ${d.staff.length} staff.`);
    }

    return {
      toolName: 'get_department_workload',
      recordCount: departments.length,
      facts,
      evidence,
      data: summaryData,
    };
  }

  // =========================================================================
  // 17. get_department_performance (ADMIN ONLY)
  // =========================================================================
  async getDepartmentPerformance(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_department_performance', user);

    const departments = await prisma.department.findMany({
      include: {
        staff: {
          select: {
            id: true,
            full_name: true,
            performance: {
              orderBy: { period_start: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: 20,
    });

    const summaryData: any[] = [];
    const evidence: ToolEvidenceItem[] = [];
    const facts: string[] = [];

    for (const d of departments) {
      let totalScore = 0;
      let evaluatedCount = 0;

      for (const s of d.staff) {
        const perf = s.performance[0];
        if (perf && perf.overall_score !== null) {
          totalScore += perf.overall_score;
          evaluatedCount++;
        }
      }

      const avgScore = evaluatedCount > 0 ? Math.round((totalScore / evaluatedCount) * 10) / 10 : null;

      summaryData.push({
        departmentId: d.id,
        departmentName: d.name,
        evaluatedStaffCount: evaluatedCount,
        avgPerformanceScore: avgScore,
      });

      evidence.push({
        entity_type: 'DEPARTMENT_PERFORMANCE',
        entity_id: d.id,
        evidence_type: 'PERFORMANCE_DISTRIBUTION',
        explanation: `Department ${d.name}: evaluated ${evaluatedCount} staff, average performance score: ${avgScore !== null ? `${avgScore}%` : 'INSUFFICIENT_DATA'}`,
      });

      facts.push(
        `Department ${d.name} average performance score is ${avgScore !== null ? `${avgScore}%` : 'INSUFFICIENT_DATA'} based on ${evaluatedCount} evaluated staff.`
      );
    }

    return {
      toolName: 'get_department_performance',
      recordCount: departments.length,
      facts,
      evidence,
      data: summaryData,
    };
  }

  // =========================================================================
  // 18. get_academic_structure (Classes, Sections, Subjects, Academic Years)
  // =========================================================================
  async getAcademicStructure(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_academic_structure', user);

    const [classes, subjects, academicYears] = await Promise.all([
      prisma.class.findMany({
        where: { status: 'ACTIVE' },
        include: { department: { select: { name: true, code: true } } },
        take: 25,
      }),
      prisma.subject.findMany({
        where: { status: 'ACTIVE' },
        include: { department: { select: { name: true, code: true } } },
        take: 30,
      }),
      prisma.academicYear.findMany({
        where: { active: true },
        take: 5,
      }),
    ]);

    const facts: string[] = [];
    const evidence: ToolEvidenceItem[] = [];

    classes.forEach((c) => {
      facts.push(`Class "${c.name}"${c.section ? ` (Section ${c.section})` : ''} belongs to department ${c.department.name} (${c.department.code}).`);
      evidence.push({
        entity_type: 'CLASS',
        entity_id: c.id,
        evidence_type: 'ACADEMIC_CLASS',
        explanation: `Class ${c.name} section ${c.section || 'General'} in ${c.department.name}`,
      });
    });

    subjects.forEach((s) => {
      facts.push(`Subject "${s.name}" (Code: ${s.code}) is offered under department ${s.department.name}.`);
      evidence.push({
        entity_type: 'SUBJECT',
        entity_id: s.id,
        evidence_type: 'ACADEMIC_SUBJECT',
        explanation: `Subject ${s.code} - ${s.name} under ${s.department.name}`,
      });
    });

    academicYears.forEach((ay) => {
      facts.push(`Active Academic Year: "${ay.name}" (${ay.start_date.toISOString().split('T')[0]} to ${ay.end_date.toISOString().split('T')[0]}).`);
    });

    return {
      toolName: 'get_academic_structure',
      recordCount: classes.length + subjects.length + academicYears.length,
      facts,
      evidence,
      data: [{ classesCount: classes.length, subjectsCount: subjects.length, academicYearsCount: academicYears.length }],
    };
  }

  // =========================================================================
  // 19. get_reports_summary
  // =========================================================================
  async getReportsSummary(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_reports_summary', user);

    const reports = await prisma.report.findMany({
      orderBy: { generated_at: 'desc' },
      take: 10,
    });

    const evidence: ToolEvidenceItem[] = reports.map((r) => ({
      entity_type: 'REPORT',
      entity_id: r.id,
      evidence_type: 'GENERATED_REPORT',
      explanation: `Report "${r.title || r.report_type}" (${r.format}, status: ${r.status || 'COMPLETED'}) generated on ${r.generated_at.toISOString().split('T')[0]} with ${r.record_count ?? 0} records`,
    }));

    const facts = reports.map(
      (r) =>
        `Generated report "${r.title || r.report_type}" (${r.format}, status: ${r.status}) on ${r.generated_at.toISOString().split('T')[0]} containing ${r.record_count ?? 0} records.`
    );

    return {
      toolName: 'get_reports_summary',
      recordCount: reports.length,
      facts,
      evidence,
      data: reports.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.report_type,
        format: r.format,
        generatedAt: r.generated_at.toISOString(),
        recordCount: r.record_count,
      })),
    };
  }

  // =========================================================================
  // 20. get_timetable_imports (ADMIN ONLY)
  // =========================================================================
  async getTimetableImports(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_timetable_imports', user);

    const imports = await prisma.timetableImport.findMany({
      orderBy: { uploaded_at: 'desc' },
      take: 10,
    });

    const evidence: ToolEvidenceItem[] = imports.map((imp) => ({
      entity_type: 'TIMETABLE_IMPORT',
      entity_id: imp.id,
      evidence_type: 'PDF_IMPORT_RECORD',
      explanation: `Timetable import file "${imp.file_name}": status ${imp.status}, ${imp.imported_rows} imported rows, ${imp.conflicting_rows} conflicts, ${imp.unresolved_rows} unresolved rows`,
    }));

    const facts = imports.map(
      (imp) =>
        `Timetable PDF Import "${imp.file_name}" uploaded on ${imp.uploaded_at.toISOString().split('T')[0]}: Status is ${imp.status} (${imp.imported_rows} rows imported, ${imp.conflicting_rows} conflicts, ${imp.unresolved_rows} unresolved).`
    );

    return {
      toolName: 'get_timetable_imports',
      recordCount: imports.length,
      facts,
      evidence,
      data: imports.map((imp) => ({
        id: imp.id,
        fileName: imp.file_name,
        status: imp.status,
        importedRows: imp.imported_rows,
        conflictingRows: imp.conflicting_rows,
        uploadedAt: imp.uploaded_at.toISOString(),
      })),
    };
  }

  // =========================================================================
  // 21. get_system_settings (ADMIN ONLY)
  // =========================================================================
  async getSystemSettings(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_system_settings', user);

    const settings = await prisma.setting.findMany({
      where: {
        key: {
          notIn: ['SECRET_KEY', 'JWT_SECRET', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'DATABASE_URL'],
        },
      },
      take: 25,
    });

    const evidence: ToolEvidenceItem[] = settings.map((s) => ({
      entity_type: 'SETTING',
      entity_id: s.id,
      evidence_type: 'SYSTEM_CONFIGURATION',
      explanation: `System Setting "${s.key}": value = ${s.value} (${s.data_type})`,
    }));

    const facts = settings.map((s) => `Operational configuration parameter "${s.key}" is set to "${s.value}".`);

    return {
      toolName: 'get_system_settings',
      recordCount: settings.length,
      facts,
      evidence,
      data: settings.map((s) => ({ key: s.key, value: s.value, type: s.data_type })),
    };
  }

  // =========================================================================
  // 22. get_general_qa (General knowledge placeholder)
  // =========================================================================
  async getGeneralQa(user: AuthenticatedAiUser): Promise<ToolExecutionResult> {
    this.assertToolAuthorization('get_general_qa', user);
    return {
      toolName: 'get_general_qa',
      recordCount: 0,
      facts: [],
      evidence: [],
      data: [],
    };
  }
}

export const aiToolsService = new AiToolsService();
