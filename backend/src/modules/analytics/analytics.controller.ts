import { Request, Response } from 'express';
import { analyticsService } from '../../services/analytics.service';
import { logger } from '../../utils/logger';

export class AnalyticsController {
  // ==========================================
  // ADMIN ANALYTICS
  // ==========================================

  async getAdminOverview(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;
      const data = await analyticsService.getAdminOverview({
        departmentId: departmentId as string,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get admin overview analytics', error, 'ANALYTICS_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
      });
    }
  }

  async getAdminWorkload(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;
      const data = await analyticsService.getAdminWorkloadAnalytics({
        departmentId: departmentId as string,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get admin workload analytics', error, 'ANALYTICS_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
      });
    }
  }

  async getAdminPerformance(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;
      const data = await analyticsService.getAdminPerformanceAnalytics({
        departmentId: departmentId as string,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get admin performance analytics', error, 'ANALYTICS_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
      });
    }
  }

  async getAdminAttendance(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;
      const data = await analyticsService.getAdminAttendanceAnalytics({
        departmentId: departmentId as string,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get admin attendance analytics', error, 'ANALYTICS_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
      });
    }
  }

  async getAdminTasks(req: Request, res: Response) {
    try {
      const { departmentId } = req.query;
      const data = await analyticsService.getAdminTasksAnalytics({
        departmentId: departmentId as string,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get admin tasks analytics', error, 'ANALYTICS_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
      });
    }
  }

  // ==========================================
  // STAFF ANALYTICS (SELF-ONLY)
  // ==========================================

  private getStaffIdFromRequest(req: Request): string {
    const user = (req as any).user;
    if (user?.role === 'ADMIN' && req.query.staffId) {
      return req.query.staffId as string;
    }
    const staffId = user?.staffRecordId;
    if (!staffId) {
      throw new Error('Authenticated user does not have an associated staff record');
    }
    return staffId;
  }

  async getStaffOverview(req: Request, res: Response) {
    try {
      const staffId = this.getStaffIdFromRequest(req);
      const data = await analyticsService.getStaffOverview(staffId);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get staff overview analytics', error, 'ANALYTICS_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  async getStaffWorkload(req: Request, res: Response) {
    try {
      const staffId = this.getStaffIdFromRequest(req);
      const data = await analyticsService.getStaffWorkload(staffId);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get staff workload analytics', error, 'ANALYTICS_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  async getStaffPerformance(req: Request, res: Response) {
    try {
      const staffId = this.getStaffIdFromRequest(req);
      const data = await analyticsService.getStaffPerformance(staffId);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get staff performance analytics', error, 'ANALYTICS_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  async getStaffAttendance(req: Request, res: Response) {
    try {
      const staffId = this.getStaffIdFromRequest(req);
      const data = await analyticsService.getStaffAttendance(staffId);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get staff attendance analytics', error, 'ANALYTICS_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  async getStaffTasks(req: Request, res: Response) {
    try {
      const staffId = this.getStaffIdFromRequest(req);
      const data = await analyticsService.getStaffTasks(staffId);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Failed to get staff tasks analytics', error, 'ANALYTICS_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }
}

export const analyticsController = new AnalyticsController();
