import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import { classMonitoringService } from '../../services/classMonitoring.service';
import { operationalAlertService } from '../../services/operationalAlert.service';
import {
  createActivitySchema,
  updateActivitySchema,
  activityQuerySchema,
} from './activity.validation';

export class ActivityController {
  /**
   * GET /api/activity/current
   * Returns the currently active activity for the staff member,
   * along with expected class details from the timetable engine.
   * STAFF: Only own current activity.
   * ADMIN: Can query by ?staffId=...
   */
  async getCurrentActivity(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view current activity for another staff member.',
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

      const now = new Date();

      // Find the most recent active activity that has not been explicitly ended
      const currentActivity = await prisma.activity.findFirst({
        where: {
          staff_id: targetStaffRecordId,
          actual_end_time: null,
        },
        orderBy: { start_time: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
            },
          },
          class: true,
          subject: true,
          timetable: true,
        },
      });

      // SECTION 1 & 2: Get server-evaluated expected class
      const expectedClassInfo = await classMonitoringService.getCurrentExpectedClass(
        targetStaffRecordId,
        now
      );

      res.status(200).json({
        success: true,
        data: {
          hasActiveActivity: currentActivity !== null,
          activity: currentActivity,
          expectedClass: expectedClassInfo.currentClass,
          upcomingClass: expectedClassInfo.upcomingClass,
          todaySchedule: expectedClassInfo.todaySchedule,
          serverTime: expectedClassInfo.serverTime,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/activity & GET /api/activities
   * ADMIN: All activities across the institution with filters & pagination
   * STAFF: ONLY own activities. Blocked with 403 on IDOR attempts.
   */
  async getActivities(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view activity for another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      const query = activityQuerySchema.parse(req.query);
      const { page, pageSize, status, activity_status, startDate, endDate } = query;

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

      const activeStatusFilter = activity_status || status;
      if (activeStatusFilter) {
        const normalized = activeStatusFilter.trim().toUpperCase().replace(/\s+/g, '_');
        where.activity_status = normalized;
      }

      if (startDate || endDate) {
        where.start_time = {};
        if (startDate) where.start_time.gte = new Date(startDate);
        if (endDate) where.start_time.lte = new Date(endDate);
      }

      const total = await prisma.activity.count({ where });

      const activities = await prisma.activity.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { start_time: 'desc' },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
            },
          },
          class: true,
          subject: true,
          timetable: true,
        },
      });

      res.status(200).json({
        success: true,
        data: activities,
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
   * GET /api/activity/:id
   */
  async getActivityById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const record = await prisma.activity.findUnique({
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
          class: true,
          subject: true,
          timetable: true,
        },
      });

      if (!record) {
        throw new AppError(`Activity record not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && record.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view activity belonging to another staff member.',
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
   * POST /api/activity
   * Logs or updates current work.
   * STAFF: Strictly for themselves (IDOR protected).
   * ADMIN: Authorized for staff.
   * SECTION 5: Overlapping active activities are automatically closed to prevent impossible states.
   */
  async logActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      const validatedData = createActivitySchema.parse(req.body);
      const {
        activity_status,
        description,
        notes,
        title,
        staff_id,
        duration_minutes,
        start_time,
        expected_end_time,
        timetable_id,
        class_id,
        subject_id,
        room,
      } = validatedData;

      if (!isAdmin && staff_id && staff_id !== user.staffRecordId && staff_id !== user.staffId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot log activity for another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const effectiveStaffId = isAdmin && staff_id ? staff_id : user.staffRecordId;
      if (!effectiveStaffId) {
        throw new AppError('No staff profile associated with user.', 400, 'NO_STAFF_PROFILE');
      }

      const now = new Date();
      const effectiveStartTime = start_time ? new Date(start_time) : now;
      const durationMs = (duration_minutes || 60) * 60000;
      const effectiveExpectedEndTime = expected_end_time
        ? new Date(expected_end_time)
        : new Date(effectiveStartTime.getTime() + durationMs);

      const finalDescription = notes || description || title || `Active work: ${activity_status}`;

      // Use a database transaction to close previous unended activities and create new one
      const result = await prisma.$transaction(async (tx) => {
        // Close any prior active activity for this staff
        await tx.activity.updateMany({
          where: {
            staff_id: effectiveStaffId,
            actual_end_time: null,
          },
          data: {
            actual_end_time: effectiveStartTime,
          },
        });

        // Create new activity
        const created = await tx.activity.create({
          data: {
            staff_id: effectiveStaffId,
            activity_status,
            description: finalDescription,
            timetable_id: timetable_id || null,
            class_id: class_id || null,
            subject_id: subject_id || null,
            room: room || null,
            start_time: effectiveStartTime,
            expected_end_time: effectiveExpectedEndTime,
          },
          include: {
            staff: {
              select: {
                id: true,
                staff_id: true,
                full_name: true,
                designation: true,
              },
            },
            class: true,
            subject: true,
            timetable: true,
          },
        });

        // If activity is TEACHING, resolve any active class monitoring alert for today
        if (activity_status === 'TEACHING' && (timetable_id || (class_id && subject_id))) {
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);

          await tx.classMonitoringAlert.updateMany({
            where: {
              staff_id: effectiveStaffId,
              alert_date: { gte: todayStart },
              status: 'ACTIVE',
              ...(timetable_id ? { timetable_id } : { class_id: class_id!, subject_id: subject_id! }),
            },
            data: {
              status: 'RESOLVED',
              resolved_at: now,
            },
          });
        }

        return created;
      });

      // Resolve any active operational alerts for this staff member
      await operationalAlertService.resolveClassAlertsForStaff(
        effectiveStaffId,
        timetable_id,
        {
          activity_id: result.id,
          activity_status: result.activity_status,
          recorded_at: now.toISOString(),
        }
      );

      // Audit Log
      await recordAuditLog({
        userId: user.id,
        action: 'ACTIVITY_LOGGED',
        entityType: 'ACTIVITY',
        entityId: result.id,
        afterValue: {
          staff_id: effectiveStaffId,
          status: result.activity_status,
          start_time: result.start_time,
          expected_end_time: result.expected_end_time,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Current work recorded successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/activity/:id
   * Update or end an existing activity.
   */
  async updateActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const existing = await prisma.activity.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new AppError(`Activity record not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && existing.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot modify activity belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const data = updateActivitySchema.parse(req.body);

      let actualEndTimeDate: Date | null | undefined = undefined;
      if (data.actual_end_time !== undefined) {
        actualEndTimeDate = data.actual_end_time ? new Date(data.actual_end_time) : null;
        if (actualEndTimeDate && actualEndTimeDate.getTime() < existing.start_time.getTime()) {
          throw new AppError('Actual end time cannot be before start time', 400, 'INVALID_END_TIME');
        }
      }

      let expectedEndTimeDate: Date | null | undefined = undefined;
      if (data.expected_end_time !== undefined) {
        expectedEndTimeDate = data.expected_end_time ? new Date(data.expected_end_time) : null;
        if (expectedEndTimeDate && expectedEndTimeDate.getTime() <= existing.start_time.getTime()) {
          throw new AppError('Expected end time must be after start time', 400, 'INVALID_END_TIME');
        }
      }

      const updated = await prisma.activity.update({
        where: { id },
        data: {
          ...(data.activity_status && { activity_status: data.activity_status }),
          ...(data.description !== undefined && { description: data.description || data.notes }),
          ...(data.room !== undefined && { room: data.room }),
          ...(actualEndTimeDate !== undefined && { actual_end_time: actualEndTimeDate }),
          ...(expectedEndTimeDate !== undefined && { expected_end_time: expectedEndTimeDate }),
        },
        include: {
          staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
            },
          },
          class: true,
          subject: true,
          timetable: true,
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'ACTIVITY_UPDATED',
        entityType: 'ACTIVITY',
        entityId: id,
        beforeValue: {
          activity_status: existing.activity_status,
          actual_end_time: existing.actual_end_time,
        },
        afterValue: {
          activity_status: updated.activity_status,
          actual_end_time: updated.actual_end_time,
        },
      });

      res.status(200).json({
        success: true,
        message: 'Activity updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
