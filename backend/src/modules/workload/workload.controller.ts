import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class WorkloadController {
  /**
   * GET /api/workload
   * ADMIN: All workload records across staff
   * STAFF: ONLY own workload metrics. Blocked with 403 on IDOR attempts.
   */
  async getWorkload(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view workload for another staff member.',
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

      const workloads = await prisma.workloadMetric.findMany({
        where,
        orderBy: { created_at: 'desc' },
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
        data: workloads,
        meta: { total: workloads.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/workload/:id
   */
  async getWorkloadById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const record = await prisma.workloadMetric.findUnique({
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

      if (!record) {
        throw new AppError(`Workload metric not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && record.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view workload belonging to another staff member.',
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

export const workloadController = new WorkloadController();
