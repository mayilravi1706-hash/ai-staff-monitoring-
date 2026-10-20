import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  extractSessionToken,
} from '../../middleware/auth';
import { LoginInput, ForgotPasswordInput, ResetPasswordInput } from './auth.schema';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as LoginInput;
      const ip = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const { user, rawSessionToken } = await authService.login(input, { ip, userAgent });

      // Set Secure, HTTP-Only session cookie
      res.cookie(SESSION_COOKIE_NAME, rawSessionToken, getSessionCookieOptions(req));

      // Return only safe user payload (Never expose password hash or secrets)
      return res.status(200).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = extractSessionToken(req);
      if (token) {
        await authService.logout(token);
      }

      // Invalidate and clear the HTTP-only cookie with matching flags
      const cookieOpts = getSessionCookieOptions(req);
      res.clearCookie(SESSION_COOKIE_NAME, {
        path: cookieOpts.path || '/',
        httpOnly: cookieOpts.httpOnly,
        secure: cookieOpts.secure,
        sameSite: cookieOpts.sameSite,
      });

      return res.status(200).json({
        success: true,
        data: {
          message: 'Session terminated successfully.',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No active authentication session.',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as ForgotPasswordInput;
      const result = await authService.requestPasswordReset(email);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body as ResetPasswordInput;
      await authService.resetPassword(token, newPassword);

      return res.status(200).json({
        success: true,
        data: {
          message: 'Password has been successfully updated. You can now log in with your new credentials.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
