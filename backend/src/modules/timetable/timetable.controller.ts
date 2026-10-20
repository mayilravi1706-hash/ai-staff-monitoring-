import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import {
  createTimetableSchema,
  updateTimetableSchema,
  timetableQuerySchema,
  timeToMinutes,
} from './timetable.validation';
import { timetablePdfParserService } from '../../services/timetablePdfParser.service';

function checkTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return Math.max(sA, sB) < Math.min(eA, eB);
}

export class TimetableController {
  /**
   * GET /api/timetable
   * ADMIN: All timetable entries across institution with search/filtering/pagination
   * STAFF: ONLY own timetable entries. Blocked with 403 on IDOR attempts.
   */
  async getTimetable(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view timetable for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      const query = timetableQuerySchema.parse(req.query);
      const {
        page,
        pageSize,
        class_id,
        subject_id,
        academic_year_id,
        department_id,
        day_of_week,
        search,
      } = query;

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

      if (department_id) {
        where.staff = { department_id };
      }

      if (class_id) where.class_id = class_id;
      if (subject_id) where.subject_id = subject_id;
      if (academic_year_id) where.academic_year_id = academic_year_id;
      if (day_of_week !== undefined) where.day_of_week = day_of_week;

      if (search && search.trim()) {
        const s = search.trim();
        where.OR = [
          { room: { contains: s, mode: 'insensitive' } },
          { subject: { name: { contains: s, mode: 'insensitive' } } },
          { subject: { code: { contains: s, mode: 'insensitive' } } },
          { class: { name: { contains: s, mode: 'insensitive' } } },
          { staff: { full_name: { contains: s, mode: 'insensitive' } } },
        ];
      }

      const total = await prisma.timetable.count({ where });

      const entries = await prisma.timetable.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
              email: true,
              department_id: true,
            },
          },
          class: {
            include: { department: true },
          },
          subject: true,
          academic_year: true,
        },
      });

      res.status(200).json({
        success: true,
        data: entries,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/timetable/:id
   */
  async getTimetableById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const record = await prisma.timetable.findUnique({
        where: { id },
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
          class: true,
          subject: true,
          academic_year: true,
        },
      });

      if (!record) {
        throw new AppError(`Timetable entry not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && record.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view timetable belonging to another staff member.',
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

  /**
   * POST /api/timetable
   * ADMIN ONLY: Create a timetable entry with conflict detection
   */
  async createTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = createTimetableSchema.parse(req.body);

      // 1. Resolve staff: can be either staff UUID or staff_id code
      const staff = await prisma.staff.findFirst({
        where: { OR: [{ id: data.staff_id }, { staff_id: data.staff_id.toUpperCase() }] },
      });
      if (!staff) {
        throw new AppError(`Staff member not found: ${data.staff_id}`, 400, 'INVALID_STAFF_ID');
      }

      // 2. Validate class
      const classRecord = await prisma.class.findUnique({ where: { id: data.class_id } });
      if (!classRecord) {
        throw new AppError(`Class not found: ${data.class_id}`, 400, 'INVALID_CLASS_ID');
      }

      // 3. Validate subject
      const subject = await prisma.subject.findUnique({ where: { id: data.subject_id } });
      if (!subject) {
        throw new AppError(`Subject not found: ${data.subject_id}`, 400, 'INVALID_SUBJECT_ID');
      }

      // 4. Validate academic year
      const academicYear = await prisma.academicYear.findUnique({ where: { id: data.academic_year_id } });
      if (!academicYear) {
        throw new AppError(`Academic Year not found: ${data.academic_year_id}`, 400, 'INVALID_ACADEMIC_YEAR_ID');
      }

      // 5. Check Staff Schedule Conflicts
      const existingStaffEntries = await prisma.timetable.findMany({
        where: {
          staff_id: staff.id,
          academic_year_id: data.academic_year_id,
          day_of_week: data.day_of_week,
        },
      });

      for (const entry of existingStaffEntries) {
        if (checkTimeOverlap(data.start_time, data.end_time, entry.start_time, entry.end_time)) {
          throw new AppError(
            `Staff conflict: ${staff.full_name} is already scheduled from ${entry.start_time} to ${entry.end_time} on this day.`,
            400,
            'STAFF_SCHEDULE_CONFLICT'
          );
        }
      }

      // 6. Check Class Schedule Conflicts
      const existingClassEntries = await prisma.timetable.findMany({
        where: {
          class_id: data.class_id,
          academic_year_id: data.academic_year_id,
          day_of_week: data.day_of_week,
        },
      });

      for (const entry of existingClassEntries) {
        if (checkTimeOverlap(data.start_time, data.end_time, entry.start_time, entry.end_time)) {
          throw new AppError(
            `Class conflict: Class ${classRecord.name} already has a scheduled session from ${entry.start_time} to ${entry.end_time} on this day.`,
            400,
            'CLASS_SCHEDULE_CONFLICT'
          );
        }
      }

      // 7. Create Timetable Entry
      const created = await prisma.timetable.create({
        data: {
          staff_id: staff.id,
          class_id: data.class_id,
          subject_id: data.subject_id,
          academic_year_id: data.academic_year_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
          room: data.room || null,
          status: data.status,
        },
        include: {
          staff: {
            select: { id: true, staff_id: true, full_name: true, designation: true },
          },
          class: true,
          subject: true,
          academic_year: true,
        },
      });

      // 8. Audit Log
      await recordAuditLog({
        userId: user.id,
        action: 'TIMETABLE_CREATED',
        entityType: 'TIMETABLE',
        entityId: created.id,
        afterValue: {
          staff_id: staff.staff_id,
          class_id: classRecord.name,
          subject_id: subject.code,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Timetable entry scheduled successfully.',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/timetable/:id
   * ADMIN ONLY: Update a timetable entry with conflict detection
   */
  async updateTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = updateTimetableSchema.parse(req.body);

      const existing = await prisma.timetable.findUnique({
        where: { id },
        include: { staff: true, class: true },
      });
      if (!existing) {
        throw new AppError(`Timetable entry not found: ${id}`, 404, 'NOT_FOUND');
      }

      // Resolve targets
      let targetStaffId = existing.staff_id;
      if (data.staff_id) {
        const staff = await prisma.staff.findFirst({
          where: { OR: [{ id: data.staff_id }, { staff_id: data.staff_id.toUpperCase() }] },
        });
        if (!staff) throw new AppError(`Staff member not found: ${data.staff_id}`, 400, 'INVALID_STAFF_ID');
        targetStaffId = staff.id;
      }

      const targetClassId = data.class_id || existing.class_id;
      const targetYearId = data.academic_year_id || existing.academic_year_id;
      const targetDay = data.day_of_week !== undefined ? data.day_of_week : existing.day_of_week;
      const targetStartTime = data.start_time || existing.start_time;
      const targetEndTime = data.end_time || existing.end_time;

      if (timeToMinutes(targetEndTime) <= timeToMinutes(targetStartTime)) {
        throw new AppError('End time must be strictly after start time', 400, 'INVALID_TIME_RANGE');
      }

      // Check staff conflicts excluding this entry
      const existingStaffEntries = await prisma.timetable.findMany({
        where: {
          id: { not: id },
          staff_id: targetStaffId,
          academic_year_id: targetYearId,
          day_of_week: targetDay,
        },
      });

      for (const entry of existingStaffEntries) {
        if (checkTimeOverlap(targetStartTime, targetEndTime, entry.start_time, entry.end_time)) {
          throw new AppError(
            `Staff conflict: Staff is already scheduled from ${entry.start_time} to ${entry.end_time} on this day.`,
            400,
            'STAFF_SCHEDULE_CONFLICT'
          );
        }
      }

      // Check class conflicts excluding this entry
      const existingClassEntries = await prisma.timetable.findMany({
        where: {
          id: { not: id },
          class_id: targetClassId,
          academic_year_id: targetYearId,
          day_of_week: targetDay,
        },
      });

      for (const entry of existingClassEntries) {
        if (checkTimeOverlap(targetStartTime, targetEndTime, entry.start_time, entry.end_time)) {
          throw new AppError(
            `Class conflict: Class already has a scheduled session from ${entry.start_time} to ${entry.end_time} on this day.`,
            400,
            'CLASS_SCHEDULE_CONFLICT'
          );
        }
      }

      const updated = await prisma.timetable.update({
        where: { id },
        data: {
          staff_id: targetStaffId,
          class_id: targetClassId,
          ...(data.subject_id && { subject_id: data.subject_id }),
          academic_year_id: targetYearId,
          day_of_week: targetDay,
          start_time: targetStartTime,
          end_time: targetEndTime,
          ...(data.room !== undefined && { room: data.room }),
          ...(data.status && { status: data.status }),
        },
        include: {
          staff: {
            select: { id: true, staff_id: true, full_name: true, designation: true },
          },
          class: true,
          subject: true,
          academic_year: true,
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'TIMETABLE_UPDATED',
        entityType: 'TIMETABLE',
        entityId: id,
        beforeValue: {
          start_time: existing.start_time,
          end_time: existing.end_time,
          day_of_week: existing.day_of_week,
        },
        afterValue: {
          start_time: updated.start_time,
          end_time: updated.end_time,
          day_of_week: updated.day_of_week,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Timetable entry updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/timetable/:id
   * ADMIN ONLY: Delete a timetable entry
   */
  async deleteTimetable(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const existing = await prisma.timetable.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(`Timetable entry not found: ${id}`, 404, 'NOT_FOUND');
      }

      await prisma.timetable.delete({ where: { id } });

      await recordAuditLog({
        userId: user.id,
        action: 'TIMETABLE_DELETED',
        entityType: 'TIMETABLE',
        entityId: id,
        beforeValue: {
          staff_id: existing.staff_id,
          class_id: existing.class_id,
          day_of_week: existing.day_of_week,
          start_time: existing.start_time,
          end_time: existing.end_time,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Timetable entry deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/timetable/current-class
   * Returns current expected class and today's schedule for staff using SERVER time.
   * STAFF: strictly own record.
   * ADMIN: can query for any staff via ?staffId=...
   */
  async getCurrentClass(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view current class for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      let targetStaffRecordId = user.staffRecordId;
      if (isAdmin && requestedStaffId) {
        const targetStaff = await prisma.staff.findFirst({
          where: {
            OR: [{ id: requestedStaffId }, { staff_id: requestedStaffId }],
          },
        });
        targetStaffRecordId = targetStaff ? targetStaff.id : requestedStaffId;
      }

      if (!targetStaffRecordId) {
        throw new AppError('No staff profile associated with user.', 400, 'NO_STAFF_PROFILE');
      }

      const { classMonitoringService } = await import('../../services/classMonitoring.service');
      const expectedInfo = await classMonitoringService.getCurrentExpectedClass(targetStaffRecordId);

      res.status(200).json({
        success: true,
        data: expectedInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/timetable/coverage
   * Institutional class coverage overview.
   * ADMIN: all institution classes for today.
   * STAFF: own classes for today.
   */
  async getClassCoverage(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const departmentId = req.query.department_id as string | undefined;

      const { classMonitoringService } = await import('../../services/classMonitoring.service');

      if (!isAdmin) {
        if (!user.staffRecordId) {
          throw new AppError('No staff profile associated with user.', 400, 'NO_STAFF_PROFILE');
        }
        const expectedInfo = await classMonitoringService.getCurrentExpectedClass(user.staffRecordId);
        return res.status(200).json({
          success: true,
          data: {
            isInstitutional: false,
            date: expectedInfo.serverTime.dateStr,
            schedule: expectedInfo.todaySchedule,
            summary: {
              total: expectedInfo.todaySchedule.length,
              covered: expectedInfo.todaySchedule.filter((s) => s.coverage === 'COVERED').length,
              notRecorded: expectedInfo.todaySchedule.filter((s) => s.coverage === 'NOT_RECORDED').length,
              notScheduled: expectedInfo.todaySchedule.filter((s) => s.coverage === 'NOT_SCHEDULED').length,
            },
          },
        });
      }

      const institutionalData = await classMonitoringService.getInstitutionalCoverage(
        new Date(),
        departmentId
      );

      res.status(200).json({
        success: true,
        data: {
          isInstitutional: true,
          ...institutionalData,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/timetable/upload/pdf
   * ADMIN ONLY: Uploads a timetable PDF file, extracts timetable rows,
   * performs database entity matching, conflict detection, and returns an Import Preview.
   */
  async uploadTimetablePdf(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      if (!req.file) {
        throw new AppError('No PDF file uploaded. Please upload a valid timetable PDF file.', 400, 'NO_FILE');
      }

      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        req.file.buffer,
        req.file.originalname,
        user.id
      );

      await recordAuditLog({
        userId: user.id,
        action: 'TIMETABLE_PDF_UPLOADED',
        entityType: 'TIMETABLE_IMPORT',
        entityId: preview.importId,
        metadata: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileHash: preview.fileHash,
          totalRows: preview.summary.totalRows,
          validRows: preview.summary.validRows,
          unresolvedRows: preview.summary.unresolvedRows,
          conflictRows: preview.summary.conflictRows,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Timetable PDF uploaded and processed successfully. Please review the import preview.',
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/timetable/upload/confirm
   * ADMIN ONLY: Confirms and commits validated timetable rows to the database.
   */
  async confirmTimetableImport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { importId, rows, replaceExisting } = req.body;

      if (!importId) {
        throw new AppError('Import session ID is required.', 400, 'MISSING_IMPORT_ID');
      }

      const result = await timetablePdfParserService.confirmImport(
        importId,
        rows,
        user.id,
        Boolean(replaceExisting)
      );

      res.status(200).json({
        success: true,
        message: `Successfully imported ${result.importedCount} new timetable entries and updated ${result.updatedCount} existing entries.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/timetable/upload/history
   * ADMIN ONLY: Retrieves history of timetable imports.
   */
  async getTimetableImportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const pageSize = parseInt(req.query.pageSize as string || '20', 10);

      const history = await timetablePdfParserService.getImportHistory(page, pageSize);

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const timetableController = new TimetableController();
