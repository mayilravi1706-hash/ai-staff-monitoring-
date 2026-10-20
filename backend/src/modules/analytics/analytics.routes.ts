import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// ==========================================
// ADMIN ANALYTICS ROUTES (ADMIN ONLY)
// ==========================================
router.get('/admin/overview', requireAdmin, (req, res) =>
  analyticsController.getAdminOverview(req, res)
);
router.get('/admin/workload', requireAdmin, (req, res) =>
  analyticsController.getAdminWorkload(req, res)
);
router.get('/admin/performance', requireAdmin, (req, res) =>
  analyticsController.getAdminPerformance(req, res)
);
router.get('/admin/attendance', requireAdmin, (req, res) =>
  analyticsController.getAdminAttendance(req, res)
);
router.get('/admin/tasks', requireAdmin, (req, res) =>
  analyticsController.getAdminTasks(req, res)
);

// ==========================================
// STAFF ANALYTICS ROUTES (IDOR PROTECTED)
// ==========================================
router.get(
  '/staff/overview',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res) => analyticsController.getStaffOverview(req, res)
);
router.get(
  '/staff/workload',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res) => analyticsController.getStaffWorkload(req, res)
);
router.get(
  '/staff/performance',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res) => analyticsController.getStaffPerformance(req, res)
);
router.get(
  '/staff/attendance',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res) => analyticsController.getStaffAttendance(req, res)
);
router.get(
  '/staff/tasks',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res) => analyticsController.getStaffTasks(req, res)
);

export const analyticsRoutes = router;
