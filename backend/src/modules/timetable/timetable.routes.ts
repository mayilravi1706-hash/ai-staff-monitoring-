import { Router } from 'express';
import multer from 'multer';
import { timetableController } from './timetable.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, protectIdorQueryParam } from '../../middleware/rbac';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max as specified in requirements
});

const router = Router();

router.use(requireAuth);

// Admin-only PDF upload endpoints (placed before /:id)
router.post(
  '/upload/pdf',
  requireAdmin,
  upload.single('file'),
  (req, res, next) => timetableController.uploadTimetablePdf(req, res, next)
);

router.post(
  '/upload/confirm',
  requireAdmin,
  (req, res, next) => timetableController.confirmTimetableImport(req, res, next)
);

router.get(
  '/upload/history',
  requireAdmin,
  (req, res, next) => timetableController.getTimetableImportHistory(req, res, next)
);

// GET /api/timetable/current-class - supports ?staffId=... (IDOR protected)
router.get(
  '/current-class',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => timetableController.getCurrentClass(req, res, next)
);

// GET /api/timetable/coverage - today's class coverage
router.get(
  '/coverage',
  (req, res, next) => timetableController.getClassCoverage(req, res, next)
);

// GET /api/timetable - supports ?staffId=... (IDOR protected)
router.get(
  '/',
  protectIdorQueryParam(['staffId', 'staff_id']),
  (req, res, next) => timetableController.getTimetable(req, res, next)
);

// GET /api/timetable/:id - IDOR protected
router.get('/:id', (req, res, next) => timetableController.getTimetableById(req, res, next));

// POST /api/timetable - ADMIN ONLY: Create timetable entry
router.post('/', requireAdmin, (req, res, next) => timetableController.createTimetable(req, res, next));

// PATCH & PUT /api/timetable/:id - ADMIN ONLY: Update timetable entry
router.patch('/:id', requireAdmin, (req, res, next) => timetableController.updateTimetable(req, res, next));
router.put('/:id', requireAdmin, (req, res, next) => timetableController.updateTimetable(req, res, next));

// DELETE /api/timetable/:id - ADMIN ONLY: Delete timetable entry
router.delete('/:id', requireAdmin, (req, res, next) => timetableController.deleteTimetable(req, res, next));

export const timetableRoutes = router;
