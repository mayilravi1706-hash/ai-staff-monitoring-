import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import { requireAuth } from '../../middleware/auth';
import { protectIdorQueryParam, protectIdorBody } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/attendance - supports ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => attendanceController.getAttendance(req, res, next)
);

// GET /api/attendance/:id - IDOR protected
router.get('/:id', (req, res, next) => attendanceController.getAttendanceById(req, res, next));

// POST /api/attendance - IDOR protected
router.post(
  '/',
  protectIdorBody(['staffId', 'staff_id']),
  (req, res, next) => attendanceController.markAttendance(req, res, next)
);

// PATCH /api/attendance/:id - IDOR protected
router.patch(
  '/:id',
  protectIdorBody(['staffId', 'staff_id']),
  (req, res, next) => attendanceController.updateAttendance(req, res, next)
);

export const attendanceRoutes = router;
