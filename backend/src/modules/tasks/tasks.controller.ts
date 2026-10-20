import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import { tasksService } from '../../services/tasks.service';
import { notificationService } from '../../services/notification.service';
import { workloadService } from '../../services/workload.service';
import {
  createTaskSchema,
  updateTaskSchema,
  createTaskUpdateSchema,
} from './tasks.validation';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class TasksController {
  /**
   * GET /api/tasks
   * ADMIN: All tasks across the institution, with extensive filters.
   * STAFF: ONLY tasks assigned to authenticated staff member. Blocked with 403 on IDOR attempts.
   */
  async getTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      // Deterministically sync overdue status based on server time
      await tasksService.syncOverdueTasks();

      const requestedStaffId = (req.query.staffId as string) || (req.query.staff_id as string);

      if (!isAdmin && requestedStaffId) {
        const isSelf =
          (user.staffRecordId && requestedStaffId === user.staffRecordId) ||
          (user.staffId && requestedStaffId === user.staffId) ||
          requestedStaffId === 'me';

        if (!isSelf) {
          throw new AppError(
            'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view tasks assigned to another staff member.',
            403,
            'FORBIDDEN'
          );
        }
      }

      // Base query scope
      const where: any = {};

      if (!isAdmin) {
        where.assigned_staff_id = user.staffRecordId || 'none';
      } else if (requestedStaffId) {
        const staff = await prisma.staff.findFirst({
          where: {
            OR: [{ id: requestedStaffId }, { staff_id: requestedStaffId }],
          },
        });
        where.assigned_staff_id = staff ? staff.id : requestedStaffId;
      }

      // Department filter (Admin only or scoped)
      const departmentId = (req.query.departmentId as string) || (req.query.department_id as string);
      if (departmentId) {
        where.assigned_staff = {
          department_id: departmentId,
        };
      }

      // Status filter
      const statusParam = req.query.status as string;
      if (statusParam && Object.values(TaskStatus).includes(statusParam as TaskStatus)) {
        where.status = statusParam as TaskStatus;
      }

      // Priority filter
      const priorityParam = req.query.priority as string;
      if (priorityParam && Object.values(TaskPriority).includes(priorityParam as TaskPriority)) {
        where.priority = priorityParam as TaskPriority;
      }

      // Overdue filter
      const isOverdue = req.query.isOverdue as string;
      if (isOverdue === 'true') {
        where.status = TaskStatus.OVERDUE;
      }

      // Search term filter (title, description, category)
      const search = req.query.search as string;
      if (search && search.trim()) {
        const query = search.trim();
        where.OR = [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ];
      }

      // Pagination
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
      const skip = (page - 1) * pageSize;

      // Sorting
      const sortBy = (req.query.sortBy as string) || 'due_date';
      const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';
      const orderBy: any = [];

      if (sortBy === 'priority') {
        orderBy.push({ priority: sortOrder });
        orderBy.push({ due_date: 'asc' });
      } else if (sortBy === 'created_at') {
        orderBy.push({ created_at: sortOrder });
      } else {
        orderBy.push({ due_date: sortOrder });
      }

      // Execute task fetch & total count
      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
          include: {
            assigned_staff: {
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
            updates: {
              orderBy: { created_at: 'desc' },
              take: 5,
            },
          },
        }),
        prisma.task.count({ where }),
      ]);

      // Calculate aggregated metrics from PostgreSQL for the authorized scope
      const baseScopeWhere = !isAdmin
        ? { assigned_staff_id: user.staffRecordId || 'none' }
        : requestedStaffId
        ? {
            assigned_staff_id: (
              await prisma.staff.findFirst({
                where: { OR: [{ id: requestedStaffId }, { staff_id: requestedStaffId }] },
              })
            )?.id || requestedStaffId,
          }
        : {};

      const [
        totalInScope,
        pendingCount,
        inProgressCount,
        completedCount,
        overdueCount,
        highPriorityCount,
        urgentCount,
      ] = await Promise.all([
        prisma.task.count({ where: baseScopeWhere }),
        prisma.task.count({ where: { ...baseScopeWhere, status: TaskStatus.PENDING } }),
        prisma.task.count({ where: { ...baseScopeWhere, status: TaskStatus.IN_PROGRESS } }),
        prisma.task.count({ where: { ...baseScopeWhere, status: TaskStatus.COMPLETED } }),
        prisma.task.count({ where: { ...baseScopeWhere, status: TaskStatus.OVERDUE } }),
        prisma.task.count({ where: { ...baseScopeWhere, priority: TaskPriority.HIGH } }),
        prisma.task.count({ where: { ...baseScopeWhere, priority: TaskPriority.URGENT } }),
      ]);

      res.status(200).json({
        success: true,
        data: tasks,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
          counts: {
            total: totalInScope,
            pending: pendingCount,
            inProgress: inProgressCount,
            completed: completedCount,
            overdue: overdueCount,
            highPriority: highPriorityCount,
            urgent: urgentCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks/:id
   */
  async getTaskById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          assigned_staff: {
            select: {
              id: true,
              staff_id: true,
              full_name: true,
              designation: true,
              department: true,
            },
          },
          updates: {
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!task) {
        throw new AppError(`Task not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && task.assigned_staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view tasks assigned to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      // Check deterministic status update
      const calculatedStatus = tasksService.calculateTaskStatus(task.status, task.due_date);
      if (calculatedStatus !== task.status) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: calculatedStatus },
        });
        task.status = calculatedStatus;
      }

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/tasks
   * ADMIN only: Create task for an active staff member.
   */
  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      if (!isAdmin) {
        throw new AppError(
          'Access denied. Only administrators can create institutional tasks.',
          403,
          'FORBIDDEN'
        );
      }

      const validated = createTaskSchema.parse(req.body);

      // Verify assigned staff exists and is active
      const staff = await prisma.staff.findFirst({
        where: {
          OR: [{ id: validated.assigned_staff_id }, { staff_id: validated.assigned_staff_id }],
        },
        include: { user: true },
      });

      if (!staff) {
        throw new AppError(
          `Assigned staff member not found: ${validated.assigned_staff_id}`,
          404,
          'STAFF_NOT_FOUND'
        );
      }

      if (staff.status !== 'ACTIVE' || staff.user.status !== 'ACTIVE') {
        throw new AppError(
          `Cannot assign task: Staff member ${staff.full_name} (${staff.staff_id}) is deactivated or inactive.`,
          400,
          'STAFF_INACTIVE'
        );
      }

      const dueDateObj = new Date(validated.due_date);
      const initialStatus = tasksService.calculateTaskStatus(TaskStatus.PENDING, dueDateObj);

      // Execute creation in transaction
      const createdTask = await prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            title: validated.title,
            description: validated.description || null,
            assigned_staff_id: staff.id,
            assigned_by: user.id,
            due_date: dueDateObj,
            priority: validated.priority,
            category: validated.category || null,
            remarks: validated.remarks || null,
            status: initialStatus,
          },
          include: {
            assigned_staff: {
              select: {
                id: true,
                staff_id: true,
                full_name: true,
                designation: true,
              },
            },
          },
        });

        // Create initial TaskUpdate entry
        await tx.taskUpdate.create({
          data: {
            task_id: task.id,
            old_status: null,
            new_status: initialStatus,
            changed_by: user.staffRecordId || user.id,
            remarks: validated.remarks || `Task created and assigned by ${user.email}`,
          },
        });

        // Create Notification for the assigned staff member
        if (staff.user_id) {
          await tx.notification.create({
            data: {
              recipient_user_id: staff.user_id,
              type: 'TASK_ASSIGNED',
              title: 'New Task Assigned',
              message: `You have been assigned: "${task.title}". Priority: ${task.priority}. Due: ${dueDateObj.toISOString().split('T')[0]}.`,
              related_entity: 'TASK',
              related_entity_id: task.id,
            },
          });
        }

        // Record Audit Trail
        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'TASK_CREATED',
          entityType: 'TASK',
          entityId: task.id,
          afterValue: task,
          metadata: {
            assignedTo: staff.staff_id,
            priority: task.priority,
            dueDate: task.due_date,
          },
        });

        return task;
      });

      // Recalculate workload impact
      await workloadService.recalculateWorkload(staff.id);

      res.status(201).json({
        success: true,
        message: 'Task created and assigned successfully.',
        data: createdTask,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/tasks/:id
   * ADMIN: Can update details, priority, due date, status, reassignment.
   * STAFF: Can only update their own assigned tasks' status and remarks.
   */
  async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const validated = updateTaskSchema.parse(req.body);

      const existingTask = await prisma.task.findUnique({
        where: { id },
        include: {
          assigned_staff: true,
        },
      });

      if (!existingTask) {
        throw new AppError(`Task not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && existingTask.assigned_staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot modify tasks assigned to another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      // If status change requested, validate deterministic transition
      if (validated.status && validated.status !== existingTask.status) {
        const transition = tasksService.validateStatusTransition(
          existingTask.status,
          validated.status,
          isAdmin
        );
        if (!transition.allowed) {
          throw new AppError(transition.reason || 'Invalid status transition.', 400, 'BAD_REQUEST');
        }
      }

      // If reassignment requested (Admin only)
      let newAssigneeStaff: any = null;
      if (validated.assigned_staff_id && validated.assigned_staff_id !== existingTask.assigned_staff_id) {
        if (!isAdmin) {
          throw new AppError('Only administrators can reassign tasks.', 403, 'FORBIDDEN');
        }

        newAssigneeStaff = await prisma.staff.findFirst({
          where: {
            OR: [{ id: validated.assigned_staff_id }, { staff_id: validated.assigned_staff_id }],
          },
          include: { user: true },
        });

        if (!newAssigneeStaff) {
          throw new AppError(
            `New assignee staff member not found: ${validated.assigned_staff_id}`,
            404,
            'STAFF_NOT_FOUND'
          );
        }

        if (newAssigneeStaff.status !== 'ACTIVE' || newAssigneeStaff.user.status !== 'ACTIVE') {
          throw new AppError(
            `Cannot reassign task: Staff member ${newAssigneeStaff.full_name} is inactive.`,
            400,
            'STAFF_INACTIVE'
          );
        }
      }

      const updateData: any = {};

      if (validated.status) {
        updateData.status = validated.status;
        if (validated.status === TaskStatus.COMPLETED) {
          updateData.completed_at = new Date();
        } else if (existingTask.status === TaskStatus.COMPLETED) {
          updateData.completed_at = null; // Reopening
        }
      }

      if (isAdmin) {
        if (validated.title !== undefined) updateData.title = validated.title;
        if (validated.description !== undefined) updateData.description = validated.description;
        if (validated.due_date !== undefined) updateData.due_date = new Date(validated.due_date);
        if (validated.priority !== undefined) updateData.priority = validated.priority;
        if (validated.category !== undefined) updateData.category = validated.category;
        if (validated.remarks !== undefined) updateData.remarks = validated.remarks;
        if (newAssigneeStaff) updateData.assigned_staff_id = newAssigneeStaff.id;
      } else {
        // Staff remarks
        if (validated.remarks !== undefined) updateData.remarks = validated.remarks;
      }

      // Perform update in transaction
      const updatedTask = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id },
          data: updateData,
          include: {
            assigned_staff: {
              select: {
                id: true,
                staff_id: true,
                full_name: true,
                designation: true,
              },
            },
          },
        });

        // Create immutable TaskUpdate if status changed or remarks provided
        const statusChanged = validated.status && validated.status !== existingTask.status;
        if (statusChanged || validated.remarks) {
          await tx.taskUpdate.create({
            data: {
              task_id: id,
              old_status: existingTask.status,
              new_status: updated.status,
              changed_by: user.staffRecordId || user.id,
              remarks: validated.remarks || `Status changed from ${existingTask.status} to ${updated.status}`,
            },
          });
        }

        // Handle Notifications
        if (newAssigneeStaff && newAssigneeStaff.user_id) {
          // Notify new staff member
          await tx.notification.create({
            data: {
              recipient_user_id: newAssigneeStaff.user_id,
              type: 'TASK_ASSIGNED',
              title: 'Task Reassigned To You',
              message: `Task "${updated.title}" has been reassigned to you. Priority: ${updated.priority}.`,
              related_entity: 'TASK',
              related_entity_id: updated.id,
            },
          });

          // Notify previous staff member
          if (existingTask.assigned_staff.user_id) {
            await tx.notification.create({
              data: {
                recipient_user_id: existingTask.assigned_staff.user_id,
                type: 'TASK_REASSIGNED',
                title: 'Task Reassigned',
                message: `Task "${updated.title}" has been reassigned to another staff member.`,
                related_entity: 'TASK',
                related_entity_id: updated.id,
              },
            });
          }
        } else if (statusChanged) {
          // If staff marked it completed, notify admins
          if (!isAdmin && updated.status === TaskStatus.COMPLETED) {
            const admins = await tx.user.findMany({
              where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
              select: { id: true },
            });
            for (const admin of admins) {
              await tx.notification.create({
                data: {
                  recipient_user_id: admin.id,
                  type: 'TASK_COMPLETED',
                  title: 'Task Completed by Faculty',
                  message: `${existingTask.assigned_staff.full_name} completed task: "${updated.title}".`,
                  related_entity: 'TASK',
                  related_entity_id: updated.id,
                },
              });
            }
          } else if (isAdmin && existingTask.assigned_staff.user_id) {
            // Admin updated staff task status
            await tx.notification.create({
              data: {
                recipient_user_id: existingTask.assigned_staff.user_id,
                type: 'TASK_UPDATED',
                title: 'Task Updated by Administrator',
                message: `Your task "${updated.title}" was updated to ${updated.status}.`,
                related_entity: 'TASK',
                related_entity_id: updated.id,
              },
            });
          }
        }

        // Record Audit Log
        await recordAuditLog({
          tx,
          userId: user.id,
          action: newAssigneeStaff ? 'TASK_REASSIGNED' : 'TASK_STATUS_UPDATED',
          entityType: 'TASK',
          entityId: updated.id,
          beforeValue: existingTask,
          afterValue: updated,
          metadata: {
            statusChanged,
            reassigned: !!newAssigneeStaff,
          },
        });

        return updated;
      });

      // Recalculate workload impact
      await workloadService.recalculateWorkload(existingTask.assigned_staff_id);
      if (newAssigneeStaff) {
        await workloadService.recalculateWorkload(newAssigneeStaff.id);
      }

      res.status(200).json({
        success: true,
        message: 'Task updated successfully.',
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/tasks/:id
   * ADMIN only: Remove task and its history cleanly.
   */
  async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

      if (!isAdmin) {
        throw new AppError(
          'Access denied. Only administrators can delete institutional tasks.',
          403,
          'FORBIDDEN'
        );
      }

      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id },
        include: { assigned_staff: true },
      });

      if (!task) {
        throw new AppError(`Task not found: ${id}`, 404, 'NOT_FOUND');
      }

      await prisma.$transaction(async (tx) => {
        // Cascade delete updates
        await tx.taskUpdate.deleteMany({
          where: { task_id: id },
        });

        // Delete task
        await tx.task.delete({
          where: { id },
        });

        // Record Audit
        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'TASK_DELETED',
          entityType: 'TASK',
          entityId: id,
          beforeValue: task,
        });
      });

      // Recalculate workload
      await workloadService.recalculateWorkload(task.assigned_staff_id);

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tasks/:id/updates
   */
  async getTaskUpdates(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id },
      });

      if (!task) {
        throw new AppError(`Task not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && task.assigned_staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot view task updates for another staff member.',
          403,
          'FORBIDDEN'
        );
      }

      const updates = await prisma.taskUpdate.findMany({
        where: { task_id: id },
        orderBy: { created_at: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: updates,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/tasks/:id/updates
   * Adds an update/comment entry to the task.
   */
  async createTaskUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const { id } = req.params;

      const validated = createTaskUpdateSchema.parse(req.body);

      const task = await prisma.task.findUnique({
        where: { id },
        include: { assigned_staff: true },
      });

      if (!task) {
        throw new AppError(`Task not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (!isAdmin && task.assigned_staff_id !== user.staffRecordId) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot post updates to another staff member’s task.',
          403,
          'FORBIDDEN'
        );
      }

      let newStatus = task.status;
      if (validated.new_status && validated.new_status !== task.status) {
        const transition = tasksService.validateStatusTransition(
          task.status,
          validated.new_status,
          isAdmin
        );
        if (!transition.allowed) {
          throw new AppError(transition.reason || 'Invalid status transition.', 400, 'BAD_REQUEST');
        }
        newStatus = validated.new_status;
      }

      const updateRecord = await prisma.$transaction(async (tx) => {
        if (newStatus !== task.status) {
          await tx.task.update({
            where: { id },
            data: {
              status: newStatus,
              completed_at: newStatus === TaskStatus.COMPLETED ? new Date() : undefined,
            },
          });
        }

        const createdUpdate = await tx.taskUpdate.create({
          data: {
            task_id: id,
            old_status: task.status,
            new_status: newStatus,
            changed_by: user.staffRecordId || user.id,
            remarks: validated.remarks,
          },
        });

        await recordAuditLog({
          tx,
          userId: user.id,
          action: 'TASK_UPDATE_POSTED',
          entityType: 'TASK_UPDATE',
          entityId: createdUpdate.id,
          afterValue: createdUpdate,
        });

        return createdUpdate;
      });

      if (newStatus !== task.status) {
        await workloadService.recalculateWorkload(task.assigned_staff_id);
      }

      res.status(201).json({
        success: true,
        message: 'Task update recorded successfully.',
        data: updateRecord,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tasksController = new TasksController();
