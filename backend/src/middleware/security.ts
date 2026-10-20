import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { config } from '../config/environment';

export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Allows frontend assets & API integration smoothly in dev & embedded frames
  crossOriginEmbedderPolicy: false,
  frameguard: false, // Essential for AI Studio embedded preview frame compatibility
});

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server, direct browser)
    if (!origin) return callback(null, true);
    
    // In development or local testing, allow all origins
    if (config.isDevelopment || config.isTest) {
      return callback(null, true);
    }

    // In preview/production, match configured APP_URL or allow trusted/cloud-run origins
    if (
      origin === config.appUrl ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.run.app') ||
      origin.includes('google.dev') ||
      origin.includes('google.com')
    ) {
      return callback(null, true);
    }

    // Default permissive callback for preview container environments
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
});

export function validateRequest(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request payload or parameters',
            details: error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
        });
      }
      next(error);
    }
  };
}
