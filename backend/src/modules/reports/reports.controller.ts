import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reportsService, ReportFormat } from '../../services/reports.service';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../audit/audit.service';
import { prisma } from '../../config/database';

const generateReportSchema = z.object({
  reportType: z.enum([
    'DAILY_STAFF',
    'WEEKLY_STAFF',
    'MONTHLY_STAFF',
    'ATTENDANCE',
    'TASK',
    'LEAVE',
    'WORKLOAD',
    'PERFORMANCE',
    'TIMETABLE',
    'DEPARTMENT',
    'CLASS_COVERAGE',
    'OPERATIONAL_ALERT',
    'NOTIFICATION',
    'AUDIT_LOG',
  ]),
  format: z.enum(['PDF', 'EXCEL', 'CSV', 'JSON']).default('PDF'),
  filters: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      academicYearId: z.string().optional(),
      departmentId: z.string().optional(),
      staffId: z.string().optional(),
      classId: z.string().optional(),
      subjectId: z.string().optional(),
      attendanceStatus: z.string().optional(),
      taskStatus: z.string().optional(),
      taskPriority: z.string().optional(),
      leaveStatus: z.string().optional(),
      workloadStatus: z.string().optional(),
      alertSeverity: z.string().optional(),
      alertStatus: z.string().optional(),
    })
    .optional(),
});

export class ReportsController {
  /**
   * POST /api/reports - Generate a report with enforced RBAC and IDOR protection
   */
  async generateReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const parsed = generateReportSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const { reportType, format, filters } = parsed.data;

      // Staff users cannot request AUDIT_LOG report
      if (user.role === 'STAFF' && reportType === 'AUDIT_LOG') {
        throw new AppError(
          'Access denied: Audit Log reports are restricted to ADMIN users.',
          403,
          'FORBIDDEN'
        );
      }

      const reportResult = await reportsService.generateReport({
        reportType,
        format: format as ReportFormat,
        filters,
        userId: user.id,
        userRole: user.role,
        staffRecordId: user.staffRecordId || undefined,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: reportResult.id,
          title: reportResult.title,
          reportType: reportResult.reportType,
          format: reportResult.format,
          status: reportResult.status,
          recordCount: reportResult.recordCount,
          filename: reportResult.filename,
          generatedAt: reportResult.generatedAt,
          downloadUrl: `/api/reports/${reportResult.id}/download`,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports - List report generation history
   */
  async getReportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const reports = await reportsService.getReportHistory(
        user.id,
        user.role,
        user.staffRecordId || undefined
      );

      return res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reports/:id - Get single report details
   */
  async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const report = await reportsService.getReportById(id, user.id, user.role);

      if (!report) {
        throw new AppError(`Report not found: ${id}`, 404, 'NOT_FOUND');
      }

      return res.status(200).json({
        success: true,
        data: report,
      });
    } catch (error) {
      if ((error as Error).message === 'FORBIDDEN_IDOR') {
        return next(
          new AppError('Access denied: You cannot view another user\'s report.', 403, 'FORBIDDEN')
        );
      }
      next(error);
    }
  }

  /**
   * GET /api/reports/:id/download or /api/reports/:id/export - Download report file
   */
  async downloadReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const report = await reportsService.getReportById(id, user.id, user.role);

      if (!report) {
        throw new AppError(`Report not found: ${id}`, 404, 'NOT_FOUND');
      }

      const filters = report.filters ? JSON.parse(report.filters) : {};

      // Regenerate file buffer safely
      const result = await reportsService.generateReport({
        reportType: report.report_type as any,
        format: report.format as ReportFormat,
        filters,
        userId: user.id,
        userRole: user.role,
        staffRecordId: user.staffRecordId || undefined,
      });

      // Audit download event
      await createAuditLog({
        userId: user.id,
        action: 'REPORT_DOWNLOADED',
        entityType: 'REPORT',
        entityId: report.id,
        metadata: {
          reportType: report.report_type,
          format: report.format,
        },
      });

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).send(result.buffer);
    } catch (error) {
      if ((error as Error).message === 'FORBIDDEN_IDOR') {
        return next(
          new AppError('Access denied: You cannot download another user\'s report.', 403, 'FORBIDDEN')
        );
      }
      next(error);
    }
  }

  /**
   * Direct streaming export helper for specified report type (e.g., GET /api/reports/attendance)
   */
  async streamDirectReport(reportType: string, req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const format = ((req.query.format as string) || 'CSV').toUpperCase() as ReportFormat;

      const result = await reportsService.generateReport({
        reportType: reportType as any,
        format,
        filters: req.query as any,
        userId: user.id,
        userRole: user.role,
        staffRecordId: user.staffRecordId || undefined,
      });

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).send(result.buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/reports/:id - Delete a report history entry
   */
  async deleteReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const report = await reportsService.getReportById(id, user.id, user.role);

      if (!report) {
        throw new AppError(`Report not found: ${id}`, 404, 'NOT_FOUND');
      }

      await prisma.report.delete({ where: { id } });

      return res.status(200).json({
        success: true,
        message: 'Report metadata removed successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportsController = new ReportsController();
