import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class AiAlertsController {
  /**
   * GET /api/ai-alerts
   * ADMIN: All operational AI alerts
   * STAFF: ONLY own AI-related personal alerts/data. Blocked with 403 on IDOR attempts.
   */
  async getAiAlerts(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view AI alerts for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      const where: any = {};

      if (!isAdmin) {
        // Staff only sees alerts where staff_id is their own (or null/broadcast if applicable)
        where.OR = [
          { staff_id: user.staffRecordId || 'none' },
          { staff_id: null },
        ];
      } else if (requestedStaffId) {
        const staff = await prisma.staff.findFirst({
          where: {
            OR: [{ id: requestedStaffId }, { staff_id: requestedStaffId }],
          },
        });
        where.staff_id = staff ? staff.id : requestedStaffId;
      }

      const alerts = await prisma.aiAlert.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: alerts,
        meta: { total: alerts.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ai-alerts/:id
   */
  async getAiAlertById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const alert = await prisma.aiAlert.findUnique({
        where: { id },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
            },
          },
        },
      });

      if (!alert) {
        throw new AppError(`AI alert not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && alert.staff_id && alert.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view AI alerts belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      res.status(200).json({
        success: true,
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiAlertsController = new AiAlertsController();
