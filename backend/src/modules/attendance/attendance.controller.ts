import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import {
  createAttendanceSchema,
  updateAttendanceSchema,
  attendanceQuerySchema,
} from './attendance.validation';

export class AttendanceController {
  /**
   * GET /api/attendance
   * Query params: ?staffId=...&startDate=...&endDate=...&date=...&page=...&pageSize=...
   * ADMIN: Can query all attendance or filter by any staffId
   * STAFF: Can ONLY view own attendance. Blocked with 403 on IDOR attempts.
   */
  async getAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const requestedStaffId = (req.query.staffId as string) || (req.query.staff_id as string);

      // IDOR check for STAFF role
      if (!isAdmin && requestedStaffId) {
        const isSelf =
          (user.staffRecordId && requestedStaffId === user.staffRecordId) ||
          (user.staffId && requestedStaffId === user.staffId) ||
          requestedStaffId === 'me';

        if (!isSelf) {
          throw new AppError(
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view attendance for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      const query = attendanceQuerySchema.parse(req.query);
      const { page, pageSize, status, startDate, endDate, date } = query;

      // Build filter
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

      if (status) {
        where.status = status.trim().toUpperCase().replace(/\s+/g, '_');
      }

      if (date) {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        const nextDay = new Date(d);
        nextDay.setDate(nextDay.getDate() + 1);
        where.attendance_date = { gte: d, lt: nextDay };
      } else if (startDate || endDate) {
        where.attendance_date = {};
        if (startDate) {
          const s = new Date(startDate);
          s.setUTCHours(0, 0, 0, 0);
          where.attendance_date.gte = s;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setUTCHours(23, 59, 59, 999);
          where.attendance_date.lte = e;
        }
      }

      const total = await prisma.attendance.count({ where });

      const attendanceRecords = await prisma.attendance.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { attendance_date: 'desc' },
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
        data: attendanceRecords,
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
   * GET /api/attendance/:id
   */
  async getAttendanceById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const record = await prisma.attendance.findUnique({
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
        throw new AppError(`Attendance record not found: ${id}`, 404, 'NOT_FOUND');
      }

      // Check ownership
      if (!isAdmin && record.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view attendance belonging to another staff member.',
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
   * POST /api/attendance
   * ADMIN: Can record attendance for any staff member.
   * STAFF: Self-service attendance for own record. Ownership derived from authenticated session.
   * SECTION 7: Enforces daily uniqueness check per staff member.
   * SECTION 8: Enforces consistency with approved leave records (cannot mark PRESENT on approved leave).
   */
  async markAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      const validatedData = createAttendanceSchema.parse(req.body);
      const { staff_id, attendance_date, status, remarks } = validatedData;

      if (!isAdmin && staff_id && staff_id !== user.staffRecordId && staff_id !== user.staffId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot record attendance for another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const effectiveStaffRecordId = isAdmin && staff_id ? staff_id : user.staffRecordId;
      if (!effectiveStaffRecordId) {
        throw new AppError('No staff profile associated with user.', 400, 'NO_STAFF_PROFILE');
      }

      // Resolve staff entity
      const staff = await prisma.staff.findFirst({
        where: {
          OR: [{ id: effectiveStaffRecordId }, { staff_id: effectiveStaffRecordId }],
        },
      });

      if (!staff) {
        throw new AppError(`Staff record not found: ${effectiveStaffRecordId}`, 404, 'STAFF_NOT_FOUND');
      }

      // Standardize attendance_date to midnight UTC
      const targetDate = attendance_date ? new Date(attendance_date) : new Date();
      targetDate.setUTCHours(0, 0, 0, 0);

      // SECTION 7: ATTENDANCE UNIQUENESS CHECK
      const existingRecord = await prisma.attendance.findUnique({
        where: {
          staff_id_attendance_date: {
            staff_id: staff.id,
            attendance_date: targetDate,
          },
        },
      });

      if (existingRecord) {
        throw new AppError(
          `Attendance record already exists for ${staff.full_name} on ${targetDate.toISOString().split('T')[0]}. Duplicate daily records are prohibited.`,
          409,
          'DUPLICATE_ATTENDANCE'
        );
      }

      // SECTION 8: LEAVE -> ATTENDANCE CONSISTENCY
      const dayStart = new Date(targetDate);
      const dayEnd = new Date(targetDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      const approvedLeave = await prisma.leaveRequest.findFirst({
        where: {
          staff_id: staff.id,
          status: 'APPROVED',
          start_date: { lte: dayEnd },
          end_date: { gte: dayStart },
        },
      });

      if (approvedLeave && status === 'PRESENT') {
        throw new AppError(
          `Staff member ${staff.full_name} has an approved leave request (${approvedLeave.leave_type}) on this date. Attendance cannot be recorded as PRESENT while on approved leave.`,
          400,
          'LEAVE_ATTENDANCE_CONFLICT'
        );
      }

      const created = await prisma.attendance.create({
        data: {
          staff_id: staff.id,
          attendance_date: targetDate,
          status,
          remarks: remarks || null,
          created_by: user.id,
        },
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

      await recordAuditLog({
        userId: user.id,
        action: 'ATTENDANCE_RECORDED',
        entityType: 'ATTENDANCE',
        entityId: created.id,
        afterValue: {
          staff_id: staff.staff_id,
          attendance_date: created.attendance_date,
          status: created.status,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully.',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/attendance/:id
   * ADMIN or authorized staff update.
   */
  async updateAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const existing = await prisma.attendance.findUnique({
        where: { id },
        include: { staff: true },
      });

      if (!existing) {
        throw new AppError(`Attendance record not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && existing.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot modify attendance belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const data = updateAttendanceSchema.parse(req.body);

      // Section 8 Consistency check on update
      if (data.status === 'PRESENT') {
        const dayStart = new Date(existing.attendance_date);
        const dayEnd = new Date(existing.attendance_date);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const approvedLeave = await prisma.leaveRequest.findFirst({
          where: {
            staff_id: existing.staff_id,
            status: 'APPROVED',
            start_date: { lte: dayEnd },
            end_date: { gte: dayStart },
          },
        });

        if (approvedLeave) {
          throw new AppError(
            `Staff member has an approved leave request on this date. Attendance cannot be changed to PRESENT.`,
            400,
            'LEAVE_ATTENDANCE_CONFLICT'
          );
        }
      }

      const updated = await prisma.attendance.update({
        where: { id },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.remarks !== undefined && { remarks: data.remarks }),
          updated_by: user.id,
        },
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

      await recordAuditLog({
        userId: user.id,
        action: 'ATTENDANCE_UPDATED',
        entityType: 'ATTENDANCE',
        entityId: id,
        beforeValue: {
          status: existing.status,
          remarks: existing.remarks,
        },
        afterValue: {
          status: updated.status,
          remarks: updated.remarks,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Attendance record updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const attendanceController = new AttendanceController();
