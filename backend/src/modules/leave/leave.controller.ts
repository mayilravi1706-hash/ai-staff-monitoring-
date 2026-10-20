import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import { leaveService } from '../../services/leave.service';
import { notificationService } from '../../services/notification.service';
import { workloadService } from '../../services/workload.service';
import {
  createLeaveSchema,
  updateLeaveSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
  cancelLeaveSchema,
} from './leave.validation';
import { LeaveStatus } from '@prisma/client';

export class LeaveController {
  /**
   * GET /api/leave & GET /api/leave-requests
   * ADMIN: All leave requests across the institution with server-side filters.
   * STAFF: ONLY own leave requests. Blocked with 403 on IDOR attempts.
   */
  async getLeaveRequests(req: Request, res: Response, next: NextFunction) {
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
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view leave requests for another staff member.',
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

      // Status filter
      const statusParam = req.query.status as string;
      if (statusParam && Object.values(LeaveStatus).includes(statusParam as LeaveStatus)) {
        where.status = statusParam as LeaveStatus;
      }

      // Leave type filter
      const leaveTypeParam = req.query.leaveType as string || req.query.leave_type as string;
      if (leaveTypeParam && leaveTypeParam.trim()) {
        where.leave_type = { equals: leaveTypeParam.trim(), mode: 'insensitive' };
      }

      // Department filter (Admin)
      const departmentId = req.query.departmentId as string || req.query.department_id as string;
      if (departmentId) {
        where.staff = { department_id: departmentId };
      }

      // Date range filter
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      if (startDate || endDate) {
        where.AND = where.AND || [];
        if (startDate) {
          where.AND.push({ end_date: { gte: new Date(startDate) } });
        }
        if (endDate) {
          where.AND.push({ start_date: { lte: new Date(endDate) } });
        }
      }

      // Pagination
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const skip = (page - 1) * pageSize;

      // Sorting
      const sortBy = (req.query.sortBy as string) || 'created_at';
      const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

      const [requests, total] = await Promise.all([
        prisma.leaveRequest.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            staff: {
              select: {
                id: true,
                staff_id: true,
                full_name: true,
                designation: true,
                department: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        }),
        prisma.leaveRequest.count({ where }),
      ]);

      // Metrics in scope
      const baseScopeWhere = !isAdmin
        ? { staff_id: user.staffRecordId || 'none' }
        : requestedStaffId
        ? {
            staff_id: (
              await prisma.staff.findFirst({
                where: { OR: [{ id: requestedStaffId }, { staff_id: requestedStaffId }] },
              })
            )?.id || requestedStaffId,
          }
        : {};

      const [
        totalInScope,
        pendingCount,
        approvedCount,
        rejectedCount,
        cancelledCount,
      ] = await Promise.all([
        prisma.leaveRequest.count({ where: baseScopeWhere }),
        prisma.leaveRequest.count({ where: { ...baseScopeWhere, status: LeaveStatus.PENDING } }),
        prisma.leaveRequest.count({ where: { ...baseScopeWhere, status: LeaveStatus.APPROVED } }),
        prisma.leaveRequest.count({ where: { ...baseScopeWhere, status: LeaveStatus.REJECTED } }),
        prisma.leaveRequest.count({ where: { ...baseScopeWhere, status: LeaveStatus.CANCELLED } }),
      ]);

      res.status(200).json({
        success: true,
        data: requests,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
          counts: {
            total: totalInScope,
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            cancelled: cancelledCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/leave/:id
   */
  async getLeaveRequestById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const record = await prisma.leaveRequest.findUnique({
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
        throw new AppError(`Leave request not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && record.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view leave requests belonging to another staff member.',
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
   * POST /api/leave
   * Staff applies for leave. Server strictly enforces staff_id = req.user.staffRecordId.
   * Admin can create leave on behalf of a specified staff member.
   */
  async createLeaveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      const validated = createLeaveSchema.parse(req.body);

      // Check IDOR if client specified staff_id
      if (!isAdmin && validated.staff_id && validated.staff_id !== user.staffRecordId && validated.staff_id !== user.staffId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot submit leave requests for another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      let targetStaffId = user.staffRecordId;
      if (isAdmin && validated.staff_id) {
        const targetStaff = await prisma.staff.findFirst({
          where: {
            OR: [{ id: validated.staff_id }, { staff_id: validated.staff_id }],
          },
        });
        if (!targetStaff) {
          throw new AppError(`Staff member not found: ${validated.staff_id}`, 404, 'STAFF_NOT_FOUND');
        }
        targetStaffId = targetStaff.id;
      }

      if (!targetStaffId) {
        throw new AppError('No staff profile associated with user session.', 400, 'NO_STAFF_PROFILE');
      }

      const startDateObj = new Date(validated.start_date);
      const endDateObj = new Date(validated.end_date);

      // Overlap Validation
      const { hasOverlap, conflictingLeave } = await leaveService.validateLeaveOverlap(
        targetStaffId,
        startDateObj,
        endDateObj
      );

      if (hasOverlap && conflictingLeave) {
        const cStart = conflictingLeave.start_date.toISOString().split('T')[0];
        const cEnd = conflictingLeave.end_date.toISOString().split('T')[0];
        throw new AppError(
          `Leave request rejected due to date overlap: A ${conflictingLeave.status} leave request already exists for ${cStart} to ${cEnd}.`,
          400,
          'LEAVE_OVERLAP_CONFLICT'
        );
      }

      const calculatedDuration = leaveService.calculateDuration(startDateObj, endDateObj);

      const created = await prisma.$transaction(async (tx) => {
        const leave = await tx.leaveRequest.create({
          data: {
            staff_id: targetStaffId,
            leave_type: validated.leave_type.toUpperCase(),
            start_date: startDateObj,
            end_date: endDateObj,
            duration: calculatedDuration,
            reason: validated.reason,
            status: LeaveStatus.PENDING,
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
          },
        });

        // Audit Trail
        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'LEAVE_REQUESTED',
          entityType: 'LEAVE_REQUEST',
          entityId: leave.id,
          afterValue: leave,
          metadata: {
            duration: calculatedDuration,
            leaveType: leave.leave_type,
          },
        });

        // Notify Admins
        const admins = await tx.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
          select: { id: true },
        });

        for (const admin of admins) {
          await tx.notification.create({
            data: {
              recipient_user_id: admin.id,
              type: 'LEAVE_REQUESTED',
              title: 'New Leave Request Submitted',
              message: `${leave.staff.full_name} (${leave.staff.staff_id}) requested ${leave.leave_type} leave from ${validated.start_date.split('T')[0]} to ${validated.end_date.split('T')[0]} (${calculatedDuration} days).`,
              related_entity: 'LEAVE_REQUEST',
              related_entity_id: leave.id,
            },
          });
        }

        return leave;
      });

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully and is awaiting review.',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/leave/:id
   * Modify pending leave request details.
   */
  async updateLeaveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const validated = updateLeaveSchema.parse(req.body);

      const existing = await prisma.leaveRequest.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new AppError(`Leave request not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && existing.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot edit another staff member’s leave request.',
          403,
          'FORBIDDEN'
        );
      }

      if (existing.status !== LeaveStatus.PENDING) {
        throw new AppError(
          `Cannot modify leave request with status "${existing.status}". Only PENDING requests can be edited.`,
          400,
          'INVALID_STATUS_FOR_EDIT'
        );
      }

      const newStart = validated.start_date ? new Date(validated.start_date) : existing.start_date;
      const newEnd = validated.end_date ? new Date(validated.end_date) : existing.end_date;

      if (validated.start_date || validated.end_date) {
        const { hasOverlap, conflictingLeave } = await leaveService.validateLeaveOverlap(
          existing.staff_id,
          newStart,
          newEnd,
          existing.id
        );

        if (hasOverlap && conflictingLeave) {
          throw new AppError(
            `Updated dates conflict with an existing ${conflictingLeave.status} leave request.`,
            400,
            'LEAVE_OVERLAP_CONFLICT'
          );
        }
      }

      const duration = leaveService.calculateDuration(newStart, newEnd);

      const updated = await prisma.$transaction(async (tx) => {
        const resLeave = await tx.leaveRequest.update({
          where: { id },
          data: {
            leave_type: validated.leave_type ? validated.leave_type.toUpperCase() : undefined,
            start_date: validated.start_date ? newStart : undefined,
            end_date: validated.end_date ? newEnd : undefined,
            duration: validated.start_date || validated.end_date ? duration : undefined,
            reason: validated.reason !== undefined ? validated.reason : undefined,
          },
          include: {
            staff: {
              select: { id: true, staff_id: true, full_name: true },
            },
          },
        });

        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'LEAVE_UPDATED',
          entityType: 'LEAVE_REQUEST',
          entityId: id,
          beforeValue: existing,
          afterValue: resLeave,
        });

        return resLeave;
      });

      res.status(200).json({
        success: true,
        message: 'Leave request updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/leave/:id/approve
   * Complete transactional approval workflow:
   * 1. Authenticate ADMIN.
   * 2. Verify leave exists.
   * 3. Verify it is PENDING.
   * 4. Validate dates.
   * 5. Mark leave APPROVED.
   * 6. Record reviewer & review timestamp.
   * 7. Sync relevant attendance records.
   * 8. Trigger workload recalculation.
   * 9. Create staff notification.
   * 10. Create audit record.
   * 11. Commit transaction (automatic rollback on any failure).
   */
  async approveLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      if (!isAdmin) {
        throw new AppError(
          'Access denied. Only institutional administrators can approve leave requests.',
          403,
          'FORBIDDEN'
        );
      }

      const { id } = req.params;
      const validated = approveLeaveSchema.parse(req.body);

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { staff: true },
      });

      if (!leave) {
        throw new AppError(`Leave request not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new AppError(
          `Cannot approve leave request: Current status is "${leave.status}". Only PENDING requests can be approved.`,
          400,
          'INVALID_STATUS_FOR_APPROVAL'
        );
      }

      const now = new Date();
      const remarks = validated.remarks || 'Approved by administrator';

      const approvedLeave = await prisma.$transaction(async (tx) => {
        // 5. Mark leave APPROVED, 6. Record reviewer & review timestamp
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.APPROVED,
            reviewed_by: user.staffRecordId || user.id,
            reviewed_at: now,
            remarks,
          },
          include: {
            staff: {
              select: { id: true, staff_id: true, full_name: true, user_id: true },
            },
          },
        });

        // 7. Sync relevant attendance records
        await leaveService.syncAttendanceForLeave(
          leave.staff_id,
          leave.start_date,
          leave.end_date,
          leave.leave_type,
          user.staffRecordId || user.id,
          tx
        );

        // 9. Create staff notification
        if (leave.staff.user_id) {
          const startStr = leave.start_date.toISOString().split('T')[0];
          const endStr = leave.end_date.toISOString().split('T')[0];
          await tx.notification.create({
            data: {
              recipient_user_id: leave.staff.user_id,
              type: 'LEAVE_APPROVED',
              title: 'Leave Request Approved',
              message: `Your ${leave.leave_type} leave request from ${startStr} to ${endStr} (${leave.duration} day${leave.duration > 1 ? 's' : ''}) has been approved.`,
              related_entity: 'LEAVE_REQUEST',
              related_entity_id: leave.id,
            },
          });
        }

        // 10. Create audit record
        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'LEAVE_APPROVED',
          entityType: 'LEAVE_REQUEST',
          entityId: leave.id,
          beforeValue: leave,
          afterValue: updated,
          metadata: {
            approvedBy: user.email,
            attendanceSynced: true,
          },
        });

        return updated;
      });

      // 8. Trigger workload recalculation
      await workloadService.recalculateWorkload(leave.staff_id);

      res.status(200).json({
        success: true,
        message: 'Leave request approved successfully, attendance synced, and workload updated.',
        data: approvedLeave,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/leave/:id/reject
   * Rejection workflow:
   * 1. Verify ADMIN.
   * 2. Verify leave is PENDING.
   * 3. Validate rejection reason.
   * 4. Mark REJECTED.
   * 5. Record reviewer & timestamp.
   * 6. Store rejection reason.
   * 7. Notify staff.
   * 8. Audit action.
   */
  async rejectLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      if (!isAdmin) {
        throw new AppError(
          'Access denied. Only institutional administrators can reject leave requests.',
          403,
          'FORBIDDEN'
        );
      }

      const { id } = req.params;
      const validated = rejectLeaveSchema.parse(req.body);

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { staff: true },
      });

      if (!leave) {
        throw new AppError(`Leave request not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new AppError(
          `Cannot reject leave request: Current status is "${leave.status}". Only PENDING requests can be rejected.`,
          400,
          'INVALID_STATUS_FOR_REJECTION'
        );
      }

      const now = new Date();

      const rejectedLeave = await prisma.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.REJECTED,
            reviewed_by: user.staffRecordId || user.id,
            reviewed_at: now,
            remarks: validated.remarks,
          },
          include: {
            staff: {
              select: { id: true, staff_id: true, full_name: true, user_id: true },
            },
          },
        });

        // Notify staff
        if (leave.staff.user_id) {
          const startStr = leave.start_date.toISOString().split('T')[0];
          const endStr = leave.end_date.toISOString().split('T')[0];
          await tx.notification.create({
            data: {
              recipient_user_id: leave.staff.user_id,
              type: 'LEAVE_REJECTED',
              title: 'Leave Request Rejected',
              message: `Your ${leave.leave_type} leave request (${startStr} to ${endStr}) was not approved. Reason: ${validated.remarks}`,
              related_entity: 'LEAVE_REQUEST',
              related_entity_id: leave.id,
            },
          });
        }

        // Audit log
        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'LEAVE_REJECTED',
          entityType: 'LEAVE_REQUEST',
          entityId: leave.id,
          beforeValue: leave,
          afterValue: updated,
          metadata: {
            rejectionReason: validated.remarks,
          },
        });

        return updated;
      });

      res.status(200).json({
        success: true,
        message: 'Leave request rejected and faculty member notified.',
        data: rejectedLeave,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/leave/:id/cancel
   * STAFF can cancel their own PENDING leave.
   * ADMIN can cancel any active/pending/approved leave.
   * If leave was previously APPROVED, reverts attendance and recalculates workload.
   */
  async cancelLeave(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;
      const validated = cancelLeaveSchema.parse(req.body);

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { staff: true },
      });

      if (!leave) {
        throw new AppError(`Leave request not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && leave.staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot cancel another staff member’s leave request.',
          403,
          'FORBIDDEN'
        );
      }

      if (leave.status === LeaveStatus.CANCELLED || leave.status === LeaveStatus.REJECTED) {
        throw new AppError(
          `Cannot cancel leave request that is already ${leave.status}.`,
          400,
          'INVALID_STATUS_FOR_CANCELLATION'
        );
      }

      // If non-admin tries to cancel an already approved leave:
      if (!isAdmin && leave.status === LeaveStatus.APPROVED) {
        throw new AppError(
          'Approved leave requests can only be cancelled by administrators.',
          403,
          'FORBIDDEN'
        );
      }

      const wasApproved = leave.status === LeaveStatus.APPROVED;
      const remarks = validated.remarks || `Cancelled by ${user.role === 'ADMIN' ? 'administrator' : 'requester'}`;

      const cancelledLeave = await prisma.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.CANCELLED,
            remarks: `${leave.remarks ? leave.remarks + ' | ' : ''}Cancellation Note: ${remarks}`,
          },
          include: {
            staff: {
              select: { id: true, staff_id: true, full_name: true, user_id: true },
            },
          },
        });

        // If previously approved, rollback attendance records
        if (wasApproved) {
          await leaveService.rollbackAttendanceForLeave(
            leave.staff_id,
            leave.start_date,
            leave.end_date,
            tx
          );
        }

        // Audit Trail
        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'LEAVE_CANCELLED',
          entityType: 'LEAVE_REQUEST',
          entityId: leave.id,
          beforeValue: leave,
          afterValue: updated,
          metadata: {
            cancelledBy: user.email,
            wasApproved,
            attendanceRolledBack: wasApproved,
          },
        });

        // Notify
        if (!isAdmin) {
          // Staff cancelled: notify admins
          const admins = await tx.user.findMany({
            where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
            select: { id: true },
          });
          for (const admin of admins) {
            await tx.notification.create({
              data: {
                recipient_user_id: admin.id,
                type: 'LEAVE_CANCELLED',
                title: 'Leave Request Cancelled',
                message: `${leave.staff.full_name} cancelled their ${leave.leave_type} leave request.`,
                related_entity: 'LEAVE_REQUEST',
                related_entity_id: leave.id,
              },
            });
          }
        } else if (leave.staff.user_id) {
          // Admin cancelled: notify staff
          await tx.notification.create({
            data: {
              recipient_user_id: leave.staff.user_id,
              type: 'LEAVE_CANCELLED',
              title: 'Leave Request Cancelled',
              message: `Your ${leave.leave_type} leave request was cancelled by an administrator: ${remarks}`,
              related_entity: 'LEAVE_REQUEST',
              related_entity_id: leave.id,
            },
          });
        }

        return updated;
      });

      if (wasApproved) {
        await workloadService.recalculateWorkload(leave.staff_id);
      }

      res.status(200).json({
        success: true,
        message: 'Leave request cancelled successfully.',
        data: cancelledLeave,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const leaveController = new LeaveController();
