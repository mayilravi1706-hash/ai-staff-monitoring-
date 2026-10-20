import { Router } from 'express';
import { aiController } from './ai.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin, requireStaff } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// Admin AI Copilot (STRICT ADMIN ONLY)
router.post('/admin/chat', requireAdmin, (req, res, next) =>
  aiController.adminChat(req, res, next)
);

// Staff AI Assistant (STRICT STAFF ONLY)
router.post('/staff/chat', requireStaff, (req, res, next) =>
  aiController.staffChat(req, res, next)
);

// AI Health & Configuration Status (ADMIN ONLY)
router.get('/status', requireAdmin, (req, res, next) =>
  aiController.getStatus(req, res, next)
);

// AI Analysis History (Scoped to caller)
router.get('/history', (req, res, next) =>
  aiController.getHistory(req, res, next)
);

// Analysis Details & Evidence Inspection (Scoped/IDOR Protected)
router.get('/analysis/:id', (req, res, next) =>
  aiController.getAnalysisById(req, res, next)
);
router.get('/analysis/:id/evidence', (req, res, next) =>
  aiController.getAnalysisEvidence(req, res, next)
);
router.post('/analysis/:id/feedback', (req, res, next) =>
  aiController.submitFeedback(req, res, next)
);

export const aiRoutes = router;
