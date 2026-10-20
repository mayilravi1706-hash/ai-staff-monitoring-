import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import { classMonitoringService } from '../../services/classMonitoring.service';
import { z } from 'zod';

const updateAlertSchema = z.object({
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED']),
});

const updateGracePeriodSchema = z.object({
  gracePeriodMinutes: z.coerce.number().int().min(0).max(60),
});

export class MonitoringController {
  /**
   * GET /api/monitoring/alerts
   * ADMIN: All operational monitoring signals
   * STAFF: ONLY own monitoring signals
   */
  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const requestedStaffId = (req.query.staffId as string) || (req.query.staff_id as string);

      if (!isAdmin && requestedStaffId) {
        const isSelf =
          (user.staffRecordId && requestedStaffId === user.staffRecordId) ||
          (user.staffId && requestedStaffId === user.staffId) ||
          requestedStaffId === 'me';

        if (!isSelf) {
          throw new AppError(
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view monitoring alerts for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      const effectiveStaffId = !isAdmin
        ? user.staffRecordId || 'none'
        : requestedStaffId || undefined;

      // 1. Run live operational monitoring evaluation
      await classMonitoringService.evaluateOperationalMonitoringSignals(effectiveStaffId);

      // 2. Fetch filtered alerts
      const status = req.query.status as string | undefined;
      const dateStr = req.query.date as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;

      const result = await classMonitoringService.getMonitoringAlerts({
        staffId: effectiveStaffId,
        status,
        date: dateStr ? new Date(dateStr) : undefined,
        page,
        pageSize,
      });

      res.status(200).json({
        success: true,
        data: result.alerts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/monitoring/alerts/:id
   * Acknowledge or resolve an alert.
   */
  async updateAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;
      const { status } = updateAlertSchema.parse(req.body);

      const existing = await prisma.classMonitoringAlert.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new AppError(`Monitoring alert not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && existing.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot modify alerts for another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const updated = await prisma.classMonitoringAlert.update({
        where: { id },
        data: {
          status,
          ...(status === 'RESOLVED' ? { resolved_at: new Date() } : {}),
        },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
            },
          },
          class: true,
          subject: true,
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'MONITORING_ALERT_UPDATED',
        entityType: 'MONITORING_ALERT',
        entityId: id,
        beforeValue: { status: existing.status },
        afterValue: { status: updated.status },
      });

      res.status(200).json({
        success: true,
        message: 'Monitoring alert status updated.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/monitoring/grace-period
   */
  async getGracePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const minutes = await classMonitoringService.getGracePeriodMinutes();
      res.status(200).json({
        success: true,
        data: {
          gracePeriodMinutes: minutes,
          description: 'Grace period (in minutes) before generating unrecorded class operational monitoring signals.',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/monitoring/grace-period
   * ADMIN ONLY
   */
  async updateGracePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { gracePeriodMinutes } = updateGracePeriodSchema.parse(req.body);

      const updated = await classMonitoringService.setGracePeriodMinutes(
        gracePeriodMinutes,
        user.id
      );

      await recordAuditLog({
        userId: user.id,
        action: 'GRACE_PERIOD_UPDATED',
        entityType: 'SETTING',
        entityId: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES',
        afterValue: { gracePeriodMinutes: updated },
      });

      res.status(200).json({
        success: true,
        message: `Class monitoring grace period updated to ${updated} minutes.`,
        data: { gracePeriodMinutes: updated },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const monitoringController = new MonitoringController();
