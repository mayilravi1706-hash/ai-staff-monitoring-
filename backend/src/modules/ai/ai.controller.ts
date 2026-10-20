import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiOrchestratorService } from '../../services/aiOrchestrator.service';
import { aiConfigService } from '../../services/aiConfig.service';
import { createAuditLog } from '../audit/audit.service';
import { AppError } from '../../middleware/errorHandler';

const historyItemSchema = z.object({
  sender: z.enum(['user', 'ai']),
  text: z.string().max(1000),
});

const chatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt exceeds 1000 characters limit'),
  history: z.array(historyItemSchema).optional(),
});

const feedbackSchema = z.object({
  rating: z.enum(['HELPFUL', 'NOT_HELPFUL', 'INCORRECT', 'ISSUE']),
  comment: z.string().max(500).optional(),
});

export class AiController {
  /**
   * POST /api/ai/admin/chat
   * STRICT ADMIN ONLY: Admin AI Copilot for organization-level operational intelligence.
   */
  async adminChat(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const result = await aiOrchestratorService.processAiQuery(
        {
          id: user.id,
          role: user.role,
          staffRecordId: user.staffRecordId || undefined,
          email: user.email,
        },
        parsed.data.prompt,
        parsed.data.history || []
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ai/staff/chat
   * STRICT STAFF ONLY: Staff AI Assistant for authenticated staff member's own data.
   */
  async staffChat(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      const result = await aiOrchestratorService.processAiQuery(
        {
          id: user.id,
          role: user.role,
          staffRecordId: user.staffRecordId || undefined,
          email: user.email,
        },
        parsed.data.prompt,
        parsed.data.history || []
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ai/status
   * STRICT ADMIN ONLY: Safe AI configuration and health check.
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await aiConfigService.getHealthStatus();
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ai/history
   * Authenticated user: Lists recent analysis history within user's authorization scope.
   */
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const history = await aiOrchestratorService.getAnalysisHistory({
        id: user.id,
        role: user.role,
        staffRecordId: user.staffRecordId || undefined,
        email: user.email,
      });

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ai/analysis/:id
   * Authenticated user: Retrieves details of a single analysis run.
   */
  async getAnalysisById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const run = await aiOrchestratorService.getAnalysisById(id, {
        id: user.id,
        role: user.role,
        staffRecordId: user.staffRecordId || undefined,
        email: user.email,
      });

      return res.status(200).json({
        success: true,
        data: run,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/ai/analysis/:id/evidence
   * Authenticated user: Retrieves evidence items for a single analysis run.
   */
  async getAnalysisEvidence(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const run = await aiOrchestratorService.getAnalysisById(id, {
        id: user.id,
        role: user.role,
        staffRecordId: user.staffRecordId || undefined,
        email: user.email,
      });

      return res.status(200).json({
        success: true,
        data: (run as any).evidence || [],
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/ai/analysis/:id/feedback
   * Authenticated user: Submit feedback on AI output.
   */
  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const parsed = feedbackSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', details: parsed.error.format() },
        });
      }

      await aiOrchestratorService.getAnalysisById(id, {
        id: user.id,
        role: user.role,
        staffRecordId: user.staffRecordId || undefined,
        email: user.email,
      });

      await createAuditLog({
        userId: user.id,
        action: 'AI_FEEDBACK_SUBMITTED',
        entityType: 'AI_ANALYSIS',
        entityId: id,
        metadata: {
          rating: parsed.data.rating,
          comment: parsed.data.comment || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Feedback submitted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AiController();
