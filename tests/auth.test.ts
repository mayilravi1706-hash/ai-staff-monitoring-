import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { authService } from '../backend/src/modules/auth/auth.service';

describe('Phase 2 Authentication Endpoints', () => {
  beforeEach(() => {
    resetRateLimiterStore();
  });

  afterAll(async () => {
    // Clean up test sessions and reset tokens created during tests
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: {
            in: ['admin@college.demo', 'arun.kumar@college.demo'],
          },
        },
      },
    });
    await prisma.passwordResetToken.deleteMany({
      where: {
        user: {
          email: {
            in: ['admin@college.demo', 'arun.kumar@college.demo'],
          },
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('1. Valid Login & Session Creation', () => {
    it('should successfully log in an ADMIN user and return HTTP-only session cookie', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'Admin@123',
          role: 'ADMIN',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('admin@college.demo');
      expect(response.body.data.user.role).toBe('ADMIN');
      // Crucial: never return password_hash
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data.user).not.toHaveProperty('password');

      // Check HTTP-only cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
      const sessionCookie = cookies.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('should successfully log in a STAFF user with Email and return valid session', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'arun.kumar@college.demo',
          password: 'Staff@123',
          role: 'STAFF',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('arun.kumar@college.demo');
      expect(response.body.data.user.role).toBe('STAFF');
      expect(response.body.data.user.staffId).toBe('STF-CSE-001');
      expect(response.body.data.user.fullName).toBe('Dr. Arun Kumar');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should successfully log in a STAFF user using Staff ID instead of email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'STF-CSE-001',
          password: 'Staff@123',
          role: 'STAFF',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('arun.kumar@college.demo');
      expect(response.body.data.user.staffId).toBe('STF-CSE-001');
      expect(response.body.data.user.fullName).toBe('Dr. Arun Kumar');
    });
  });

  describe('2. Invalid Credentials & Security Protection', () => {
    it('should return a generic 401 error for incorrect password without leaking user existence', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'WrongPassword123!',
          role: 'ADMIN',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toContain('Invalid email/staff ID, password, or role selection');
    });

    it('should return the exact same generic 401 error for non-existent email/staff ID', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'unknown.user@college.demo',
          password: 'SomePassword123!',
          role: 'STAFF',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toContain('Invalid email/staff ID, password, or role selection');
    });

    it('should return generic 401 error if user tries to log in with mismatched role', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'arun.kumar@college.demo',
          password: 'Staff@123',
          role: 'ADMIN', // Arun Kumar is STAFF, not ADMIN
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('3. Current User Endpoint (/api/auth/me) & Protected Routes', () => {
    it('should block unauthenticated requests to /api/auth/me with 401 UNAUTHORIZED', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return authenticated user profile when session cookie is provided', async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'Admin@123',
          role: 'ADMIN',
        });

      const cookies = loginRes.headers['set-cookie'];

      // 2. Fetch /api/auth/me with cookie
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe('admin@college.demo');
      expect(meRes.body.data.user.role).toBe('ADMIN');
      expect(meRes.body.data.user.status).toBe('ACTIVE');
      expect(meRes.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should reject requests with expired sessions', async () => {
      // Create a deliberately expired session in the database
      const user = await prisma.user.findUnique({ where: { email: 'admin@college.demo' } });
      expect(user).toBeDefined();

      const rawToken = 'expired-test-token-1234567890123456';
      const tokenHash = authService.hashToken(rawToken);

      await prisma.userSession.create({
        data: {
          user_id: user!.id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
        },
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=${rawToken}`]);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('4. Logout & Session Invalidation', () => {
    it('should invalidate session and clear cookie on logout', async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'Admin@123',
          role: 'ADMIN',
        });

      const cookies = loginRes.headers['set-cookie'];

      // 2. Call logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify cookie cleared
      const setCookies = logoutRes.headers['set-cookie'];
      expect(setCookies).toBeDefined();
      const clearedCookie = setCookies.find((c: string) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(clearedCookie).toBeDefined();

      // 3. Trying to access /me with the invalidated session must fail
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);

      expect(meRes.status).toBe(401);
    });
  });

  describe('5. Password Reset Flow, Expiration, and Single-Use Enforcement', () => {
    it('should generate a single-use reset token and return generic message', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'arun.kumar@college.demo' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset instructions have been generated');
      expect(response.body.data).toHaveProperty('devResetToken');
    });

    it('should enforce single-use reset token: subsequent reset attempts with same token must fail', async () => {
      // 1. Request reset token for test user
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'arun.kumar@college.demo' });

      const rawToken = forgotRes.body.data.devResetToken;
      expect(rawToken).toBeDefined();

      // 2. Perform reset
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'NewStaffPassword@123',
          confirmPassword: 'NewStaffPassword@123',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 3. Attempt to reuse the exact same token -> must be rejected
      const secondAttempt = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'AnotherPassword@123',
          confirmPassword: 'AnotherPassword@123',
        });

      expect(secondAttempt.status).toBe(400);
      expect(secondAttempt.body.error.code).toBe('TOKEN_ALREADY_USED');

      // 4. Restore original password for test repeatability
      const restoreForgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'arun.kumar@college.demo' });
      await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: restoreForgotRes.body.data.devResetToken,
          newPassword: 'Staff@123',
          confirmPassword: 'Staff@123',
        });
    });

    it('should reject expired password reset tokens', async () => {
      const user = await prisma.user.findUnique({ where: { email: 'admin@college.demo' } });
      const rawToken = `expired-reset-token-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const tokenHash = authService.hashToken(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          user_id: user!.id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
        },
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'ValidPassword123!',
          confirmPassword: 'ValidPassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('6. Rate Limiting Protection', () => {
    it('should trigger rate limiting after exceeding max login attempts', async () => {
      resetRateLimiterStore();

      // Send 10 login attempts (allowed limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            identifier: 'admin@college.demo',
            password: 'BadPassword!',
            role: 'ADMIN',
          });
      }

      // The 11th request must receive 429 Too Many Requests
      const rateLimitedRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'BadPassword!',
          role: 'ADMIN',
        });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.success).toBe(false);
      expect(rateLimitedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(rateLimitedRes.headers).toHaveProperty('retry-after');
    });
  });
});
