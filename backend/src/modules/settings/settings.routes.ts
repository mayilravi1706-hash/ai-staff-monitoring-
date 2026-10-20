import { Router } from 'express';
import { settingsController } from './settings.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

router.use(requireAuth);

// GET /api/settings - Authenticated users can view safe system settings
router.get('/', (req, res, next) => settingsController.getSettings(req, res, next));

// PUT /api/settings - STRICT ADMIN ONLY
router.put('/', requireAdmin, (req, res, next) =>
  settingsController.updateSettings(req, res, next)
);

export const settingsRoutes = router;
