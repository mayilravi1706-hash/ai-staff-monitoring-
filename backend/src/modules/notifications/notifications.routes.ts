import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => notificationsController.getMyNotifications(req, res, next));
router.get('/unread-count', (req, res, next) => notificationsController.getUnreadCount(req, res, next));
router.patch('/:id/read', (req, res, next) => notificationsController.markAsRead(req, res, next));
router.post('/read-all', (req, res, next) => notificationsController.markAllAsRead(req, res, next));
router.patch('/read-all', (req, res, next) => notificationsController.markAllAsRead(req, res, next));

export const notificationRoutes = router;
