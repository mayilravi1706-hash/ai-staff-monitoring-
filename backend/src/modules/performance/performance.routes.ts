import { Router } from 'express';
import { performanceController } from './performance.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/performance/weights
router.get('/weights', (req, res, next) => performanceController.getWeights(req, res, next));

// PUT /api/performance/weights (ADMIN only)
router.put('/weights', requireAdmin, (req, res, next) => performanceController.updateWeights(req, res, next));

// POST /api/performance/calculate/:staffId
router.post('/calculate/:staffId', (req, res, next) => performanceController.calculateStaff(req, res, next));

// GET /api/performance - supports ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => performanceController.getPerformance(req, res, next)
);

// GET /api/performance/:id - IDOR protected
router.get('/:id', (req, res, next) => performanceController.getPerformanceById(req, res, next));

export const performanceRoutes = router;
