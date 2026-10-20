import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createAuditLog } from '../modules/audit/audit.service';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { AttendanceStatus, TaskStatus, TaskPriority, LeaveStatus } from '@prisma/client';

export type ReportFormat = 'PDF' | 'EXCEL' | 'CSV' | 'JSON';

export interface GenerateReportParams {
  reportType:
    | 'DAILY_STAFF'
    | 'WEEKLY_STAFF'
    | 'MONTHLY_STAFF'
    | 'ATTENDANCE'
    | 'TASK'
    | 'LEAVE'
    | 'WORKLOAD'
    | 'PERFORMANCE'
    | 'TIMETABLE'
    | 'DEPARTMENT'
    | 'CLASS_COVERAGE'
    | 'OPERATIONAL_ALERT'
    | 'NOTIFICATION'
    | 'AUDIT_LOG';
  format: ReportFormat;
  filters?: {
    startDate?: string;
    endDate?: string;
    academicYearId?: string;
    departmentId?: string;
    staffId?: string;
    classId?: string;
    subjectId?: string;
    attendanceStatus?: string;
    taskStatus?: string;
    taskPriority?: string;
    leaveStatus?: string;
    workloadStatus?: string;
    alertSeverity?: string;
    alertStatus?: string;
  };
  userId: string;
  userRole: string;
  staffRecordId?: string;
}

export interface GeneratedReportResult {
  id: string;
  title: string;
  reportType: string;
  format: ReportFormat;
  status: string;
  recordCount: number;
  buffer: Buffer;
  mimeType: string;
  filename: string;
  generatedAt: Date;
}

