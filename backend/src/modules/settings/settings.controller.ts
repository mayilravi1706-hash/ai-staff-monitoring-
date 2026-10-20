import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { settingsService } from '../../services/settings.service';
import { AppError } from '../../middleware/errorHandler';

const updateSettingsSchema = z.object({
  category: z.enum(['general', 'monitoring', 'notifications', 'performanceWeights', 'aiFoundation']),
  payload: z.record(z.any()),
});

export class SettingsController {
  /**
   * GET /api/settings - Retrieve all system settings and information
   */
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getAllSettings();
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/settings - Update system settings (STRICT ADMIN ONLY)
   */
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const parsed = updateSettingsSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const { category, payload } = parsed.data;

      const updated = await settingsService.updateSettings(category, payload, user.id);

      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      const errMsg = (error as Error).message || '';
      if (errMsg.includes('100%') || errMsg.includes('Performance weights')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_WEIGHTS', message: errMsg },
        });
      }
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
