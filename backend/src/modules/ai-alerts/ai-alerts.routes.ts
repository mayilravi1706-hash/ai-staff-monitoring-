import { Router } from 'express';
import { aiAlertsController } from './ai-alerts.controller';
import { requireAuth } from '../../middleware/auth';
import { protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/ai-alerts - supports ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => aiAlertsController.getAiAlerts(req, res, next)
);

// GET /api/ai-alerts/:id - IDOR protected
router.get('/:id', (req, res, next) => aiAlertsController.getAiAlertById(req, res, next));

export const aiAlertRoutes = router;
