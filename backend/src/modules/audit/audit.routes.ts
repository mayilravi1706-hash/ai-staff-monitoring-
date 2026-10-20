import { Router } from 'express';
import { auditController } from './audit.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

// Strictly ADMIN ONLY
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/audit-logs
router.get('/', (req, res, next) => auditController.getAuditLogs(req, res, next));
router.get('/:id', (req, res, next) => auditController.getAuditLogById(req, res, next));

export const auditRoutes = router;
