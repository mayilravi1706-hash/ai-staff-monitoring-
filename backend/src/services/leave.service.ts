import { LeaveStatus, AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class LeaveService {
  /**
   * Calculates inclusive calendar duration in days between two dates.
   */
  calculateDuration(startDate: Date, endDate: Date): number {
    const startMs = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    );
    const endMs = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    );
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }

  /**
   * Deterministic Overlap Validation:
   * A staff member cannot have overlapping leave requests if an existing request is PENDING or APPROVED.
   * Overlap rule: existing.start_date <= new_end_date AND existing.end_date >= new_start_date.
   */
  async validateLeaveOverlap(
    staffId: string,
    startDate: Date,
    endDate: Date,
    excludeLeaveId?: string,
    tx?: any
  ): Promise<{ hasOverlap: boolean; conflictingLeave?: any }> {
    const db = tx || prisma;

    const where: any = {
      staff_id: staffId,
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      start_date: { lte: endDate },
      end_date: { gte: startDate },
    };

    if (excludeLeaveId) {
      where.id = { not: excludeLeaveId };
    }

    const conflictingLeave = await db.leaveRequest.findFirst({
      where,
      orderBy: { created_at: 'desc' },
    });

    if (conflictingLeave) {
      return { hasOverlap: true, conflictingLeave };
    }

    return { hasOverlap: false };
  }

  /**
   * Syncs attendance records for approved leave period across each day.
   */
  async syncAttendanceForLeave(
    staffId: string,
    startDate: Date,
    endDate: Date,
    leaveType: string,
    reviewerId: string,
    tx: any
  ): Promise<void> {
    const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    const current = new Date(start);
    while (current <= end) {
      const attendanceDate = new Date(current);

      await tx.attendance.upsert({
        where: {
          staff_id_attendance_date: {
            staff_id: staffId,
            attendance_date: attendanceDate,
          },
        },
        update: {
          status: AttendanceStatus.LEAVE,
          remarks: `Approved Leave (${leaveType})`,
          updated_by: reviewerId,
        },
        create: {
          staff_id: staffId,
          attendance_date: attendanceDate,
          status: AttendanceStatus.LEAVE,
          remarks: `Approved Leave (${leaveType})`,
          created_by: reviewerId,
        },
      });

      // Advance one day
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  /**
   * Reverts attendance records marked as LEAVE when a leave request is cancelled.
   */
  async rollbackAttendanceForLeave(
    staffId: string,
    startDate: Date,
    endDate: Date,
    tx: any
  ): Promise<void> {
    const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));

    await tx.attendance.deleteMany({
      where: {
        staff_id: staffId,
        status: AttendanceStatus.LEAVE,
        attendance_date: {
          gte: start,
          lte: end,
        },
      },
    });
  }
}

export const leaveService = new LeaveService();
