import { Request, Response, NextFunction } from 'express';
import { systemService } from './system.service';

export class SystemController {
  async healthCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const healthData = await systemService.getHealth();
      
      // Response adheres strictly to:
      // {
      //   "success": true,
      //   "data": {
      //     "status": "ok",
      //     ...
      //   }
      // }
      res.status(200).json({
        success: true,
        data: healthData,
      });
    } catch (error) {
      next(error);
    }
  }

  getSystemInfo(req: Request, res: Response) {
    const info = systemService.getSystemInfo();
    res.status(200).json({
      success: true,
      data: info,
    });
  }
}

export const systemController = new SystemController();
