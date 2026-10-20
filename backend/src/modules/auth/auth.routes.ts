import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRequest } from '../../middleware/security';
import { requireAuth } from '../../middleware/auth';
import { createRateLimiter } from '../../middleware/rateLimiter';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';

const authRouter = Router();

// Rate limiters for authentication endpoints to prevent brute-force attacks
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 10 attempts per window
  message: 'Too many login attempts. For security reasons, please try again in 15 minutes.',
});

const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please wait a few minutes before trying again.',
});

// Authentication endpoints
authRouter.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: loginSchema }),
  authController.login.bind(authController)
);

authRouter.post(
  '/logout',
  authController.logout.bind(authController)
);

authRouter.get(
  '/me',
  requireAuth,
  authController.getMe.bind(authController)
);

authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  authController.forgotPassword.bind(authController)
);

authRouter.post(
  '/reset-password',
  forgotPasswordRateLimiter,
  validateRequest({ body: resetPasswordSchema }),
  authController.resetPassword.bind(authController)
);

export default authRouter;
