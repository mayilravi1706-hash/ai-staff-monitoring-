import { Router } from 'express';
import { tasksController } from './tasks.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam, protectIdorBody } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/tasks - supports search, pagination, status, priority, ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => tasksController.getTasks(req, res, next)
);

// POST /api/tasks - Admin only
router.post(
  '/',
  requireAdmin,
  (req, res, next) => tasksController.createTask(req, res, next)
);

// GET /api/tasks/:id - IDOR protected
router.get('/:id', (req, res, next) => tasksController.getTaskById(req, res, next));

// PATCH /api/tasks/:id - IDOR protected (staff can update own; admin can update all)
router.patch('/:id', (req, res, next) => tasksController.updateTask(req, res, next));

// DELETE /api/tasks/:id - Admin only
router.delete(
  '/:id',
  requireAdmin,
  (req, res, next) => tasksController.deleteTask(req, res, next)
);

// GET /api/tasks/:id/updates - IDOR protected
router.get('/:id/updates', (req, res, next) => tasksController.getTaskUpdates(req, res, next));

// POST /api/tasks/:id/updates - Staff (own) or Admin
router.post('/:id/updates', (req, res, next) => tasksController.createTaskUpdate(req, res, next));

export const taskRoutes = router;
