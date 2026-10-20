import { Router } from 'express';
import { activityController } from './activity.controller';
import { requireAuth } from '../../middleware/auth';
import { protectIdorQueryParam, protectIdorBody } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/activity/current - current active activity & expected class (IDOR protected)
router.get(
  '/current',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => activityController.getCurrentActivity(req, res, next)
);

// GET /api/activity - supports ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => activityController.getActivities(req, res, next)
);

// GET /api/activity/:id - IDOR protected
router.get('/:id', (req, res, next) => activityController.getActivityById(req, res, next));

// POST /api/activity - IDOR protected
router.post(
  '/',
  protectIdorBody(['staffId', 'staff_id']),
  (req, res, next) => activityController.logActivity(req, res, next)
);

// PATCH /api/activity/:id - IDOR protected
router.patch(
  '/:id',
  protectIdorBody(['staffId', 'staff_id']),
  (req, res, next) => activityController.updateActivity(req, res, next)
);

export const activityRoutes = router;