export class ReportsService {
  /**
   * Generates a real data-driven report with enforced RBAC and IDOR protection.
   */
  async generateReport(params: GenerateReportParams): Promise<GeneratedReportResult> {
    const startTime = Date.now();
    const { reportType, format, filters = {}, userId, userRole, staffRecordId } = params;
    const isStaff = userRole === 'STAFF';

    // Enforcement: If request is from STAFF, restrict staffId exclusively to own staffRecordId
    const effectiveStaffId = isStaff
      ? staffRecordId || 'none'
      : filters.staffId || undefined;

    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

    // Build human-readable report title
    const formattedType = reportType.replace(/_/g, ' ');
    const reportTitle = `${formattedType} Report - ${new Date().toISOString().split('T')[0]}`;

    // 1. Query Real PostgreSQL Data based on reportType
    let reportData: any[] = [];
    let summaryMetrics: Record<string, any> = {};

    switch (reportType) {
      case 'DAILY_STAFF':
      case 'WEEKLY_STAFF':
      case 'MONTHLY_STAFF': {
        const staffWhere: any = { status: 'ACTIVE' };
        if (effectiveStaffId) staffWhere.id = effectiveStaffId;
        else if (filters.departmentId) staffWhere.department_id = filters.departmentId;

        const staffList = await prisma.staff.findMany({
          where: staffWhere,
          include: { department: true },
          take: 200,
        });

        const now = new Date();
        const dateFrom = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const dateTo = endDate || now;

        for (const s of staffList) {
          const [attCount, taskCount, actCount, leaveCount] = await Promise.all([
            prisma.attendance.count({
              where: {
                staff_id: s.id,
                attendance_date: { gte: dateFrom, lte: dateTo },
              },
            }),
            prisma.task.count({
              where: {
                assigned_staff_id: s.id,
                created_at: { gte: dateFrom, lte: dateTo },
              },
            }),
            prisma.activity.count({
              where: {
                staff_id: s.id,
                start_time: { gte: dateFrom, lte: dateTo },
              },
            }),
            prisma.leaveRequest.count({
              where: {
                staff_id: s.id,
                start_date: { lte: dateTo },
                end_date: { gte: dateFrom },
              },
            }),
          ]);

          reportData.push({
            'Staff ID': s.staff_id,
            'Full Name': s.full_name,
            Department: s.department?.name || 'N/A',
            Designation: s.designation,
            'Attendance Records': attCount,
            'Assigned Tasks': taskCount,
            'Recorded Activities': actCount,
            'Leave Requests': leaveCount,
          });
        }
        summaryMetrics = { 'Total Staff Evaluated': staffList.length };
        break;
      }

      case 'ATTENDANCE': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.staff = { department_id: filters.departmentId };
        if (filters.attendanceStatus) where.status = filters.attendanceStatus as AttendanceStatus;
        if (startDate || endDate) {
          where.attendance_date = {};
          if (startDate) where.attendance_date.gte = startDate;
          if (endDate) where.attendance_date.lte = endDate;
        }

        const records = await prisma.attendance.findMany({
          where,
          include: { staff: { include: { department: true } } },
          orderBy: { attendance_date: 'desc' },
          take: 500,
        });

        reportData = records.map((r) => ({
          Date: r.attendance_date.toISOString().split('T')[0],
          'Staff ID': r.staff.staff_id,
          'Staff Name': r.staff.full_name,
          Department: r.staff.department?.name || 'N/A',
          Status: r.status,
          Remarks: r.remarks || 'None',
        }));

        summaryMetrics = {
          'Total Attendance Records': records.length,
          Present: records.filter((r) => r.status === 'PRESENT').length,
          Absent: records.filter((r) => r.status === 'ABSENT').length,
          'Half Day': records.filter((r) => r.status === 'HALF_DAY').length,
        };
        break;
      }

      case 'TASK': {
        const where: any = {};
        if (effectiveStaffId) where.assigned_staff_id = effectiveStaffId;
        else if (filters.departmentId) where.assigned_staff = { department_id: filters.departmentId };
        if (filters.taskStatus) where.status = filters.taskStatus as TaskStatus;
        if (filters.taskPriority) where.priority = filters.taskPriority as TaskPriority;
        if (startDate || endDate) {
          where.due_date = {};
          if (startDate) where.due_date.gte = startDate;
          if (endDate) where.due_date.lte = endDate;
        }

        const records = await prisma.task.findMany({
          where,
          include: { assigned_staff: { include: { department: true } } },
          orderBy: { due_date: 'asc' },
          take: 500,
        });

        reportData = records.map((t) => ({
          'Task Title': t.title,
          'Assigned Staff': t.assigned_staff?.full_name || 'Unassigned',
          Department: t.assigned_staff?.department?.name || 'N/A',
          Priority: t.priority,
          Status: t.status,
          'Due Date': t.due_date.toISOString().split('T')[0],
          'Created At': t.created_at.toISOString().split('T')[0],
        }));

        summaryMetrics = {
          'Total Tasks': records.length,
          Completed: records.filter((t) => t.status === 'COMPLETED').length,
          'In Progress': records.filter((t) => t.status === 'IN_PROGRESS').length,
          Overdue: records.filter((t) => t.status === 'OVERDUE').length,
        };
        break;
      }

      case 'LEAVE': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.staff = { department_id: filters.departmentId };
        if (filters.leaveStatus) where.status = filters.leaveStatus as LeaveStatus;

        const records = await prisma.leaveRequest.findMany({
          where,
          include: { staff: { include: { department: true } } },
          orderBy: { start_date: 'desc' },
          take: 500,
        });

        reportData = records.map((l) => ({
          'Staff ID': l.staff.staff_id,
          'Staff Name': l.staff.full_name,
          Department: l.staff.department?.name || 'N/A',
          'Leave Type': l.leave_type,
          'Start Date': l.start_date.toISOString().split('T')[0],
          'End Date': l.end_date.toISOString().split('T')[0],
          Duration: `${l.duration} Days`,
          Status: l.status,
          Reason: l.reason,
        }));

        summaryMetrics = {
          'Total Requests': records.length,
          Approved: records.filter((l) => l.status === 'APPROVED').length,
          Pending: records.filter((l) => l.status === 'PENDING').length,
          Rejected: records.filter((l) => l.status === 'REJECTED').length,
        };
        break;
      }

      case 'WORKLOAD': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.staff = { department_id: filters.departmentId };

        const records = await prisma.workloadMetric.findMany({
          where,
          include: { staff: { include: { department: true } } },
          orderBy: { created_at: 'desc' },
          take: 200,
        });

