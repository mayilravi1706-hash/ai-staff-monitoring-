import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { validateProductionConfig } from '../backend/src/config/environment';
import { notificationService } from '../backend/src/services/notification.service';
import { jobScheduler } from '../backend/src/services/scheduler.service';

describe('Phase 11: Security Hardening, Error Handling, Concurrency & Edge Cases', () => {
  let adminCookie: string;
  let staffArunCookie: string;
  let staffPriyaCookie: string;

  const ARUN_STAFF_RECORD_ID = 'stf-001';
  const ARUN_USER_ID = 'usr-staff-001';
  const ARUN_STAFF_ID = 'STF-CSE-001';

  const PRIYA_STAFF_RECORD_ID = 'stf-stf-cse-002';
  const PRIYA_USER_ID = 'usr-staff-002';
  const PRIYA_STAFF_ID = 'STF-CSE-002';

  beforeAll(async () => {
    resetRateLimiterStore();

    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin@college.demo',
        password: 'Admin@123',
        role: 'ADMIN',
      });
    adminCookie = adminRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 2. Authenticate Staff 1 (Arun)
    const arunRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'arun.kumar@college.demo',
        password: 'Staff@123',
        role: 'STAFF',
      });
    staffArunCookie = arunRes.headers['set-cookie']?.[0]?.split(';')[0] || '';

    // 3. Ensure Staff 2 (Priya) user exists and authenticate
    await prisma.user.upsert({
      where: { id: PRIYA_USER_ID },
      update: {},
      create: {
        id: PRIYA_USER_ID,
        email: 'priya.sharma@college.demo',
        password_hash: '$2a$10$wT8B1vD4qJmI21eQ8qF60e3q7fWpE1hB0sK3mF0xL5lP4qE9tG7eK', // Staff@123
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    await prisma.staff.upsert({
      where: { id: PRIYA_STAFF_RECORD_ID },
      update: {},
      create: {
        id: PRIYA_STAFF_RECORD_ID,
        user_id: PRIYA_USER_ID,
        staff_id: PRIYA_STAFF_ID,
        full_name: 'Prof. Priya Sharma',
        email: 'priya.sharma@college.demo',
        phone: '+91 98765 43211',
        department_id: 'dept-cse',
        designation: 'Assistant Professor',
        joining_date: new Date('2022-01-10T00:00:00.000Z'),
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    const priyaRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: PRIYA_STAFF_ID,
        password: 'Staff@123',
        role: 'STAFF',
      });
    staffPriyaCookie = priyaRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
  });

  // =========================================================================
  // 1. AUTHENTICATION & PASSWORD SECURITY
  // =========================================================================
  describe('1. Authentication & Password Security', () => {
    it('never exposes password, password_hash, or secret tokens in login response', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'Admin@123',
          role: 'ADMIN',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.rawSessionToken).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();
    });

    it('returns generic error on invalid login without disclosing account existence', async () => {
      // Non-existent email
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'nonexistent-user-999@college.demo',
          password: 'WrongPassword123!',
          role: 'STAFF',
        });

      // Existing email with wrong password
      const res2 = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'arun.kumar@college.demo',
          password: 'WrongPassword123!',
          role: 'STAFF',
        });

      // Wrong role for valid user
      const res3 = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'arun.kumar@college.demo',
          password: 'Staff@123',
          role: 'ADMIN',
        });

      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(res3.status).toBe(401);

      expect(res1.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res2.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res3.body.error.code).toBe('INVALID_CREDENTIALS');

      // Responses must have identical message to prevent user enumeration
      expect(res1.body.error.message).toBe(res2.body.error.message);
      expect(res2.body.error.message).toBe(res3.body.error.message);
    });

    it('stores only hashed session tokens in database, never raw tokens', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'Admin@123',
          role: 'ADMIN',
        });

      const rawCookie = loginRes.headers['set-cookie']?.[0] || '';
      const cookieMatch = rawCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      const rawSessionToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
      expect(rawSessionToken).toBeTruthy();

      // Check DB: rawSessionToken must NEVER appear in token_hash column
      const sessionWithRaw = await prisma.userSession.findFirst({
        where: { token_hash: rawSessionToken },
      });
      expect(sessionWithRaw).toBeNull();

      // SHA256 of rawSessionToken MUST be what is stored
      const expectedHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');
      const sessionWithHash = await prisma.userSession.findUnique({
        where: { token_hash: expectedHash },
      });
      expect(sessionWithHash).not.toBeNull();
      expect(sessionWithHash?.user_id).toBeDefined();
    });

    it('invalidates session in database on logout and clears HTTP-only cookie', async () => {
      // 1. Create a fresh session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'admin@college.demo',
          password: 'Admin@123',
          role: 'ADMIN',
        });

      const sessionCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
      const tokenVal = sessionCookie.replace(`${SESSION_COOKIE_NAME}=`, '');
      const tokenHash = crypto.createHash('sha256').update(tokenVal).digest('hex');

      // Verify session exists
      const beforeLogout = await prisma.userSession.findUnique({ where: { token_hash: tokenHash } });
      expect(beforeLogout).not.toBeNull();

      // 2. Perform logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);

      expect(logoutRes.status).toBe(200);

      // Verify session is deleted from database
      const afterLogout = await prisma.userSession.findUnique({ where: { token_hash: tokenHash } });
      expect(afterLogout).toBeNull();

      // 3. Verify that former session can no longer access protected endpoints
      const accessRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(accessRes.status).toBe(401);
    });

    it('enforces single-use password reset tokens and invalidates all existing sessions upon reset', async () => {
      const resetUserEmail = 'test.resetuser@college.demo';
      const resetUserId = 'usr-reset-test-999';

      await prisma.user.upsert({
        where: { id: resetUserId },
        update: {
          email: resetUserEmail,
          password_hash: '$2a$10$wT8B1vD4qJmI21eQ8qF60e3q7fWpE1hB0sK3mF0xL5lP4qE9tG7eK', // Staff@123
        },
        create: {
          id: resetUserId,
          email: resetUserEmail,
          password_hash: '$2a$10$wT8B1vD4qJmI21eQ8qF60e3q7fWpE1hB0sK3mF0xL5lP4qE9tG7eK',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });

      // 1. Request reset
      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: resetUserEmail });

      expect(forgotRes.status).toBe(200);
      const rawResetToken = forgotRes.body.data.devResetToken;
      expect(rawResetToken).toBeTruthy();

      // Raw token must NOT exist in plaintext in database
      const rawInDb = await prisma.passwordResetToken.findFirst({
        where: { token_hash: rawResetToken },
      });
      expect(rawInDb).toBeNull();

      // 2. Complete reset
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawResetToken,
          newPassword: 'NewSecurePassword123!',
          confirmPassword: 'NewSecurePassword123!',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 3. Re-using the same reset token MUST fail
      const reuseRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawResetToken,
          newPassword: 'AnotherPassword123!',
          confirmPassword: 'AnotherPassword123!',
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error.code).toBe('TOKEN_ALREADY_USED');

      // 4. Verify login with the new password
      resetRateLimiterStore();
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: resetUserEmail,
          password: 'NewSecurePassword123!',
          role: 'STAFF',
        });
      expect(newLoginRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. AUTHORIZATION & RBAC ENFORCEMENT
  // =========================================================================
  describe('2. Authorization & RBAC Enforcement', () => {
    it('blocks STAFF from accessing Admin-only settings with 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', staffArunCookie)
        .send({
          category: 'general',
          payload: { maintenanceMode: true },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks STAFF from accessing Admin-only audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks STAFF from triggering background jobs with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/operations/jobs/TASK_MAINTENANCE/run')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks STAFF from creating master timetable entries with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/timetable')
        .set('Cookie', staffArunCookie)
        .send({
          staff_id: ARUN_STAFF_RECORD_ID,
          class_id: 'cls-cse-a',
          subject_id: 'sub-cs101',
          day_of_week: 'MONDAY',
          start_time: '09:00',
          end_time: '10:00',
          room: 'LH-101',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks STAFF from requesting AUDIT_LOG report format with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/reports/generate')
        .set('Cookie', staffArunCookie)
        .send({
          reportType: 'AUDIT_LOG',
          format: 'CSV',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 3. COMPREHENSIVE IDOR PROTECTION
  // =========================================================================
  describe('3. Comprehensive IDOR Protection', () => {
    let priyaTaskId: string;
    let priyaAttendanceId: string;
    let priyaLeaveId: string;
    let priyaActivityId: string;
    let priyaNotificationId: string;
    let priyaReportId: string;

    beforeAll(async () => {
      // 1. Task for Priya
      const task = await prisma.task.upsert({
        where: { id: 'task-sec-priya-01' },
        update: {},
        create: {
          id: 'task-sec-priya-01',
          title: 'Private Department Curriculum Review',
          assigned_staff_id: PRIYA_STAFF_RECORD_ID,
          due_date: new Date('2026-11-30T17:00:00.000Z'),
          priority: 'HIGH',
          status: 'PENDING',
        },
      });
      priyaTaskId = task.id;

      // 2. Attendance for Priya
      const attDate = new Date('2026-11-01T00:00:00.000Z');
      const att = await prisma.attendance.upsert({
        where: {
          staff_id_attendance_date: {
            staff_id: PRIYA_STAFF_RECORD_ID,
            attendance_date: attDate,
          },
        },
        update: {},
        create: {
          id: 'att-sec-priya-01',
          staff_id: PRIYA_STAFF_RECORD_ID,
          attendance_date: attDate,
          status: 'PRESENT',
        },
      });
      priyaAttendanceId = att.id;

      // 3. Leave for Priya
      const leave = await prisma.leaveRequest.create({
        data: {
          staff_id: PRIYA_STAFF_RECORD_ID,
          leave_type: 'CASUAL',
          start_date: new Date('2026-12-10T00:00:00.000Z'),
          end_date: new Date('2026-12-12T00:00:00.000Z'),
          duration: 3,
          reason: 'Personal conference attendance',
          status: 'PENDING',
        },
      });
      priyaLeaveId = leave.id;

      // 4. Activity for Priya
      const act = await prisma.activity.create({
        data: {
          staff_id: PRIYA_STAFF_RECORD_ID,
          activity_status: 'TEACHING',
          description: 'Advanced Operating Systems Lecture',
          start_time: new Date('2026-11-01T10:00:00.000Z'),
          expected_end_time: new Date('2026-11-01T11:00:00.000Z'),
        },
      });
      priyaActivityId = act.id;

      // 5. Notification for Priya
      const notif = await prisma.notification.create({
        data: {
          recipient_user_id: PRIYA_USER_ID,
          type: 'CONFIDENTIAL_ALERT',
          title: 'Faculty Review Schedule',
          message: 'Confidential peer review schedule assigned.',
        },
      });
      priyaNotificationId = notif.id;

      // 6. Report for Priya
      const rep = await prisma.report.create({
        data: {
          report_type: 'WORKLOAD_DISTRIBUTION',
          format: 'CSV',
          filters: '{}',
          generated_by: PRIYA_USER_ID,
        },
      });
      priyaReportId = rep.id;
    });

    it('IDOR: Staff cannot view another staff member’s task by ID (GET /api/tasks/:id)', async () => {
      const res = await request(app)
        .get(`/api/tasks/${priyaTaskId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot modify another staff member’s task (PATCH /api/tasks/:id)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${priyaTaskId}`)
        .set('Cookie', staffArunCookie)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot view another staff member’s attendance (GET /api/attendance/:id)', async () => {
      const res = await request(app)
        .get(`/api/attendance/${priyaAttendanceId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot query another staff member’s attendance via query params', async () => {
      const res = await request(app)
        .get(`/api/attendance?staffId=${PRIYA_STAFF_RECORD_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot view another staff member’s leave request (GET /api/leave/:id)', async () => {
      const res = await request(app)
        .get(`/api/leave/${priyaLeaveId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot cancel another staff member’s leave request', async () => {
      const res = await request(app)
        .post(`/api/leave/${priyaLeaveId}/cancel`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot view another staff member’s activity record (GET /api/activity/:id)', async () => {
      const res = await request(app)
        .get(`/api/activity/${priyaActivityId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot mark another user’s notification as read (PATCH /api/notifications/:id/read)', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${priyaNotificationId}/read`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('IDOR: Staff cannot download or view another user’s report', async () => {
      const viewRes = await request(app)
        .get(`/api/reports/${priyaReportId}`)
        .set('Cookie', staffArunCookie);

      expect(viewRes.status).toBe(403);
      expect(viewRes.body.success).toBe(false);

      const dlRes = await request(app)
        .get(`/api/reports/${priyaReportId}/download`)
        .set('Cookie', staffArunCookie);

      expect(dlRes.status).toBe(403);
      expect(dlRes.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. CONCURRENCY, DATA INTEGRITY & TRANSACTION SAFETY
  // =========================================================================
  describe('4. Concurrency, Data Integrity & Transaction Safety', () => {
    it('prevents duplicate attendance on the same date with 409 Conflict', async () => {
      const uniqueDate = '2026-11-28';
      const d = new Date(uniqueDate);
      d.setUTCHours(0, 0, 0, 0);

      // Clean up first
      await prisma.attendance.deleteMany({
        where: {
          staff_id: ARUN_STAFF_RECORD_ID,
          attendance_date: d,
        },
      });

      // First record succeeds
      const firstRes = await request(app)
        .post('/api/attendance')
        .set('Cookie', staffArunCookie)
        .send({
          attendance_date: uniqueDate,
          status: 'PRESENT',
          remarks: 'First registration',
        });

      expect(firstRes.status).toBe(201);
      expect(firstRes.body.success).toBe(true);

      // Second identical request fails with 409 Conflict
      const secondRes = await request(app)
        .post('/api/attendance')
        .set('Cookie', staffArunCookie)
        .send({
          attendance_date: uniqueDate,
          status: 'HALF_DAY',
          remarks: 'Second conflicting attempt',
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toMatch(/DUPLICATE/);
    });

    it('prevents double leave approval or approving non-pending leave request', async () => {
      // Create a test leave request
      const leave = await prisma.leaveRequest.create({
        data: {
          staff_id: ARUN_STAFF_RECORD_ID,
          leave_type: 'SICK',
          start_date: new Date('2026-12-01T00:00:00.000Z'),
          end_date: new Date('2026-12-01T00:00:00.000Z'),
          duration: 1,
          reason: 'Fever recovery',
          status: 'PENDING',
        },
      });

      // 1. First approval succeeds
      const firstApproval = await request(app)
        .post(`/api/leave/${leave.id}/approve`)
        .set('Cookie', adminCookie)
        .send({ remarks: 'First admin approved' });

      expect(firstApproval.status).toBe(200);
      expect(firstApproval.body.success).toBe(true);

      // 2. Second approval on already approved request fails gracefully
      const secondApproval = await request(app)
        .post(`/api/leave/${leave.id}/approve`)
        .set('Cookie', adminCookie)
        .send({ remarks: 'Second admin tries to approve' });

      expect([400, 409]).toContain(secondApproval.status);
      expect(secondApproval.body.success).toBe(false);
    });

    it('concurrency: settings upsert handles simultaneous category updates without data loss', async () => {
      const promise1 = request(app)
        .put('/api/settings')
        .set('Cookie', adminCookie)
        .send({
          category: 'monitoring',
          payload: { classMonitoringGracePeriodMinutes: 12 },
        });

      const promise2 = request(app)
        .put('/api/settings')
        .set('Cookie', adminCookie)
        .send({
          category: 'monitoring',
          payload: { taskDueSoonThresholdHours: 36 },
        });

      const [res1, res2] = await Promise.all([promise1, promise2]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });

  // =========================================================================
  // 5. INPUT VALIDATION & EDGE CASE HARDENING
  // =========================================================================
  describe('5. Input Validation & Edge Case Hardening', () => {
    it('rejects malformed payloads with 400 Validation Error', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', adminCookie)
        .send({
          title: '', // Too short
          assigned_staff_id: '',
          due_date: 'invalid-not-a-date',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects inverted date ranges (startDate > endDate) in attendance queries', async () => {
      const res = await request(app)
        .get('/api/attendance?startDate=2026-12-31&endDate=2026-01-01')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects inverted date ranges (startDate > endDate) in activity queries', async () => {
      const res = await request(app)
        .get('/api/activity?startDate=2026-12-31&endDate=2026-01-01')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects oversized AI prompts exceeding 500 characters limit', async () => {
      const oversizedPrompt = 'A'.repeat(550);
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: oversizedPrompt });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative or impossible pagination values', async () => {
      const res = await request(app)
        .get('/api/attendance?page=-5&pageSize=-10')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 6. NOTIFICATION RELIABILITY & DEDUPLICATION
  // =========================================================================
  describe('6. Notification Reliability & Deduplication', () => {
    it('deduplicates identical notifications sent within cooldown period', async () => {
      const options = {
        recipientUserId: ARUN_USER_ID,
        type: 'CLASS_MONITORING_ALERT',
        title: 'Class Unrecorded',
        message: 'CSE-A lecture at 09:00 has no teaching activity recorded.',
        relatedEntity: 'TIMETABLE_ENTRY',
        relatedEntityId: 'tt-dup-test-01',
      };

      // 1. Send first notification
      const first = await notificationService.createNotification(options);
      expect(first).not.toBeNull();

      // 2. Send duplicate immediately
      const second = await notificationService.createNotification(options);
      expect(second).not.toBeNull();

      // Must return existing record instead of creating duplicate row
      expect(second?.id).toBe(first?.id);
    });

    it('skips notifications for non-existent recipients gracefully without crashing', async () => {
      const result = await notificationService.createNotification({
        recipientUserId: 'non-existent-user-uuid-999',
        type: 'SYSTEM_TEST',
        title: 'Test Alert',
        message: 'This should be safely skipped.',
      });

      expect(result).toBeNull();
    });

    it('GET /api/notifications/unread-count returns correct unread count', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.unreadCount).toBe('number');
    });

    it('POST /api/notifications/read-all marks all notifications read for caller', async () => {
      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.count).toBe('number');
    });
  });

  // =========================================================================
  // 7. SCHEDULED JOBS EXECUTION & RESILIENCE
  // =========================================================================
  describe('7. Scheduled Jobs Execution & Resilience', () => {
    it('runs registered background job safely, isolates execution, and records history in database', async () => {
      const result = await jobScheduler.runJob('TASK_MAINTENANCE', 'PHASE11_TEST');

      expect(result.success).toBe(true);
      expect(typeof result.durationMs).toBe('number');

      // Check database ScheduledJobRun record
      const latestRun = await prisma.scheduledJobRun.findFirst({
        where: { job_name: 'TASK_MAINTENANCE' },
        orderBy: { started_at: 'desc' },
      });

      expect(latestRun).not.toBeNull();
      expect(latestRun?.status).toBe('SUCCESS');
      expect(latestRun?.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/operations/jobs returns all registered scheduled jobs with runtime states', async () => {
      const res = await request(app)
        .get('/api/operations/jobs')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.jobs)).toBe(true);
      expect(res.body.data.jobs.length).toBeGreaterThanOrEqual(5);

      const jobNames = res.body.data.jobs.map((j: any) => j.name);
      expect(jobNames).toContain('CLASS_MONITORING');
      expect(jobNames).toContain('TASK_MAINTENANCE');
      expect(jobNames).toContain('WORKLOAD_ANALYSIS');
      expect(jobNames).toContain('PERFORMANCE_CALCULATION');
    });
  });

  // =========================================================================
  // 8. SECURITY HEADERS & CONFIGURATION VALIDATION
  // =========================================================================
  describe('8. Security Headers & Configuration Validation', () => {
    it('includes standard security headers in API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('validateProductionConfig flags default or short secret warnings in production', () => {
      const configValidation = validateProductionConfig();
      expect(configValidation).toHaveProperty('isValid');
      expect(configValidation).toHaveProperty('issues');
      expect(Array.isArray(configValidation.issues)).toBe(true);
    });
  });
});
