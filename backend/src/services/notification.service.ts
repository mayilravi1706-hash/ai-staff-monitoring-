import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export interface CreateNotificationOptions {
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  relatedEntity?: string;
  relatedEntityId?: string;
  tx?: any;
}

export class NotificationService {
  /**
   * Create an in-app notification for a user.
   * Enforces recipient validation (active users only) and intelligent deduplication.
   */
  async createNotification(options: CreateNotificationOptions) {
    try {
      const db = options.tx || prisma;

      // 1. Verify recipient exists and is ACTIVE
      const recipient = await db.user.findUnique({
        where: { id: options.recipientUserId },
        select: { id: true, status: true },
      });

      if (!recipient || recipient.status !== 'ACTIVE') {
        logger.warn(
          `Skipped notification for missing or inactive user: ${options.recipientUserId}`,
          'NOTIFICATION_SKIPPED'
        );
        return null;
      }

      // 2. Intelligent Deduplication: Prevent duplicate identical alerts within 10-minute window
      if (options.relatedEntity && options.relatedEntityId) {
        const cooldownThreshold = new Date(Date.now() - 10 * 60 * 1000);
        const existing = await db.notification.findFirst({
          where: {
            recipient_user_id: options.recipientUserId,
            type: options.type,
            related_entity: options.relatedEntity,
            related_entity_id: options.relatedEntityId,
            created_at: { gte: cooldownThreshold },
          },
        });

        if (existing) {
          return existing;
        }
      }

      return await db.notification.create({
        data: {
          recipient_user_id: options.recipientUserId,
          type: options.type,
          title: options.title,
          message: options.message,
          related_entity: options.relatedEntity,
          related_entity_id: options.relatedEntityId,
        },
      });
    } catch (error) {
      logger.error('Failed to create notification', error, 'NOTIFICATION_ERROR');
      return null;
    }
  }

  /**
   * Send notification to staff member by their staff record ID or staff_id code.
   */
  async notifyStaff(
    staffIdentifier: string,
    options: Omit<CreateNotificationOptions, 'recipientUserId'>
  ) {
    try {
      const db = options.tx || prisma;
      const staff = await db.staff.findFirst({
        where: {
          OR: [{ id: staffIdentifier }, { staff_id: staffIdentifier }],
        },
        select: { user_id: true },
      });

      if (!staff || !staff.user_id) {
        logger.warn(`Could not find user_id for staff ${staffIdentifier} to send notification`);
        return null;
      }

      return await this.createNotification({
        ...options,
        recipientUserId: staff.user_id,
      });
    } catch (error) {
      logger.error('Failed to notify staff', error, 'NOTIFICATION_ERROR');
      return null;
    }
  }

  /**
   * Broadcast notification to all active administrators.
   */
  async notifyAdmins(options: Omit<CreateNotificationOptions, 'recipientUserId'>) {
    try {
      const db = options.tx || prisma;
      const adminUsers = await db.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      const promises = adminUsers.map((admin: { id: string }) =>
        this.createNotification({
          ...options,
          recipientUserId: admin.id,
        })
      );

      return await Promise.all(promises);
    } catch (error) {
      logger.error('Failed to notify admins', error, 'NOTIFICATION_ERROR');
      return [];
    }
  }
}

export const notificationService = new NotificationService();
