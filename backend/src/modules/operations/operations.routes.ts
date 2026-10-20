import { Router } from 'express';
import { operationsController } from './operations.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

// All operational endpoints require authentication
router.use(requireAuth);

// 1. Operational Alerts
// GET /api/operations/alerts (IDOR protected for STAFF)
router.get(
  '/alerts',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res) => operationsController.getAlerts(req, res)
);

// GET /api/operations/alerts/summary
router.get(
  '/alerts/summary',
  (req, res) => operationsController.getAlertSummary(req, res)
);

// POST /api/operations/alerts/:id/acknowledge (ADMIN only)
router.post(
  '/alerts/:id/acknowledge',
  requireAdmin,
  (req, res) => operationsController.acknowledgeAlert(req, res)
);

// POST /api/operations/alerts/:id/resolve (ADMIN only)
router.post(
  '/alerts/:id/resolve',
  requireAdmin,
  (req, res) => operationsController.resolveAlert(req, res)
);

// POST /api/operations/alerts/:id/dismiss (ADMIN only)
router.post(
  '/alerts/:id/dismiss',
  requireAdmin,
  (req, res) => operationsController.dismissAlert(req, res)
);

// 2. Centralized Scheduled Jobs Management (ADMIN only)
// GET /api/operations/jobs
router.get(
  '/jobs',
  requireAdmin,
  (req, res) => operationsController.getScheduledJobs(req, res)
);

// GET /api/operations/jobs/history
router.get(
  '/jobs/history',
  requireAdmin,
  (req, res) => operationsController.getJobHistory(req, res)
);

// POST /api/operations/jobs/:jobName/run
router.post(
  '/jobs/:jobName/run',
  requireAdmin,
  (req, res) => operationsController.triggerJobRun(req, res)
);

// 3. Centralized Operational Configuration (ADMIN only)
// GET /api/operations/config
router.get(
  '/config',
  requireAdmin,
  (req, res) => operationsController.getOperationalConfig(req, res)
);

// PUT /api/operations/config
router.put(
  '/config',
  requireAdmin,
  (req, res) => operationsController.updateOperationalConfig(req, res)
);

// 4. Timetable Conflict Analysis (ADMIN only)
// GET /api/operations/conflicts
router.get(
  '/conflicts',
  requireAdmin,
  (req, res) => operationsController.getTimetableConflicts(req, res)
);

export const operationsRoutes = router;
