import { Request, Response, NextFunction, CookieOptions } from 'express';
import { authService, SafeUser } from '../modules/auth/auth.service';
import { AppError } from './errorHandler';
import { config } from '../config/environment';

export const SESSION_COOKIE_NAME = 'staff_ops_session';

// Extend Express Request interface with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      sessionToken?: string;
    }
  }
}

/**
 * Returns secure cookie options based on runtime environment.
 */
export function getSessionCookieOptions(req?: Request): CookieOptions {
  // Check if connection is HTTPS or via SSL termination proxy
  const isHttps =
    config.isProduction ||
    req?.secure ||
    req?.headers['x-forwarded-proto'] === 'https';

  return {
    httpOnly: true, // Prevents XSS script access
    secure: isHttps, // Requires HTTPS in production
    sameSite: isHttps ? 'none' : 'lax', // 'none' required for iframe preview embedding over HTTPS
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
}

/**
 * Extracts session token from HTTP-only cookie or Authorization header.
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Primary: HTTP-Only cookie from req.cookies
  let token = req.cookies?.[SESSION_COOKIE_NAME];

  // 1b. Fallback: Parse raw req.headers.cookie if req.cookies doesn't contain it
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match && match[1]) {
      token = decodeURIComponent(match[1].trim());
    }
  }

  // Strip any trailing attributes if passed from test runners or proxies
  if (token && typeof token === 'string' && token.includes(';')) {
    token = token.split(';')[0].trim();
  }

  if (token) {
    return token;
  }

  // 2. Secondary: Bearer Authorization header (for test runners, curl, and programmatic API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Middleware: Attaches authenticated user to req.user if a valid session exists.
 * Does not block if unauthenticated.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      return next();
    }

    const safeUser = await authService.validateSession(token);
    if (safeUser) {
      req.user = safeUser;
      req.sessionToken = token;
    }
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Requires an active, authenticated session.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      const token = extractSessionToken(req);
      if (!token) {
        return next(
          new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED')
        );
      }

      const safeUser = await authService.validateSession(token);
      if (!safeUser) {
        return next(
          new AppError('Invalid or expired authentication session.', 401, 'SESSION_EXPIRED')
        );
      }

      req.user = safeUser;
      req.sessionToken = token;
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Restricts route access to specific roles (e.g. ['ADMIN']).
 */
export {
  requireRole,
  requireAdmin,
  requireStaff,
  requireSelfOrAdmin,
  protectIdorQueryParam,
  protectIdorBody,
} from './rbac';
