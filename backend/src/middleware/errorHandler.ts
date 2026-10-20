import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const err = new AppError(`Resource not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(err);
}

export function centralErrorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  // 1. Handle Zod validation errors with HTTP 400
  if (err.name === 'ZodError' || ('errors' in err && Array.isArray((err as any).errors))) {
    const message = (err as any).errors
      ? (err as any).errors.map((e: any) => `${e.path.join('.') || 'field'}: ${e.message}`).join('; ')
      : err.message;

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
  }

  // 2. Handle Prisma Known Request Errors
  const prismaCode = (err as any).code;
  if (typeof prismaCode === 'string' && prismaCode.startsWith('P')) {
    if (prismaCode === 'P2002') {
      const target = (err as any).meta?.target;
      const targetField = Array.isArray(target) ? target.join(', ') : target || 'field';
      logger.logApiError(req.originalUrl, req.method, 409, err);
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: `A record with this unique ${targetField} already exists. Duplicate records are prohibited.`,
        },
      });
    }

    if (prismaCode === 'P2025') {
      logger.logApiError(req.originalUrl, req.method, 404, err);
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource or target record was not found.',
        },
      });
    }

    if (prismaCode === 'P2003' || prismaCode === 'P2014') {
      logger.logApiError(req.originalUrl, req.method, 400, err);
      return res.status(400).json({
        success: false,
        error: {
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'The operation cannot be completed because a referenced entity does not exist or has active dependencies.',
        },
      });
    }

    if (prismaCode === 'P2024') {
      logger.logApiError(req.originalUrl, req.method, 503, err);
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database query timed out or connection pool is exhausted. Please try again shortly.',
        },
      });
    }
  }

  const statusCode = (err as AppError).statusCode || 500;
  const errorCode = (err as AppError).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // Log structured server error
  logger.logApiError(req.originalUrl, req.method, statusCode, err);

  // Safe client response (no internal stack trace or DB connection string exposed)
  let safeMessage = err.message || 'An error occurred processing your request.';
  if (statusCode >= 500 && config.isProduction) {
    safeMessage = 'An unexpected internal server error occurred.';
  } else if (safeMessage.includes('postgresql://') || safeMessage.includes('prisma') || safeMessage.includes('password=')) {
    safeMessage = 'A database error occurred while processing the request.';
  }

  const responsePayload = {
    success: false,
    error: {
      code: errorCode,
      message: safeMessage,
    },
  };

  res.status(statusCode).json(responsePayload);
}
