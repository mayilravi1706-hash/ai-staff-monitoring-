import { Router } from 'express';
import { monitoringController } from './monitoring.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/monitoring/alerts - list alerts (IDOR protected)
router.get(
  '/alerts',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => monitoringController.getAlerts(req, res, next)
);

// PATCH /api/monitoring/alerts/:id - acknowledge / resolve
router.patch('/alerts/:id', (req, res, next) => monitoringController.updateAlert(req, res, next));

// GET /api/monitoring/grace-period - view grace period setting
router.get('/grace-period', (req, res, next) => monitoringController.getGracePeriod(req, res, next));

// PATCH /api/monitoring/grace-period - ADMIN only: update grace period
router.patch(
  '/grace-period',
  requireAdmin,
  (req, res, next) => monitoringController.updateGracePeriod(req, res, next)
);

export const monitoringRoutes = router;
