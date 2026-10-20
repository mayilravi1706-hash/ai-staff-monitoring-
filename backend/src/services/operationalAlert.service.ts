import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { notificationService } from './notification.service';

export type AlertType =
  | 'CLASS_ACTIVITY_NOT_RECORDED'
  | 'TASK_OVERDUE'
  | 'TASK_HIGH_RISK'
  | 'ATTENDANCE_PATTERN'
  | 'TIMETABLE_CONFLICT'
  | 'WORKLOAD_CONCENTRATION'
  | 'NOTIFICATION_FAILURE'
  | 'SYSTEM_OPERATIONAL';

export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export interface CreateOperationalAlertInput {
  alertType: AlertType;
  severity: AlertSeverity;
  dedupKey: string;
  ruleIdentifier: string;
  title: string;
  message: string;
  evidence?: Record<string, any> | string;
  staffId?: string;
  departmentId?: string;
  timetableId?: string;
  taskId?: string;
  attendanceId?: string;
  notifyAdmins?: boolean;
}

export interface OperationalAlertFilter {
  alertType?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  staffId?: string;
  departmentId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export class OperationalAlertService {
  /**
   * Deterministically upserts an operational alert using its deduplication key.
   * If an active (OPEN or ACKNOWLEDGED) alert exists with the same dedupKey,
   * its evidence and timestamp are updated without creating duplicate entries.
   */
  async upsertAlert(input: CreateOperationalAlertInput) {
    try {
      const evidenceStr =
        typeof input.evidence === 'object'
          ? JSON.stringify(input.evidence)
          : input.evidence || null;

      const existing = await prisma.operationalAlert.findUnique({
        where: { dedup_key: input.dedupKey },
      });

      if (existing) {
        // If alert was resolved or dismissed, only reopen if it's still actively failing
        if (existing.status === 'RESOLVED' || existing.status === 'DISMISSED') {
          const updated = await prisma.operationalAlert.update({
            where: { id: existing.id },
            data: {
              status: 'OPEN',
              severity: input.severity,
              title: input.title,
              message: input.message,
              evidence: evidenceStr,
              detected_at: new Date(),
              resolved_at: null,
              resolved_by: null,
              dismissed_at: null,
              dismissed_by: null,
            },
          });
          return { alert: updated, created: false, reopened: true };
        } else {
          // Alert is OPEN or ACKNOWLEDGED, update evidence and detected time
          const updated = await prisma.operationalAlert.update({
            where: { id: existing.id },
            data: {
              title: input.title,
              message: input.message,
              evidence: evidenceStr,
              severity: input.severity,
            },
          });
          return { alert: updated, created: false, reopened: false };
        }
      }

      // Sanitize foreign key references to prevent P2003 constraint violations
      let departmentId = input.departmentId || null;
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept) departmentId = null;
      }
      let staffId = input.staffId || null;
      if (staffId) {
        const stf = await prisma.staff.findUnique({ where: { id: staffId } });
        if (!stf) staffId = null;
      }
      let timetableId = input.timetableId || null;
      if (timetableId) {
        const tt = await prisma.timetable.findUnique({ where: { id: timetableId } });
        if (!tt) timetableId = null;
      }

      // Create new operational alert
      const created = await prisma.operationalAlert.create({
        data: {
          alert_type: input.alertType,
          severity: input.severity,
          status: 'OPEN',
          dedup_key: input.dedupKey,
          rule_identifier: input.ruleIdentifier,
          title: input.title,
          message: input.message,
          evidence: evidenceStr,
          staff_id: staffId,
          department_id: departmentId,
          timetable_id: timetableId,
          task_id: input.taskId || null,
          attendance_id: input.attendanceId || null,
        },
      });

      // Optionally dispatch notification to admins for high/critical operational alerts
      if (input.notifyAdmins && (input.severity === 'HIGH' || input.severity === 'CRITICAL')) {
        await notificationService.notifyAdmins({
          type: 'OPERATIONAL_ALERT',
          title: `[${input.severity}] ${input.title}`,
          message: input.message,
          relatedEntity: 'OPERATIONAL_ALERT',
          relatedEntityId: created.id,
        });
      }

      return { alert: created, created: true, reopened: false };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await prisma.operationalAlert.findUnique({
          where: { dedup_key: input.dedupKey },
        });
        if (existing) {
          return { alert: existing, created: false, reopened: false };
        }
      }
      logger.error('Failed to upsert operational alert', error, 'ALERT_UPSERT_ERROR');
      return null;
    }
  }

  /**
   * Automatically resolves an alert if condition is cleared.
   */
  async resolveByDedupKey(dedupKey: string, reason = 'Condition automatically cleared') {
    try {
      const existing = await prisma.operationalAlert.findUnique({
        where: { dedup_key: dedupKey },
      });

      if (existing && existing.status !== 'RESOLVED' && existing.status !== 'DISMISSED') {
        return await prisma.operationalAlert.update({
          where: { id: existing.id },
          data: {
            status: 'RESOLVED',
            resolved_at: new Date(),
            resolution_notes: reason,
          },
        });
      }
      return null;
    } catch (error) {
      logger.error('Failed to resolve operational alert', error, 'ALERT_RESOLVE_ERROR');
      return null;
    }
  }

  /**
   * Resolves active unrecorded class activity alerts when a staff member records activity.
   */
  async resolveClassAlertsForStaff(staffId: string, timetableId?: string | null, newActivityData?: any) {
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const where: any = {
        staff_id: staffId,
        alert_type: 'CLASS_ACTIVITY_NOT_RECORDED',
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        created_at: { gte: todayStart },
      };

      if (timetableId) {
        where.timetable_id = timetableId;
      }

      const activeAlerts = await prisma.operationalAlert.findMany({ where });

      for (const alert of activeAlerts) {
        let existingEvidence: any = {};
        try {
          existingEvidence = alert.evidence ? JSON.parse(alert.evidence) : {};
        } catch {
          // ignore
        }

        const updatedEvidence = {
          ...existingEvidence,
          resolvedByActivity: newActivityData || true,
          resolvedAt: now.toISOString(),
        };

        await prisma.operationalAlert.update({
          where: { id: alert.id },
          data: {
            status: 'RESOLVED',
            resolved_at: now,
            resolution_notes: `Resolved: Staff recorded activity (${newActivityData?.activity_status || 'ACTIVITY'}) at ${now.toLocaleTimeString()}`,
            evidence: JSON.stringify(updatedEvidence),
          },
        });

        // Notify Admins about resolution
        await notificationService.notifyAdmins({
          type: 'CLASS_ACTIVITY_UPDATED',
          title: 'Scheduled Class Activity Recorded',
          message: `Class activity has been recorded for ${alert.title}. Operational alert marked as RESOLVED.`,
          relatedEntity: 'OPERATIONAL_ALERT',
          relatedEntityId: alert.id,
        });
      }
    } catch (e) {
      logger.error('Failed to resolve class alerts for staff', e, 'RESOLVE_ALERT_ERR');
    }
  }

  /**
   * Retrieves operational alerts with flexible filtering, search, and pagination.
   */
  async getAlerts(filters: OperationalAlertFilter) {
    const where: any = {};

    if (filters.alertType) {
      where.alert_type = filters.alertType;
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.staffId) {
      where.staff_id = filters.staffId;
    }

    if (filters.departmentId) {
      where.department_id = filters.departmentId;
    }

    if (filters.startDate || filters.endDate) {
      where.detected_at = {};
      if (filters.startDate) where.detected_at.gte = filters.startDate;
      if (filters.endDate) where.detected_at.lte = filters.endDate;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { message: { contains: filters.search, mode: 'insensitive' } },
        { rule_identifier: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20));

    const [total, alerts] = await Promise.all([
      prisma.operationalAlert.count({ where }),
      prisma.operationalAlert.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ detected_at: 'desc' }],
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
              email: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              due_date: true,
            },
          },
          timetable: {
            include: {
              class: true,
              subject: true,
            },
          },
        },
      }),
    ]);

    return {
      alerts,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Retrieves alert counts aggregated by status, severity, and type.
   */
  async getAlertSummary() {
    const [openAlerts, acknowledgedAlerts, resolvedAlerts, dismissedAlerts, alertsByType, alertsBySeverity] =
      await Promise.all([
        prisma.operationalAlert.count({ where: { status: 'OPEN' } }),
        prisma.operationalAlert.count({ where: { status: 'ACKNOWLEDGED' } }),
        prisma.operationalAlert.count({ where: { status: 'RESOLVED' } }),
        prisma.operationalAlert.count({ where: { status: 'DISMISSED' } }),
        prisma.operationalAlert.groupBy({
          by: ['alert_type'],
          _count: { id: true },
          where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        }),
        prisma.operationalAlert.groupBy({
          by: ['severity'],
          _count: { id: true },
          where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        }),
      ]);

    const byType: Record<string, number> = {};
    for (const item of alertsByType) {
      byType[item.alert_type] = item._count.id;
    }

    const bySeverity: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };
    for (const item of alertsBySeverity) {
      bySeverity[item.severity] = item._count.id;
    }

    return {
      totalActive: openAlerts + acknowledgedAlerts,
      open: openAlerts,
      acknowledged: acknowledgedAlerts,
      resolved: resolvedAlerts,
      dismissed: dismissedAlerts,
      byType,
      bySeverity,
    };
  }

  /**
   * Acknowledges an operational alert (Admin only).
   */
  async acknowledgeAlert(alertId: string, userId: string, remarks?: string) {
    const existing = await prisma.operationalAlert.findUnique({
      where: { id: alertId },
    });

    if (!existing) {
      throw new Error('Operational alert not found');
    }

    return await prisma.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledged_at: new Date(),
        acknowledged_by: userId,
        resolution_notes: remarks || existing.resolution_notes,
      },
    });
  }

  /**
   * Resolves an operational alert (Admin only).
   */
  async resolveAlert(alertId: string, userId: string, resolutionNotes: string) {
    const existing = await prisma.operationalAlert.findUnique({
      where: { id: alertId },
    });

    if (!existing) {
      throw new Error('Operational alert not found');
    }

    return await prisma.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date(),
        resolved_by: userId,
        resolution_notes: resolutionNotes,
      },
    });
  }

  /**
   * Dismisses an operational alert (Admin only).
   */
  async dismissAlert(alertId: string, userId: string, reason: string) {
    const existing = await prisma.operationalAlert.findUnique({
      where: { id: alertId },
    });

    if (!existing) {
      throw new Error('Operational alert not found');
    }

    return await prisma.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: 'DISMISSED',
        dismissed_at: new Date(),
        dismissed_by: userId,
        resolution_notes: reason,
      },
    });
  }
}

export const operationalAlertService = new OperationalAlertService();
