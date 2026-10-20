import { Router } from 'express';
import { systemController } from '../modules/system/system.controller';

const router = Router();

// GET /api/health
router.get('/', (req, res, next) => systemController.healthCheck(req, res, next));

// GET /api/health/info
router.get('/info', (req, res) => systemController.getSystemInfo(req, res));

export default router;
