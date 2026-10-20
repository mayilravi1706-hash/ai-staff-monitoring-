import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { performanceService } from '../../services/performance.service';
import { z } from 'zod';

const updateWeightsSchema = z.object({
  attendanceWeight: z.number().min(0).max(100).optional(),
  taskCompletionWeight: z.number().min(0).max(100).optional(),
  onTimeCompletionWeight: z.number().min(0).max(100).optional(),
  classCompletionWeight: z.number().min(0).max(100).optional(),
  operationalActivityWeight: z.number().min(0).max(100).optional(),
});

export class PerformanceController {
  /**
   * GET /api/performance
   * ADMIN: All performance records
   * STAFF: ONLY own performance records. Blocked with 403 on IDOR attempts.
   */
  async getPerformance(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view performance for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      const where: any = {};

      if (!isAdmin) {
        where.staff_id = user.staffRecordId || 'none';
      } else if (requestedStaffId) {
        const staff = await prisma.staff.findFirst({
          where: {
            OR: [{ id: requestedStaffId }, { staff_id: requestedStaffId }],
          },
        });
        where.staff_id = staff ? staff.id : requestedStaffId;
      }

      const records = await prisma.performance.findMany({
        where,
        orderBy: { period_start: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
              department: true,
            },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: records,
        meta: { total: records.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/performance/weights
   */
  async getWeights(req: Request, res: Response, next: NextFunction) {
    try {
      const weights = await performanceService.getPerformanceWeights();
      res.status(200).json({
        success: true,
        data: weights,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/performance/weights (ADMIN only)
   */
  async updateWeights(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const parsed = updateWeightsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const updated = await performanceService.updatePerformanceWeights(parsed.data, user.id);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_WEIGHTS', message: (error as Error).message },
      });
    }
  }

  /**
   * POST /api/performance/calculate/:staffId
   */
  async calculateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { staffId } = req.params;

      if (!isAdmin && staffId !== user.staffRecordId && staffId !== user.staffId && staffId !== 'me') {
        throw new AppError('Forbidden', 403, 'FORBIDDEN');
      }

      const targetId = !isAdmin || staffId === 'me' ? user.staffRecordId! : staffId;
      const result = await performanceService.calculateStaffPerformance(targetId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/performance/:id
   */
  async getPerformanceById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const record = await prisma.performance.findUnique({
        where: { id },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
              department: true,
            },
          },
        },
      });

      if (!record) {
        throw new AppError(`Performance record not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && record.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view performance belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const performanceController = new PerformanceController();
