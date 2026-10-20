import { Request, Response, NextFunction } from 'express';
import { getFilteredAuditLogs, sanitizeAuditValue } from './audit.service';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class AuditController {
  /**
   * GET /api/audit-logs
   * STRICT ADMIN ONLY: Searchable, paginated audit logs with server-side filtering.
   */
  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        startDate,
        endDate,
        action,
        entityType,
        entityId,
        userId,
        role,
        search,
        page,
        limit,
      } = req.query;

      const result = await getFilteredAuditLogs({
        startDate: startDate as string,
        endDate: endDate as string,
        action: action as string,
        entityType: entityType as string,
        entityId: entityId as string,
        userId: userId as string,
        role: role as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      return res.status(200).json({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/audit-logs/:id
   * STRICT ADMIN ONLY: Single audit record detail view.
   */
  async getAuditLogById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const log = await prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              staff: {
                select: {
                  id: true,
                  staff_id: true,
                  full_name: true,
                  department: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });

      if (!log) {
        throw new AppError(`Audit log entry not found: ${id}`, 404, 'NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: {
          ...log,
          before_value: sanitizeAuditValue(log.before_value),
          after_value: sanitizeAuditValue(log.after_value),
          metadata: sanitizeAuditValue(log.metadata),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
