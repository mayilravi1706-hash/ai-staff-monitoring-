import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class NotificationsController {
  /**
   * GET /api/notifications
   * Staff/Admin can ONLY access their own notifications.
   */
  async getMyNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

      const where: any = { recipient_user_id: user.id };
      if (unreadOnly) {
        where.read_at = null;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
        }),
        prisma.notification.count({ where: { recipient_user_id: user.id } }),
        prisma.notification.count({ where: { recipient_user_id: user.id, read_at: null } }),
      ]);

      res.status(200).json({
        success: true,
        data: notifications,
        meta: {
          total,
          unreadCount,
          count: notifications.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const count = await prisma.notification.count({
        where: {
          recipient_user_id: user.id,
          read_at: null,
        },
      });

      res.status(200).json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark a notification as read.
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        throw new AppError(`Notification not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (notification.recipient_user_id !== user.id) {
        throw new AppError(
          'Access denied. Insecure Direct Object Reference (IDOR) blocked: You cannot mark another user’s notification as read.',
          403,
          'FORBIDDEN'
        );
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { read_at: new Date() },
      });

      res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read for current user.
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;

      const result = await prisma.notification.updateMany({
        where: {
          recipient_user_id: user.id,
          read_at: null,
        },
        data: {
          read_at: new Date(),
        },
      });

      res.status(200).json({
        success: true,
        message: `Marked ${result.count} notification(s) as read.`,
        data: { count: result.count },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();