        reportData = records.map((w) => ({
          'Staff Name': w.staff.full_name,
          Department: w.staff.department?.name || 'N/A',
          'Teaching Hours': w.teaching_hours,
          'Active Tasks': w.active_task_count,
          'Overdue Tasks': w.overdue_task_count,
          'Workload Score': w.workload_score || 'N/A',
          Status: w.workload_status,
          Trend: w.workload_trend,
          'Evaluated At': w.created_at.toISOString().split('T')[0],
        }));

        summaryMetrics = { 'Evaluated Workload Records': records.length };
        break;
      }

      case 'PERFORMANCE': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.staff = { department_id: filters.departmentId };

        const records = await prisma.performance.findMany({
          where,
          include: { staff: { include: { department: true } } },
          orderBy: { period_start: 'desc' },
          take: 200,
        });

        reportData = records.map((p) => ({
          'Staff Name': p.staff.full_name,
          Department: p.staff.department?.name || 'N/A',
          'Overall Score': p.overall_score !== null ? `${p.overall_score}%` : 'INSUFFICIENT_DATA',
          'Attendance Score': p.attendance_score !== null ? `${p.attendance_score}%` : 'N/A',
          'Task Completion Score': p.task_completion_score !== null ? `${p.task_completion_score}%` : 'N/A',
          'On-Time Score': p.on_time_completion_score !== null ? `${p.on_time_completion_score}%` : 'N/A',
          'Class Score': p.class_completion_score !== null ? `${p.class_completion_score}%` : 'N/A',
          Completeness: p.data_completeness,
        }));

        summaryMetrics = { 'Evaluated Performance Records': records.length };
        break;
      }

      case 'TIMETABLE': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.class = { department_id: filters.departmentId };
        if (filters.classId) where.class_id = filters.classId;
        if (filters.subjectId) where.subject_id = filters.subjectId;

        const records = await prisma.timetable.findMany({
          where,
          include: {
            staff: true,
            class: { include: { department: true } },
            subject: true,
          },
          orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
          take: 300,
        });

        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        reportData = records.map((t) => ({
          Day: dayNames[t.day_of_week - 1] || `Day ${t.day_of_week}`,
          'Time Slot': `${t.start_time} - ${t.end_time}`,
          Class: t.class.name,
          Department: t.class.department?.name || 'N/A',
          Subject: `${t.subject.code} - ${t.subject.name}`,
          'Faculty / Staff': t.staff?.full_name || 'Unassigned',
          Room: t.room || 'N/A',
          Status: t.status,
        }));

        summaryMetrics = { 'Scheduled Slots': records.length };
        break;
      }

      case 'DEPARTMENT': {
        const departments = await prisma.department.findMany({
          include: {
            _count: { select: { staff: true, classes: true, subjects: true } },
          },
        });

        reportData = departments.map((d) => ({
          'Department Name': d.name,
          Code: d.code,
          'Total Staff': d._count.staff,
          'Total Classes': d._count.classes,
          'Total Subjects': d._count.subjects,
          Status: d.status,
        }));

        summaryMetrics = { 'Total Departments': departments.length };
        break;
      }

      case 'CLASS_COVERAGE': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.class = { department_id: filters.departmentId };

        const alerts = await prisma.classMonitoringAlert.findMany({
          where,
          include: {
            staff: true,
            class: { include: { department: true } },
            subject: true,
          },
          orderBy: { alert_date: 'desc' },
          take: 300,
        });

        reportData = alerts.map((a) => ({
          Date: a.alert_date.toISOString().split('T')[0],
          Class: a.class.name,
          Department: a.class.department?.name || 'N/A',
          Subject: a.subject.name,
          'Assigned Staff': a.staff.full_name,
          'Expected Time': `${a.expected_start_time} - ${a.expected_end_time}`,
          Status: a.status,
        }));

        summaryMetrics = { 'Monitoring Signals Evaluated': alerts.length };
        break;
      }

      case 'OPERATIONAL_ALERT': {
        const where: any = {};
        if (effectiveStaffId) where.staff_id = effectiveStaffId;
        else if (filters.departmentId) where.department_id = filters.departmentId;
        if (filters.alertSeverity) where.severity = filters.alertSeverity;
        if (filters.alertStatus) where.status = filters.alertStatus;

        const alerts = await prisma.operationalAlert.findMany({
          where,
          include: { staff: true, department: true },
          orderBy: { detected_at: 'desc' },
          take: 300,
        });

        reportData = alerts.map((a) => ({
          'Alert Type': a.alert_type,
          Severity: a.severity,
          Status: a.status,
          Title: a.title,
          'Associated Staff': a.staff?.full_name || 'System / All',
          Department: a.department?.name || 'N/A',
          'Detected At': a.detected_at.toISOString().split('T')[0],
        }));

        summaryMetrics = {
          'Total Operational Alerts': alerts.length,
          Open: alerts.filter((a) => a.status === 'OPEN').length,
          Resolved: alerts.filter((a) => a.status === 'RESOLVED').length,
        };
        break;
      }

      case 'NOTIFICATION': {
        const where: any = {};
        if (isStaff && userId) where.recipient_user_id = userId;

        const notifications = await prisma.notification.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: 300,
        });

        reportData = notifications.map((n) => ({
          Type: n.type,
          Title: n.title,
          Message: n.message,
          Read: n.read_at ? 'Yes' : 'No',
          'Created At': n.created_at.toISOString().split('T')[0],
        }));

        summaryMetrics = { 'Total Notifications': notifications.length };
        break;
      }

      case 'AUDIT_LOG': {
        // Restricted to ADMIN
        if (isStaff) {
          throw new Error('Access denied: Audit Log reports are restricted to ADMIN users.');
        }

        const where: any = {};
        if (startDate || endDate) {
          where.created_at = {};
          if (startDate) where.created_at.gte = startDate;
          if (endDate) where.created_at.lte = endDate;
        }

        const logs = await prisma.auditLog.findMany({
          where,
          include: { user: true },
          orderBy: { created_at: 'desc' },
          take: 500,
        });

        reportData = logs.map((l) => ({
          Timestamp: l.created_at.toISOString(),
          Actor: l.user?.email || 'System',
          Action: l.action,
          Entity: `${l.entity_type}:${l.entity_id}`,
          Details: l.metadata || 'N/A',
        }));

        summaryMetrics = { 'Total Audit Entries': logs.length };
        break;
      }

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    // 2. Format Output Buffer (PDF, EXCEL, CSV)
    let buffer: Buffer;
    let mimeType: string;
    let ext: string;

    if (format === 'PDF') {
      buffer = await this.renderPdfReport(reportTitle, reportType, reportData, summaryMetrics, filters);
      mimeType = 'application/pdf';
      ext = 'pdf';
    } else if (format === 'EXCEL') {
      buffer = this.renderExcelReport(reportTitle, reportData, summaryMetrics, filters);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else {
      // CSV format default
      const csvString = this.renderCsvReport(reportData);
      buffer = Buffer.from(csvString, 'utf-8');
      mimeType = 'text/csv';
      ext = 'csv';
    }

    const filename = `${reportType.toLowerCase()}_report_${Date.now()}.${ext}`;

    // 3. Save Report Record in Database
    const reportRecord = await prisma.report.create({
      data: {
        report_type: reportType,
        format,
        filters: JSON.stringify(filters),
        generated_by: userId,
        file_reference: filename,
      },
    });

    // 4. Audit Log
    await createAuditLog({
      userId,
      action: 'REPORT_GENERATED',
      entityType: 'REPORT',
      entityId: reportRecord.id,
      metadata: {
        reportType,
        format,
        recordCount: reportData.length,
        durationMs: Date.now() - startTime,
      },
    });

    return {
      id: reportRecord.id,
      title: reportTitle,
      reportType,
      format,
      status: 'COMPLETED',
      recordCount: reportData.length,
      buffer,
      mimeType,
      filename,
      generatedAt: reportRecord.generated_at,
    };
  }

  /**
   * PDF Report Generator using PDFDocument
   */
  private async renderPdfReport(
    title: string,
    type: string,
    data: any[],
    summary: Record<string, any>,
    filters: any
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.fillColor('#1e40af').fontSize(18).text('AI STAFF OPERATIONS INTELLIGENCE PLATFORM', { align: 'center' });
        doc.fillColor('#334155').fontSize(14).text(title, { align: 'center' });
        doc.moveDown(0.5);

        // Metadata block
        doc.fillColor('#475569').fontSize(9);
        doc.text(`Generated At: ${new Date().toUTCString()}`);
        doc.text(`Report Type: ${type}`);
        doc.text(`Applied Filters: ${Object.keys(filters).length ? JSON.stringify(filters) : 'None'}`);
        doc.moveDown(0.8);

        // Summary metrics box
        if (Object.keys(summary).length > 0) {
          doc.fillColor('#1e293b').fontSize(11).text('Summary Metrics:', { underline: true });
          doc.fontSize(9).fillColor('#334155');
          for (const [k, v] of Object.entries(summary)) {
            doc.text(`• ${k}: ${v}`);
          }
          doc.moveDown(1);
        }

        // Table Header & Rows
        if (data.length > 0) {
          doc.fillColor('#1e293b').fontSize(11).text('Detailed Records:', { underline: true });
          doc.moveDown(0.5);

          const keys = Object.keys(data[0]);
          doc.fontSize(8).fillColor('#0f172a');

          // Print up to 100 rows safely
          const rowsToPrint = data.slice(0, 80);
          for (let i = 0; i < rowsToPrint.length; i++) {
            const row = rowsToPrint[i];
            const line = keys.map((k) => `${k}: ${row[k] ?? ''}`).join(' | ');
            doc.text(line, { width: 500 });
            doc.moveDown(0.2);

            if (doc.y > 750) {
              doc.addPage();
            }
          }

          if (data.length > 80) {
            doc.moveDown();
            doc.fillColor('#64748b').text(`... and ${data.length - 80} additional records.`);
          }
        } else {
          doc.fillColor('#64748b').fontSize(10).text('No records found matching the applied filter criteria.');
        }

        // Footer
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.fillColor('#94a3b8').fontSize(8).text(`Page ${i + 1} of ${range.count} - Confidential System Report`, 40, 780, { align: 'center' });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Excel (.xlsx) Report Generator using xlsx library
   */
  private renderExcelReport(
    title: string,
    data: any[],
    summary: Record<string, any>,
    filters: any
  ): Buffer {
    const wb = XLSX.utils.book_new();

    // 1. Data Sheet
    const sheetData = data.length > 0 ? data : [{ Message: 'No records found' }];
    const wsData = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, wsData, 'Report Data');

    // 2. Summary Sheet
    const summaryRows = [
      ['Report Title', title],
      ['Generated At', new Date().toISOString()],
      ['Applied Filters', JSON.stringify(filters)],
      ['', ''],
      ['Summary Metric', 'Value'],
      ...Object.entries(summary),
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * CSV Report Generator with UTF-8 BOM and proper quote escaping
   */
  private renderCsvReport(data: any[]): string {
    if (data.length === 0) {
      return '\uFEFFNo records found matching the specified criteria.\r\n';
    }

    const headers = Object.keys(data[0]);

    const escapeCsvCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerLine = headers.map(escapeCsvCell).join(',');
    const dataLines = data.map((row) =>
      headers.map((h) => escapeCsvCell(row[h])).join(',')
    );

    // Prefix with UTF-8 BOM so Microsoft Excel parses UTF-8 correctly
    return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  }

  /**
   * Retrieves report history with RBAC and IDOR protection.
   */
  async getReportHistory(userId: string, userRole: string, staffRecordId?: string) {
    const where: any = {};
    if (userRole === 'STAFF') {
      where.generated_by = userId;
    }

    return prisma.report.findMany({
      where,
      orderBy: { generated_at: 'desc' },
      take: 100,
    });
  }

  /**
   * Retrieves a single report record by ID with ownership enforcement.
   */
  async getReportById(reportId: string, userId: string, userRole: string) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) return null;

    if (userRole !== 'ADMIN' && report.generated_by !== userId) {
      throw new Error('FORBIDDEN_IDOR');
    }

    return report;
  }
}

export const reportsService = new ReportsService();
