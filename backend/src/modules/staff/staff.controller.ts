import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { findStaffByIdentifier, isSelfStaff } from '../../utils/staffResolver';
import { recordAuditLog } from '../../utils/auditLogger';
import { createStaffSchema, updateStaffSchema, staffQuerySchema } from './staff.validation';

export class StaffController {
  /**
   * GET /api/staff
   * ADMIN: List all staff records with search, filter & pagination
   * STAFF: List ONLY their own staff record
   */
  async getAllStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;

      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        const query = staffQuerySchema.parse(req.query);
        const { page, pageSize, search, department_id, status, role, sort, order } = query;

        const where: any = {};

        if (search && search.trim()) {
          const s = search.trim();
          where.OR = [
            { full_name: { contains: s, mode: 'insensitive' } },
            { email: { contains: s, mode: 'insensitive' } },
            { staff_id: { contains: s, mode: 'insensitive' } },
            { designation: { contains: s, mode: 'insensitive' } },
          ];
        }

        if (department_id) {
          where.department_id = department_id;
        }

        if (status) {
          where.status = status;
        }

        if (role) {
          where.role = role;
        }

        const total = await prisma.staff.count({ where });

        const staffList = await prisma.staff.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            department: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                status: true,
                last_login_at: true,
                created_at: true,
              },
            },
          },
        });

        return res.status(200).json({
          success: true,
          data: staffList,
          meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
          },
        });
      }

      // STAFF role: strictly return own record
      if (!user.staffRecordId) {
        return res.status(200).json({
          success: true,
          data: [],
          meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
        });
      }

      const ownRecord = await prisma.staff.findUnique({
        where: { id: user.staffRecordId },
        include: {
          department: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              last_login_at: true,
              created_at: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: ownRecord ? [ownRecord] : [],
        meta: { total: ownRecord ? 1 : 0, page: 1, pageSize: 10, totalPages: 1 },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/staff/me
   */
  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      if (!user.staffRecordId) {
        throw new AppError('No staff profile associated with current account.', 404, 'NOT_FOUND');
      }

      const staff = await prisma.staff.findUnique({
        where: { id: user.staffRecordId },
        include: {
          department: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              last_login_at: true,
              created_at: true,
            },
          },
        },
      });

      if (!staff) {
        throw new AppError('Staff profile not found.', 404, 'NOT_FOUND');
      }

      res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/staff/:id
   * ADMIN: Can access any staff record
   * STAFF: Can ONLY access their own staff record.
   *        Blocked with 403 Forbidden on IDOR attempts.
   */
  async getStaffById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const targetId = req.params.id;

      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const isSelf = isSelfStaff(targetId, user);

      if (!isAdmin && !isSelf) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot access records belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const staff = await findStaffByIdentifier(targetId, user);

      if (!staff) {
        throw new AppError(`Staff record not found: ${targetId}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && staff.id !== user.staffRecordId && staff.staff_id !== user.staffId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot access records belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/staff
   * ADMIN ONLY: Create a new Staff member along with User account.
   */
  async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUser = req.user!;
      const validatedData = createStaffSchema.parse(req.body);

      // 1. Uniqueness check for email (in User and Staff)
      const existingUserEmail = await prisma.user.findUnique({
        where: { email: validatedData.email.toLowerCase() },
      });
      if (existingUserEmail) {
        throw new AppError('Email address is already in use by another account.', 400, 'DUPLICATE_EMAIL');
      }

      const existingStaffId = await prisma.staff.findUnique({
        where: { staff_id: validatedData.staff_id.toUpperCase() },
      });
      if (existingStaffId) {
        throw new AppError(`Staff ID '${validatedData.staff_id}' is already registered.`, 400, 'DUPLICATE_STAFF_ID');
      }

      // 2. Validate department existence
      const department = await prisma.department.findUnique({
        where: { id: validatedData.department_id },
      });
      if (!department) {
        throw new AppError(`Department not found with ID '${validatedData.department_id}'.`, 400, 'INVALID_DEPARTMENT');
      }

      // 3. Hash initial password with bcrypt
      const passwordHash = await bcrypt.hash(validatedData.password, 12);

      // 4. Transactional creation of User and Staff
      const newStaff = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: validatedData.email.toLowerCase(),
            password_hash: passwordHash,
            role: validatedData.role as any,
            status: validatedData.status as any,
          },
        });

        const createdStaff = await tx.staff.create({
          data: {
            user_id: createdUser.id,
            staff_id: validatedData.staff_id.toUpperCase(),
            full_name: validatedData.full_name,
            email: validatedData.email.toLowerCase(),
            department_id: validatedData.department_id,
            designation: validatedData.designation,
            qualification: validatedData.qualification || null,
            joining_date: validatedData.joining_date,
            experience: validatedData.experience || null,
            role: validatedData.role,
            status: validatedData.status,
            phone: validatedData.phone || null,
            emergency_contact: validatedData.emergency_contact || null,
            address: validatedData.address || null,
            profile_photo: validatedData.profile_photo || null,
          },
          include: {
            department: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                status: true,
                last_login_at: true,
                created_at: true,
              },
            },
          },
        });

        return createdStaff;
      });

      // 5. Audit Log
      await recordAuditLog({
        userId: adminUser.id,
        action: 'STAFF_CREATED',
        entityType: 'STAFF',
        entityId: newStaff.id,
        afterValue: {
          staff_id: newStaff.staff_id,
          full_name: newStaff.full_name,
          email: newStaff.email,
          role: newStaff.role,
          department_id: newStaff.department_id,
        },
        metadata: { created_by: adminUser.email },
      });

      res.status(201).json({
        success: true,
        message: 'Staff member account created successfully.',
        data: newStaff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/staff/:id & PATCH /api/staff/:id
   * ADMIN: Can update any staff and administrative fields
   * STAFF: Can ONLY update self personal info. Blocked with 403 on IDOR attempts.
   */
  async updateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const targetId = req.params.id;

      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const isSelf = isSelfStaff(targetId, user);

      if (!isAdmin && !isSelf) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot modify records belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const staff = await findStaffByIdentifier(targetId, user);
      if (!staff) {
        throw new AppError(`Staff record not found: ${targetId}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && staff.id !== user.staffRecordId && staff.staff_id !== user.staffId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot modify records belonging to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const validatedData = updateStaffSchema.parse(req.body);

      // Fields allowed for self-update
      const updateData: Record<string, any> = {};
      if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
      if (validatedData.emergency_contact !== undefined) updateData.emergency_contact = validatedData.emergency_contact;
      if (validatedData.address !== undefined) updateData.address = validatedData.address;
      if (validatedData.profile_photo !== undefined) updateData.profile_photo = validatedData.profile_photo;

      // Admin-only fields
      let emailChanged = false;
      let statusChangedToInactive = false;
      let newEmail: string | undefined;
      let newStatus: string | undefined;

      if (isAdmin) {
        if (validatedData.full_name !== undefined) updateData.full_name = validatedData.full_name;
        if (validatedData.designation !== undefined) updateData.designation = validatedData.designation;
        if (validatedData.qualification !== undefined) updateData.qualification = validatedData.qualification;
        if (validatedData.experience !== undefined) updateData.experience = validatedData.experience;

        if (validatedData.department_id !== undefined && validatedData.department_id !== staff.department_id) {
          const dept = await prisma.department.findUnique({ where: { id: validatedData.department_id } });
          if (!dept) {
            throw new AppError(`Department not found: ${validatedData.department_id}`, 400, 'INVALID_DEPARTMENT');
          }
          updateData.department_id = validatedData.department_id;
        }

        if (validatedData.staff_id !== undefined && validatedData.staff_id.toUpperCase() !== staff.staff_id) {
          const duplicate = await prisma.staff.findUnique({
            where: { staff_id: validatedData.staff_id.toUpperCase() },
          });
          if (duplicate) {
            throw new AppError(`Staff ID '${validatedData.staff_id}' already registered.`, 400, 'DUPLICATE_STAFF_ID');
          }
          updateData.staff_id = validatedData.staff_id.toUpperCase();
        }

        if (validatedData.email !== undefined && validatedData.email.toLowerCase() !== staff.email.toLowerCase()) {
          newEmail = validatedData.email.toLowerCase();
          const duplicateUser = await prisma.user.findUnique({ where: { email: newEmail } });
          if (duplicateUser && duplicateUser.id !== staff.user_id) {
            throw new AppError('Email address already registered.', 400, 'DUPLICATE_EMAIL');
          }
          updateData.email = newEmail;
          emailChanged = true;
        }

        if (validatedData.role !== undefined) {
          updateData.role = validatedData.role;
        }

        if (validatedData.status !== undefined) {
          newStatus = validatedData.status;
          updateData.status = newStatus;
          if (newStatus === 'INACTIVE' || newStatus === 'SUSPENDED') {
            statusChangedToInactive = true;
          }
        }
      }

      // Execute update inside a transaction if user record needs updating
      const updated = await prisma.$transaction(async (tx) => {
        if (emailChanged || newStatus || (isAdmin && validatedData.role)) {
          const userUpdate: Record<string, any> = {};
          if (emailChanged && newEmail) userUpdate.email = newEmail;
          if (newStatus) userUpdate.status = newStatus as any;
          if (isAdmin && validatedData.role) userUpdate.role = validatedData.role as any;

          await tx.user.update({
            where: { id: staff.user_id },
            data: userUpdate,
          });
        }

        // If deactivated or suspended, revoke all active sessions
        if (statusChangedToInactive) {
          await tx.userSession.deleteMany({
            where: { user_id: staff.user_id },
          });
        }

        return tx.staff.update({
          where: { id: staff.id },
          data: updateData,
          include: {
            department: true,
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                status: true,
                last_login_at: true,
                created_at: true,
              },
            },
          },
        });
      });

      // Audit Log
      await recordAuditLog({
        userId: user.id,
        action: statusChangedToInactive
          ? 'STAFF_DEACTIVATED'
          : validatedData.status === 'ACTIVE' && staff.status !== 'ACTIVE'
          ? 'STAFF_REACTIVATED'
          : 'STAFF_UPDATED',
        entityType: 'STAFF',
        entityId: staff.id,
        beforeValue: {
          full_name: staff.full_name,
          email: staff.email,
          status: staff.status,
          role: staff.role,
        },
        afterValue: {
          full_name: updated.full_name,
          email: updated.email,
          status: updated.status,
          role: updated.role,
        },
        metadata: { updated_by: user.email },
      });

      res.status(200).json({
        success: true,
        message: 'Staff profile updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/staff/:id
   * ADMIN ONLY: Safe deactivation or permanent deletion preserving historical records.
   */
  async deleteStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) {
        throw new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED');
      }
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        throw new AppError('Access denied. Administrator privileges required.', 403, 'FORBIDDEN');
      }

      const targetId = req.params.id?.trim();
      if (!targetId) {
        throw new AppError('Invalid or missing staff identifier.', 400, 'INVALID_INPUT');
      }

      // 1. Prevent deleting the currently logged-in administrator account
      if (
        isSelfStaff(targetId, user) ||
        targetId.toLowerCase() === 'me' ||
        targetId === user.id ||
        (user.email && targetId.toLowerCase() === user.email.toLowerCase()) ||
        (user.staffRecordId && targetId === user.staffRecordId)
      ) {
        throw new AppError(
          'Operation prohibited: You cannot delete your own active administrator account.',
          400,
          'SELF_DELETION_PROHIBITED'
        );
      }

      // 2. Prevent deleting root / protected system accounts
      const isProtectedIdentifier =
        targetId.toLowerCase() === 'admin@college.demo' ||
        targetId.toLowerCase() === 'admin@institution.edu' ||
        targetId === 'usr-admin-001' ||
        targetId === 'STF-ADMIN-001';

      if (isProtectedIdentifier) {
        throw new AppError(
          'Operation prohibited: Root system administrator accounts are protected and cannot be deleted.',
          403,
          'PROTECTED_SYSTEM_ACCOUNT'
        );
      }

      const staff = await findStaffByIdentifier(targetId, user);
      if (!staff) {
        throw new AppError(`Staff record not found: ${targetId}`, 404, 'NOT_FOUND');
      }

      // Also verify resolved staff user_id and staffRecordId
      if (
        staff.user_id === user.id ||
        (user.staffRecordId && staff.id === user.staffRecordId)
      ) {
        throw new AppError(
          'Operation prohibited: You cannot delete your own active administrator account.',
          400,
          'SELF_DELETION_PROHIBITED'
        );
      }

      const isProtectedSystemAccount =
        staff.email === 'admin@college.demo' ||
        staff.email === 'admin@institution.edu' ||
        staff.staff_id === 'STF-ADMIN-001' ||
        staff.user?.role === 'SUPER_ADMIN' ||
        (staff.user?.role === 'ADMIN' && staff.email.toLowerCase().startsWith('admin@'));

      if (isProtectedSystemAccount) {
        throw new AppError(
          'Operation prohibited: Root system administrator accounts are protected and cannot be deleted.',
          403,
          'PROTECTED_SYSTEM_ACCOUNT'
        );
      }

      // 3. Check for all historical and relational records that must be preserved
      const [
        attendanceCount,
        taskCount,
        activityCount,
        leaveCount,
        timetableCount,
        performanceCount,
        workloadCount,
        aiAlertCount,
        classAlertCount,
        userAuditCount,
        aiRunCount,
        timetableImportCount,
      ] = await Promise.all([
        prisma.attendance.count({ where: { staff_id: staff.id } }),
        prisma.task.count({ where: { assigned_staff_id: staff.id } }),
        prisma.activity.count({ where: { staff_id: staff.id } }),
        prisma.leaveRequest.count({ where: { staff_id: staff.id } }),
        prisma.timetable.count({ where: { staff_id: staff.id } }),
        prisma.performance.count({ where: { staff_id: staff.id } }),
        prisma.workloadMetric.count({ where: { staff_id: staff.id } }),
        prisma.aiAlert.count({ where: { staff_id: staff.id } }),
        prisma.classMonitoringAlert.count({ where: { staff_id: staff.id } }),
        prisma.auditLog.count({ where: { user_id: staff.user_id } }),
        prisma.aiAnalysisRun.count({ where: { user_id: staff.user_id } }),
        prisma.timetableImport.count({ where: { uploaded_by: staff.user_id } }),
      ]);

      const historicalCount =
        attendanceCount +
        taskCount +
        activityCount +
        leaveCount +
        timetableCount +
        performanceCount +
        workloadCount +
        aiAlertCount +
        classAlertCount +
        userAuditCount +
        aiRunCount +
        timetableImportCount;

      const hasHistoricalData = historicalCount > 0;

      if (hasHistoricalData) {
        // Safe deactivation to preserve historical relational integrity
        await prisma.$transaction(async (tx) => {
          await tx.staff.update({
            where: { id: staff.id },
            data: { status: 'INACTIVE' },
          });

          await tx.user.update({
            where: { id: staff.user_id },
            data: { status: 'INACTIVE' as any },
          });

          // Revoke active sessions to immediately terminate access
          await tx.userSession.deleteMany({
            where: { user_id: staff.user_id },
          });
        });

        await recordAuditLog({
          userId: user.id,
          action: 'STAFF_DEACTIVATED',
          entityType: 'STAFF',
          entityId: staff.id,
          beforeValue: { status: staff.status },
          afterValue: { status: 'INACTIVE' },
          metadata: {
            reason: `Preserved ${historicalCount} historical records (attendance: ${attendanceCount}, tasks: ${taskCount}, classes: ${timetableCount}, leaves: ${leaveCount}); account deactivated.`,
          },
        });

        const successMsg = `Staff member ${staff.full_name} deactivated and active sessions revoked (historical records preserved).`;

        return res.status(200).json({
          success: true,
          message: successMsg,
          data: {
            message: successMsg,
            deactivated: true,
            deleted: false,
            staffId: staff.id,
            staff_id: staff.staff_id,
            preservedRecordsCount: historicalCount,
          },
          deactivated: true,
          deleted: false,
        });
      }

      // If no historical records exist, physically delete within transaction
      try {
        await prisma.$transaction(async (tx) => {
          await tx.userSession.deleteMany({ where: { user_id: staff.user_id } });
          await tx.passwordResetToken.deleteMany({ where: { user_id: staff.user_id } });
          await tx.notification.deleteMany({ where: { recipient_user_id: staff.user_id } });
          await tx.operationalAlert.deleteMany({ where: { staff_id: staff.id } });
          await tx.staff.delete({ where: { id: staff.id } });
          await tx.user.delete({ where: { id: staff.user_id } });
        });

        await recordAuditLog({
          userId: user.id,
          action: 'STAFF_DELETED',
          entityType: 'STAFF',
          entityId: staff.id,
          beforeValue: { staff_id: staff.staff_id, email: staff.email, full_name: staff.full_name },
          metadata: { deleted_by: user.email },
        });

        const successMsg = `Staff record for ${staff.full_name} (${staff.staff_id}) deleted permanently.`;

        return res.status(200).json({
          success: true,
          message: successMsg,
          data: {
            message: successMsg,
            deactivated: false,
            deleted: true,
            staffId: staff.id,
            staff_id: staff.staff_id,
          },
          deactivated: false,
          deleted: true,
        });
      } catch (dbError: any) {
        // Fallback for unforeseen foreign key dependencies: safely deactivate
        if (dbError?.code === 'P2003' || dbError?.code === 'P2014') {
          await prisma.$transaction(async (tx) => {
            await tx.staff.update({
              where: { id: staff.id },
              data: { status: 'INACTIVE' },
            });
            await tx.user.update({
              where: { id: staff.user_id },
              data: { status: 'INACTIVE' as any },
            });
            await tx.userSession.deleteMany({
              where: { user_id: staff.user_id },
            });
          });

          await recordAuditLog({
            userId: user.id,
            action: 'STAFF_DEACTIVATED',
            entityType: 'STAFF',
            entityId: staff.id,
            beforeValue: { status: staff.status },
            afterValue: { status: 'INACTIVE' },
            metadata: { reason: 'Foreign key constraint encountered; safely deactivated account instead.' },
          });

          const fallbackMsg = `Staff member ${staff.full_name} has dependent records; account was safely deactivated.`;

          return res.status(200).json({
            success: true,
            message: fallbackMsg,
            data: {
              message: fallbackMsg,
              deactivated: true,
              deleted: false,
              staffId: staff.id,
            },
            deactivated: true,
            deleted: false,
          });
        }
        throw dbError;
      }
    } catch (error) {
      next(error);
    }
  }
}

export const staffController = new StaffController();
