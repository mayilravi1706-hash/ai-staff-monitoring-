import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitStore>();

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Clean up expired rate limit entries every 5 minutes
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please try again later.',
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'anonymous',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, allow bypassing unless specifically testing rate limiter
    if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'true') {
      return next();
    }

    const key = `${keyGenerator(req)}_${req.baseUrl}${req.path}`;
    const now = Date.now();
    let record = memoryStore.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      memoryStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds,
        },
      });
    }

    next();
  };
}

/**
 * Resets the in-memory rate limiter store (useful in testing)
 */
export function resetRateLimiterStore() {
  memoryStore.clear();
}
