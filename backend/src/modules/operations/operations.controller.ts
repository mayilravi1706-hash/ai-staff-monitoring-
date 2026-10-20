import { Request, Response } from 'express';
import { z } from 'zod';
import { operationalAlertService, AlertType, AlertSeverity, AlertStatus } from '../../services/operationalAlert.service';
import { ruleEngineService } from '../../services/ruleEngine.service';
import { jobScheduler } from '../../services/scheduler.service';
import { configService } from '../../services/config.service';
import { createAuditLog } from '../audit/audit.service';
import { logger } from '../../utils/logger';

// Validation Schemas
const acknowledgeSchema = z.object({
  remarks: z.string().optional(),
});

const resolveSchema = z.object({
  resolutionNotes: z.string().min(1, 'Resolution notes are required'),
});

const dismissSchema = z.object({
  reason: z.string().min(1, 'Dismissal reason is required'),
});

const updateConfigSchema = z.object({
  classMonitoringGracePeriodMinutes: z.number().int().min(0).max(120).optional(),
  taskDueSoonThresholdHours: z.number().int().min(1).max(168).optional(),
  attendanceAnalysisPeriodDays: z.number().int().min(1).max(365).optional(),
  attendanceMinDataDays: z.number().int().min(1).max(90).optional(),
  attendanceExceptionThreshold: z.number().int().min(1).max(50).optional(),
  workloadMaxWeeklyHours: z.number().min(1).max(80).optional(),
  workloadMaxClassesPerDay: z.number().int().min(1).max(15).optional(),
  notificationCooldownMinutes: z.number().int().min(0).max(1440).optional(),
});

export class OperationsController {
  /**
   * GET /api/operations/alerts
   * List operational alerts with filtering and pagination.
   */
  async getAlerts(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const {
        alertType,
        severity,
        status,
        staffId,
        departmentId,
        startDate,
        endDate,
        search,
        page,
        pageSize,
      } = req.query;

      const filters: any = {
        alertType: alertType as AlertType,
        severity: severity as AlertSeverity,
        status: status as AlertStatus,
        staffId: staffId as string,
        departmentId: departmentId as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 20,
      };

      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      // IDOR Protection: Staff can only view alerts relevant to their staff record
      if (user && user.role === 'STAFF') {
        const staff = (req as any).staff;
        if (staff) {
          filters.staffId = staff.id;
        } else {
          return res.status(200).json({
            success: true,
            data: { alerts: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } },
          });
        }
      }

