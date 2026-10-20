import { Router } from 'express';
import { reportsController } from './reports.controller';
import { requireAuth } from '../../middleware/auth';
import { protectIdorQueryParam } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// Standard Report Endpoints
router.post('/', (req, res, next) => reportsController.generateReport(req, res, next));
router.post('/generate', (req, res, next) => reportsController.generateReport(req, res, next));
router.get('/', (req, res, next) => reportsController.getReportHistory(req, res, next));
router.get('/:id', (req, res, next) => reportsController.getReportById(req, res, next));
router.get('/:id/download', (req, res, next) => reportsController.downloadReport(req, res, next));
router.get('/:id/export', (req, res, next) => reportsController.downloadReport(req, res, next));
router.delete('/:id', (req, res, next) => reportsController.deleteReport(req, res, next));

// Specialized Direct Export Routes (with IDOR protection query parameter enforcement)
router.get(
  '/attendance',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('ATTENDANCE', req, res, next)
);
router.get(
  '/tasks',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('TASK', req, res, next)
);
router.get(
  '/leave',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('LEAVE', req, res, next)
);
router.get(
  '/workload',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('WORKLOAD', req, res, next)
);
router.get(
  '/performance',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('PERFORMANCE', req, res, next)
);
router.get(
  '/timetable',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('TIMETABLE', req, res, next)
);
router.get(
  '/class-coverage',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('CLASS_COVERAGE', req, res, next)
);
router.get(
  '/alerts',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => reportsController.streamDirectReport('OPERATIONAL_ALERT', req, res, next)
);

export const reportsRoutes = router;
