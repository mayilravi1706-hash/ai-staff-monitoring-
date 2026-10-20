import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { getErrorMessage, isNetworkError, getErrorStatus } from '../frontend/src/utils/errorHandler';

describe('Staff Delete & Error Handling Regression Tests', () => {
  let adminCookie: string;
  let staffCookie: string;

  const TEST_ADMIN_EMAIL = 'admin@college.demo';
  const TEST_STAFF_EMAIL = 'arun.kumar@college.demo';

  beforeAll(async () => {
    resetRateLimiterStore();

    // Clean up any stale records from previous test runs
    const staleStaff = await prisma.staff.findMany({
      where: { staff_id: { in: ['STF-DEL-TEST-001', 'STF-DEL-HIST-001'] } },
    });
    const staleStaffIds = staleStaff.map((s) => s.id);
    if (staleStaffIds.length > 0) {
      await prisma.attendance.deleteMany({ where: { staff_id: { in: staleStaffIds } } });
      await prisma.staff.deleteMany({ where: { id: { in: staleStaffIds } } });
    }
    await prisma.userSession.deleteMany({
      where: { user: { email: { in: ['del.test.001@college.demo', 'del.hist.001@college.demo'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['del.test.001@college.demo', 'del.hist.001@college.demo'] } },
    });

    // 1. Log in as ADMIN
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: TEST_ADMIN_EMAIL,
        password: 'Admin@123',
        role: 'ADMIN',
      });
    expect(adminLoginRes.status).toBe(200);
    const adminSetCookie = adminLoginRes.headers['set-cookie'] as string[];
    const rawAdminCookie = adminSetCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    adminCookie = rawAdminCookie!.split(';')[0];

    // 2. Log in as STAFF
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: TEST_STAFF_EMAIL,
        password: 'Staff@123',
        role: 'STAFF',
      });
    expect(staffLoginRes.status).toBe(200);
    const staffSetCookie = staffLoginRes.headers['set-cookie'] as string[];
    const rawStaffCookie = staffSetCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    staffCookie = rawStaffCookie!.split(';')[0];
  }, 60000);

  afterAll(async () => {
    // Cleanup temporary test attendance, sessions, staff & users created during tests
    const testStaff = await prisma.staff.findMany({
      where: {
        staff_id: { in: ['STF-DEL-TEST-001', 'STF-DEL-HIST-001'] },
      },
    });
    const staffIds = testStaff.map((s) => s.id);
    if (staffIds.length > 0) {
      await prisma.attendance.deleteMany({ where: { staff_id: { in: staffIds } } });
      await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
    }
    await prisma.userSession.deleteMany({
      where: {
        user: { email: { in: ['del.test.001@college.demo', 'del.hist.001@college.demo'] } },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['del.test.001@college.demo', 'del.hist.001@college.demo'] },
      },
    });
    await prisma.$disconnect();
  }, 30000);

  // =========================================================================
  // 1. Authentication & RBAC Access Control Tests
  // =========================================================================
  describe('Authorization and Access Control', () => {
    it('1. Rejects unauthenticated delete request with 401 Unauthorized', async () => {
      const res = await request(app).delete('/api/staff/stf-001');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('2. Prevents STAFF role from deleting staff records with 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/staff/stf-001')
        .set('Cookie', staffCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('3. Returns 404 when staff ID does not exist', async () => {
      const res = await request(app)
        .delete('/api/staff/non-existent-uuid-99999999')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('4. Prevents logged-in ADMIN from deleting their own account (Self-Deletion Prohibited)', async () => {
      // The admin's user ID is usr-admin-001
      const res = await request(app)
        .delete('/api/staff/me')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SELF_DELETION_PROHIBITED');
    });

    it('5. Prevents deleting protected root system admin accounts', async () => {
      // Admin account email: admin@college.demo
      const res = await request(app)
        .delete('/api/staff/admin@college.demo')
        .set('Cookie', adminCookie);

      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Historical Records & Relational Integrity (Safe Deactivation)
  // =========================================================================
  describe('Historical Record Preservation and Safe Deactivation', () => {
    let histStaffId: string;
    let histUserId: string;

    beforeAll(async () => {
      const hash = await bcrypt.hash('Test@123', 10);
      const user = await prisma.user.create({
        data: {
          email: 'del.hist.001@college.demo',
          password_hash: hash,
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });
      histUserId = user.id;

      const staff = await prisma.staff.create({
        data: {
          user_id: user.id,
          staff_id: 'STF-DEL-HIST-001',
          full_name: 'Historical Test Faculty',
          email: 'del.hist.001@college.demo',
          department_id: 'dept-cse',
          designation: 'Assistant Professor',
          joining_date: new Date('2024-01-01T00:00:00.000Z'),
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });
      histStaffId = staff.id;

      // Add a historical attendance record
      await prisma.attendance.create({
        data: {
          staff_id: staff.id,
          attendance_date: new Date('2026-09-01T00:00:00.000Z'),
          status: 'PRESENT',
          remarks: 'Historical test session record',
        },
      });

      // Add an active session for this user
      await prisma.userSession.create({
        data: {
          user_id: user.id,
          token_hash: 'dummy-session-hash-hist-001',
          expires_at: new Date(Date.now() + 3600000),
        },
      });
    });

    it('6. Deactivates staff and preserves attendance/historical records without crashing', async () => {
      const res = await request(app)
        .delete(`/api/staff/${histStaffId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deactivated).toBe(true);
      expect(res.body.deleted).toBe(false);

      // Verify response has non-undefined message and data
      expect(res.body.message).toContain('deactivated');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.message).toBeDefined();
      expect(res.body.data.deactivated).toBe(true);

      // Verify PostgreSQL database state: staff and user status are INACTIVE
      const staffInDb = await prisma.staff.findUnique({ where: { id: histStaffId } });
      expect(staffInDb).not.toBeNull();
      expect(staffInDb!.status).toBe('INACTIVE');

      const userInDb = await prisma.user.findUnique({ where: { id: histUserId } });
      expect(userInDb).not.toBeNull();
      expect(userInDb!.status).toBe('INACTIVE');

      // Verify active sessions were revoked
      const sessions = await prisma.userSession.findMany({ where: { user_id: histUserId } });
      expect(sessions.length).toBe(0);

      // Verify attendance was NOT deleted
      const attendance = await prisma.attendance.findMany({ where: { staff_id: histStaffId } });
      expect(attendance.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. Physical Deletion for Clean Records
  // =========================================================================
  describe('Permanent Deletion for Clean Records', () => {
    let cleanStaffId: string;
    let cleanUserId: string;

    beforeAll(async () => {
      const hash = await bcrypt.hash('Test@123', 10);
      const user = await prisma.user.create({
        data: {
          email: 'del.test.001@college.demo',
          password_hash: hash,
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });
      cleanUserId = user.id;

      const staff = await prisma.staff.create({
        data: {
          user_id: user.id,
          staff_id: 'STF-DEL-TEST-001',
          full_name: 'Clean Deletion Faculty',
          email: 'del.test.001@college.demo',
          department_id: 'dept-cse',
          designation: 'Lecturer',
          joining_date: new Date('2024-05-01T00:00:00.000Z'),
          role: 'STAFF',
          status: 'ACTIVE',
        },
      });
      cleanStaffId = staff.id;
    });

    it('7. Permanently deletes staff and user when no historical records exist', async () => {
      const res = await request(app)
        .delete(`/api/staff/${cleanStaffId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted).toBe(true);
      expect(res.body.message).toContain('deleted permanently');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.deleted).toBe(true);

      // Verify records are removed from PostgreSQL database
      const staffInDb = await prisma.staff.findUnique({ where: { id: cleanStaffId } });
      expect(staffInDb).toBeNull();

      const userInDb = await prisma.user.findUnique({ where: { id: cleanUserId } });
      expect(userInDb).toBeNull();

      // Verify audit log exists
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'STAFF_DELETED',
          entity_id: cleanStaffId,
        },
      });
      expect(auditLog).not.toBeNull();
    });
  });

  // =========================================================================
  // 4. Frontend Error Helper Unit Tests
  // =========================================================================
  describe('Frontend Error Helper Validation', () => {
    it('8. Safely handles null, undefined, and empty error inputs without crashing', () => {
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
      expect(getErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
      expect(getErrorMessage(null, 'Custom Fallback')).toBe('Custom Fallback');
      expect(getErrorMessage({})).toBe('An unexpected error occurred. Please try again.');
    });

    it('9. Handles TypeError: Cannot read properties of undefined (reading "message")', () => {
      const typeError = new TypeError("Cannot read properties of undefined (reading 'message')");
      const msg = getErrorMessage(typeError);
      expect(msg).toContain('Staff removal completed, but the response format was unexpected');
      expect(msg).not.toContain('undefined');
    });

    it('10. Handles HTTP status codes with human-friendly descriptions', () => {
      expect(getErrorMessage({ status: 401 })).toContain('Session expired or unauthenticated');
      expect(getErrorMessage({ status: 403 })).toContain('Access denied');
      expect(getErrorMessage({ status: 404 })).toContain('not be found');
      expect(getErrorMessage({ status: 409 })).toContain('Conflict: Operation blocked');
      expect(getErrorMessage({ status: 500 })).toContain('Internal server error');
    });

    it('11. Detects network disconnection and extracts messages', () => {
      const netError = new Error('Failed to fetch');
      expect(isNetworkError(netError)).toBe(true);
      expect(getErrorMessage(netError)).toContain('Network error: Unable to reach the server');
    });

    it('12. Sanitizes sensitive database credentials and stack traces', () => {
      const dbError = new Error('Connection failed: postgresql://admin:secretPass@localhost:5432/db at Object.query');
      const sanitized = getErrorMessage(dbError);
      expect(sanitized).not.toContain('secretPass');
      expect(sanitized).not.toContain('postgresql://');
      expect(sanitized).toBe('A database constraint prevented this operation. Historical records have been preserved.');
    });

    it('13. Extracts status from Axios/Fetch-style response objects', () => {
      expect(getErrorStatus({ response: { status: 404 } })).toBe(404);
      expect(getErrorStatus({ statusCode: 500 })).toBe(500);
      expect(getErrorStatus(null)).toBeNull();
    });
  });
});