      const result = await operationalAlertService.getAlerts(filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to get operational alerts', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve operational alerts' },
      });
    }
  }

  /**
   * GET /api/operations/alerts/summary
   * Statistics of operational alerts.
   */
  async getAlertSummary(req: Request, res: Response) {
    try {
      const summary = await operationalAlertService.getAlertSummary();
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Failed to get alert summary', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve alert summary' },
      });
    }
  }

  /**
   * POST /api/operations/alerts/:id/acknowledge
   */
  async acknowledgeAlert(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const parsed = acknowledgeSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const updated = await operationalAlertService.acknowledgeAlert(id, user.id, parsed.data.remarks);

      await createAuditLog({
        userId: user.id,
        action: 'ACKNOWLEDGE_OPERATIONAL_ALERT',
        entityType: 'OPERATIONAL_ALERT',
        entityId: id,
        afterValue: { status: 'ACKNOWLEDGED', remarks: parsed.data.remarks },
      });

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to acknowledge operational alert', error, 'OPERATIONS_API_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  /**
   * POST /api/operations/alerts/:id/resolve
   */
  async resolveAlert(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const parsed = resolveSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const updated = await operationalAlertService.resolveAlert(
        id,
        user.id,
        parsed.data.resolutionNotes
      );

      await createAuditLog({
        userId: user.id,
        action: 'RESOLVE_OPERATIONAL_ALERT',
        entityType: 'OPERATIONAL_ALERT',
        entityId: id,
        afterValue: { status: 'RESOLVED', resolutionNotes: parsed.data.resolutionNotes },
      });

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to resolve operational alert', error, 'OPERATIONS_API_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  /**
   * POST /api/operations/alerts/:id/dismiss
   */
  async dismissAlert(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const parsed = dismissSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const updated = await operationalAlertService.dismissAlert(id, user.id, parsed.data.reason);

      await createAuditLog({
        userId: user.id,
        action: 'DISMISS_OPERATIONAL_ALERT',
        entityType: 'OPERATIONAL_ALERT',
        entityId: id,
        afterValue: { status: 'DISMISSED', reason: parsed.data.reason },
      });

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to dismiss operational alert', error, 'OPERATIONS_API_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'OPERATION_FAILED', message: (error as Error).message },
      });
    }
  }

  /**
   * GET /api/operations/jobs
   * Status of all registered scheduled jobs.
   */
  async getScheduledJobs(req: Request, res: Response) {
    try {
      const statuses = jobScheduler.getJobStatuses();
      return res.status(200).json({
        success: true,
        data: {
          jobs: statuses,
          serverTime: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get scheduled jobs status', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve scheduled jobs' },
      });
    }
  }

  /**
   * GET /api/operations/jobs/history
   */
  async getJobHistory(req: Request, res: Response) {
    try {
      const { limit, jobName } = req.query;
      const parsedLimit = limit ? parseInt(limit as string, 10) : 50;
      const history = await jobScheduler.getJobHistory(parsedLimit, jobName as string);

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Failed to get job history', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve job history' },
      });
    }
  }

  /**
   * POST /api/operations/jobs/:jobName/run
   * Manually triggers a scheduled job execution.
   */
  async triggerJobRun(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { jobName } = req.params;

      const runResult = await jobScheduler.runJob(jobName, `MANUAL_ADMIN:${user.email}`);

      await createAuditLog({
        userId: user.id,
        action: 'TRIGGER_SCHEDULED_JOB',
        entityType: 'SCHEDULED_JOB',
        entityId: jobName,
        afterValue: { success: runResult.success, durationMs: runResult.durationMs },
      });

      return res.status(200).json({
        success: runResult.success,
        data: runResult,
      });
    } catch (error) {
      logger.error('Failed to trigger job run', error, 'OPERATIONS_API_ERROR');
      return res.status(400).json({
        success: false,
        error: { code: 'JOB_RUN_FAILED', message: (error as Error).message },
      });
    }
  }

  /**
   * GET /api/operations/config
   */
  async getOperationalConfig(req: Request, res: Response) {
    try {
      const configs = await configService.getAllOperationalConfigs();
      return res.status(200).json({
        success: true,
        data: configs,
      });
    } catch (error) {
      logger.error('Failed to get operational configs', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve operational configurations' },
      });
    }
  }

  /**
   * PUT /api/operations/config
   */
  async updateOperationalConfig(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const parsed = updateConfigSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const updated = await configService.updateMany(parsed.data, user.id);

      await createAuditLog({
        userId: user.id,
        action: 'UPDATE_OPERATIONAL_CONFIG',
        entityType: 'SETTING',
        entityId: 'OPERATIONAL_CONFIG',
        afterValue: parsed.data,
      });

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to update operational configs', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update operational configurations' },
      });
    }
  }

  /**
   * GET /api/operations/conflicts
   * Live evaluation of timetable conflicts.
   */
  async getTimetableConflicts(req: Request, res: Response) {
    try {
      const result = await ruleEngineService.evaluateTimetableConflicts();
      return res.status(200).json({
        success: true,
        data: {
          conflicts: result.conflicts,
          evaluation: result.evaluation,
        },
      });
    } catch (error) {
      logger.error('Failed to evaluate timetable conflicts', error, 'OPERATIONS_API_ERROR');
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to evaluate timetable conflicts' },
      });
    }
  }
}

export const operationsController = new OperationsController();
