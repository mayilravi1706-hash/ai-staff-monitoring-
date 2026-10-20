import { Router } from 'express';
import { workloadController } from './workload.controller';
import { requireAuth } from '../../middleware/auth';
import { protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/workload - supports ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => workloadController.getWorkload(req, res, next)
);

// GET /api/workload/:id - IDOR protected
router.get('/:id', (req, res, next) => workloadController.getWorkloadById(req, res, next));

export const workloadRoutes = router;
