import { AppError } from '../middleware/errorHandler';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding rate limiter specifically for AI queries.
 * Limits:
 * - ADMIN: 40 requests per 15 minutes
 * - STAFF: 20 requests per 15 minutes
 */
class AiRateLimiterService {
  private userLimits = new Map<string, RateLimitRecord>();
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_ADMIN_REQUESTS = 40;
  private readonly MAX_STAFF_REQUESTS = 20;
  private readonly MAX_PROMPT_LENGTH = 500;

  /**
   * Validates and sanitizes prompt length and content.
   */
  validatePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new AppError('Query prompt must be a non-empty string.', 400, 'INVALID_PROMPT');
    }

    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      throw new AppError('Query prompt cannot be empty or whitespace only.', 400, 'INVALID_PROMPT');
    }

    if (trimmed.length > this.MAX_PROMPT_LENGTH) {
      throw new AppError(
        `Query prompt exceeds maximum allowed limit of ${this.MAX_PROMPT_LENGTH} characters (received ${trimmed.length}).`,
        400,
        'PROMPT_TOO_LONG'
      );
    }

    return trimmed;
  }

  /**
   * Enforces role-based rate limits on AI queries.
   */
  checkRateLimit(userId: string, role: string) {
    const now = Date.now();
    const maxRequests = role === 'ADMIN' ? this.MAX_ADMIN_REQUESTS : this.MAX_STAFF_REQUESTS;

    const record = this.userLimits.get(userId);

    if (!record || now > record.resetAt) {
      this.userLimits.set(userId, {
        count: 1,
        resetAt: now + this.WINDOW_MS,
      });
      return;
    }

    if (record.count >= maxRequests) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      throw new AppError(
        `AI query rate limit exceeded for your role (${maxRequests} queries per 15 mins). Please retry in ${waitSeconds} seconds.`,
        429,
        'AI_RATE_LIMIT_EXCEEDED'
      );
    }

    record.count += 1;
  }

  /**
   * Reset helper for testing
   */
  resetLimits() {
    this.userLimits.clear();
  }
}

export const aiRateLimiterService = new AiRateLimiterService();
