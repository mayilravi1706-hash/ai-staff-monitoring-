import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class TasksService {
  /**
   * Deterministically calculates task status based on server time and current status.
   * Completed tasks are never marked overdue.
   */
  calculateTaskStatus(status: TaskStatus, dueDate: Date | string): TaskStatus {
    if (status === TaskStatus.COMPLETED) {
      return TaskStatus.COMPLETED;
    }

    const serverNow = new Date();
    const dueTime = new Date(dueDate).getTime();

    if (!isNaN(dueTime) && serverNow.getTime() > dueTime) {
      return TaskStatus.OVERDUE;
    }

    return status;
  }

  /**
   * Validates deterministic status transitions.
   *
   * Allowed flows:
   * PENDING -> IN_PROGRESS -> COMPLETED
   * PENDING -> COMPLETED
   * OVERDUE -> COMPLETED
   * OVERDUE -> IN_PROGRESS
   *
   * COMPLETED -> IN_PROGRESS is forbidden unless explicitly reopened by ADMIN.
   * OVERDUE cannot be selected manually as a user-chosen status.
   */
  validateStatusTransition(
    currentStatus: TaskStatus,
    targetStatus: TaskStatus,
    isAdmin: boolean
  ): { allowed: boolean; reason?: string } {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    // OVERDUE is a deterministic engine status, not a manual user selection
    if (targetStatus === TaskStatus.OVERDUE) {
      return {
        allowed: false,
        reason:
          'OVERDUE status is calculated deterministically by the system based on server time and due date. It cannot be manually set.',
      };
    }

    // Handling transitions from COMPLETED
    if (currentStatus === TaskStatus.COMPLETED) {
      if (isAdmin && (targetStatus === TaskStatus.IN_PROGRESS || targetStatus === TaskStatus.PENDING)) {
        return { allowed: true }; // Admin reopening workflow
      }
      return {
        allowed: false,
        reason:
          'Invalid status transition: Completed tasks cannot be moved back to in progress or pending. Only administrators can reopen completed tasks.',
      };
    }

    // Handling transitions from PENDING
    if (currentStatus === TaskStatus.PENDING) {
      if (targetStatus === TaskStatus.IN_PROGRESS || targetStatus === TaskStatus.COMPLETED) {
        return { allowed: true };
      }
    }

    // Handling transitions from IN_PROGRESS
    if (currentStatus === TaskStatus.IN_PROGRESS) {
      if (targetStatus === TaskStatus.COMPLETED || targetStatus === TaskStatus.PENDING) {
        return { allowed: true };
      }
    }

    // Handling transitions from OVERDUE
    if (currentStatus === TaskStatus.OVERDUE) {
      if (targetStatus === TaskStatus.COMPLETED || targetStatus === TaskStatus.IN_PROGRESS) {
        return { allowed: true };
      }
    }

    return {
      allowed: false,
      reason: `Invalid status transition from ${currentStatus} to ${targetStatus}.`,
    };
  }

  /**
   * Syncs overdue tasks in the database deterministically using server time.
   */
  async syncOverdueTasks(tx?: any): Promise<number> {
    try {
      const db = tx || prisma;
      const now = new Date();

      const result = await db.task.updateMany({
        where: {
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          due_date: { lt: now },
        },
        data: {
          status: TaskStatus.OVERDUE,
        },
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to sync overdue tasks', error, 'TASK_OVERDUE_SYNC_ERROR');
      return 0;
    }
  }
}

export const tasksService = new TasksService();
