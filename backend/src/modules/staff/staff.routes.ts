import { Router } from 'express';
import { staffController } from './staff.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, requireSelfOrAdmin } from '../../middleware/rbac';

const router = Router();

// All staff endpoints require valid authentication
router.use(requireAuth);

// GET /api/staff - List staff (Admin sees all, Staff sees own)
router.get('/', (req, res, next) => staffController.getAllStaff(req, res, next));

// GET /api/staff/me - Authenticated user's profile
router.get('/me', (req, res, next) => staffController.getMyProfile(req, res, next));

// POST /api/staff - ADMIN ONLY: Create staff member and user account
router.post('/', requireAdmin, (req, res, next) => staffController.createStaff(req, res, next));

// GET /api/staff/:id - Admin can view all, Staff can only view own (IDOR protected)
router.get(
  '/:id',
  requireSelfOrAdmin(),
  (req, res, next) => staffController.getStaffById(req, res, next)
);

// PUT /api/staff/:id & PATCH /api/staff/:id - Admin can update any, Staff can only update own (IDOR protected)
router.put(
  '/:id',
  requireSelfOrAdmin(),
  (req, res, next) => staffController.updateStaff(req, res, next)
);

router.patch(
  '/:id',
  requireSelfOrAdmin(),
  (req, res, next) => staffController.updateStaff(req, res, next)
);

// DELETE /api/staff/:id - ADMIN ONLY: Safe deactivation / deletion
router.delete('/:id', requireAdmin, (req, res, next) => staffController.deleteStaff(req, res, next));

export const staffRoutes = router;
