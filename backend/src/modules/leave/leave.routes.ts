import { Router } from 'express';
import { leaveController } from './leave.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam, protectIdorBody } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/leave & /api/leave-requests - supports filters and ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => leaveController.getLeaveRequests(req, res, next)
);

// POST /api/leave - IDOR protected
router.post(
  '/',
  protectIdorBody(['staffId', 'staff_id']),
  (req, res, next) => leaveController.createLeaveRequest(req, res, next)
);

// GET /api/leave/:id - IDOR protected
router.get('/:id', (req, res, next) => leaveController.getLeaveRequestById(req, res, next));

// PATCH /api/leave/:id - IDOR protected (Staff own pending / Admin)
router.patch('/:id', (req, res, next) => leaveController.updateLeaveRequest(req, res, next));

// POST /api/leave/:id/approve - ADMIN only
router.post(
  '/:id/approve',
  requireAdmin,
  (req, res, next) => leaveController.approveLeave(req, res, next)
);

// POST /api/leave/:id/reject - ADMIN only
router.post(
  '/:id/reject',
  requireAdmin,
  (req, res, next) => leaveController.rejectLeave(req, res, next)
);

// POST /api/leave/:id/cancel - Staff (own pending) or Admin
router.post('/:id/cancel', (req, res, next) => leaveController.cancelLeave(req, res, next));

export const leaveRoutes = router;
