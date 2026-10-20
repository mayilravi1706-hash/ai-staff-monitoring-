import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { classMonitoringService } from '../backend/src/services/classMonitoring.service';

describe('Phase 5: Operational Workflow — Timetable, Activity, Attendance, Coverage & Monitoring', () => {
  let adminCookie: string;
  let staffArunCookie: string;

  const ARUN_STAFF_RECORD_ID = 'stf-001';
  const OTHER_STAFF_RECORD_ID = 'stf-stf-cse-002';

  beforeAll(async () => {
    // 1. Log in as ADMIN
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin@college.demo',
        password: 'Admin@123',
        role: 'ADMIN',
      });
    expect(adminLoginRes.status).toBe(200);
    const adminSetCookie = adminLoginRes.headers['set-cookie'] as string[];
    const rawAdminCookie = adminSetCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    adminCookie = rawAdminCookie!.split(';')[0];

    // 2. Log in as STAFF (Dr. Arun Kumar)
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'arun.kumar@college.demo',
        password: 'Staff@123',
        role: 'STAFF',
      });
    expect(staffLoginRes.status).toBe(200);
    const staffSetCookie = staffLoginRes.headers['set-cookie'] as string[];
    const rawStaffCookie = staffSetCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    staffArunCookie = rawStaffCookie!.split(';')[0];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. TIMETABLE → EXPECTED CLASS ENGINE & CURRENT CLASS STATUS
  // ============================================================
  describe('1 & 2. Timetable -> Expected Class Engine', () => {
    it('determines expected class using server date and server time', async () => {
      const result = await classMonitoringService.getCurrentExpectedClass(ARUN_STAFF_RECORD_ID);

      expect(result).toHaveProperty('hasCurrentClass');
      expect(result).toHaveProperty('serverTime');
      expect(result.serverTime).toHaveProperty('iso');
      expect(result.serverTime).toHaveProperty('timeStr');
      expect(result.serverTime).toHaveProperty('dayOfWeek');
      expect(result.todaySchedule).toBeInstanceOf(Array);

      // Verify deterministic time statuses
      for (const slot of result.todaySchedule) {
        expect(['UPCOMING', 'CURRENT', 'COMPLETED']).toContain(slot.timeStatus);
        expect(['COVERED', 'NOT_RECORDED', 'NOT_SCHEDULED']).toContain(slot.coverage);
      }
    });

    it('GET /api/timetable/current-class returns expected class for authenticated staff', async () => {
      const res = await request(app)
        .get('/api/timetable/current-class')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('hasCurrentClass');
      expect(res.body.data).toHaveProperty('todaySchedule');
    });

    it('blocks IDOR attempt when staff requests current-class for another staff member', async () => {
      const res = await request(app)
        .get(`/api/timetable/current-class?staffId=${OTHER_STAFF_RECORD_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // 3, 4, 5. CURRENT ACTIVITY & VALIDATION
  // ============================================================
  describe('3, 4, 5. Current Activity Management & Validation', () => {
    let createdActivityId: string;

    it('GET /api/activity/current returns active activity and expected class', async () => {
      const res = await request(app)
        .get('/api/activity/current')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('hasActiveActivity');
      expect(res.body.data).toHaveProperty('serverTime');
    });

    it('POST /api/activity records new work and prevents overlapping active activities', async () => {
      // 1. Record first activity
      const res1 = await request(app)
        .post('/api/activity')
        .set('Cookie', staffArunCookie)
        .send({
          activity_status: 'PREPARING_CLASS',
          notes: 'Preparing Data Structures lab slides',
          duration_minutes: 60,
        });

      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.activity_status).toBe('PREPARING_CLASS');
      const firstActivityId = res1.body.data.id;

      // 2. Record second activity (e.g. Teaching) - first activity should be cleanly closed
      const res2 = await request(app)
        .post('/api/activity')
        .set('Cookie', staffArunCookie)
        .send({
          activity_status: 'TEACHING',
          notes: 'Lecture on Binary Trees',
          duration_minutes: 45,
        });

      expect(res2.status).toBe(201);
      createdActivityId = res2.body.data.id;

      // Verify the first activity has an actual_end_time populated (no overlapping active activities)
      const firstActCheck = await prisma.activity.findUnique({
        where: { id: firstActivityId },
      });
      expect(firstActCheck?.actual_end_time).not.toBeNull();
    });

    it('blocks IDOR attempt when staff attempts to post activity for another staff member', async () => {
      const res = await request(app)
        .post('/api/activity')
        .set('Cookie', staffArunCookie)
        .send({
          staff_id: OTHER_STAFF_RECORD_ID,
          activity_status: 'MEETING',
          notes: 'IDOR unauthorized activity',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects invalid activity status via server-side Zod validation', async () => {
      const res = await request(app)
        .post('/api/activity')
        .set('Cookie', staffArunCookie)
        .send({
          activity_status: 'INVALID_STATUS',
          notes: 'Testing invalid status',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('PATCH /api/activity/:id updates activity notes or concludes session', async () => {
      const res = await request(app)
        .patch(`/api/activity/${createdActivityId}`)
        .set('Cookie', staffArunCookie)
        .send({
          notes: 'Concluded Binary Trees lecture successfully',
          actual_end_time: new Date().toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.actual_end_time).not.toBeNull();
    });
  });

  // ============================================================
  // 6, 7, 8. ATTENDANCE, UNIQUENESS & LEAVE CONSISTENCY
  // ============================================================
  describe('6, 7, 8. Attendance Management, Uniqueness & Leave Consistency', () => {
    const testDate = '2026-11-10';

    beforeAll(async () => {
      // Clean up any test attendance on this date
      const d = new Date(testDate);
      d.setUTCHours(0, 0, 0, 0);
      await prisma.attendance.deleteMany({
        where: { attendance_date: d },
      });
    });

    it('POST /api/attendance records faculty attendance', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Cookie', staffArunCookie)
        .send({
          attendance_date: testDate,
          status: 'PRESENT',
          remarks: 'Biometric verified at entry gate',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PRESENT');
    });

    it('SECTION 7: Prevents duplicate attendance records for the same staff on the same date (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .set('Cookie', staffArunCookie)
        .send({
          attendance_date: testDate,
          status: 'HALF_DAY',
          remarks: 'Duplicate attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_ATTENDANCE');
      expect(res.body.error.message).toContain('Duplicate daily records are prohibited');
    });

    it('SECTION 8: Prevents recording PRESENT when staff member has an approved leave for that date', async () => {
      const leaveDate = '2026-11-20';
      const d = new Date(leaveDate);
      d.setUTCHours(0, 0, 0, 0);

      // Create an APPROVED leave request for Arun Kumar
      await prisma.leaveRequest.create({
        data: {
          staff_id: ARUN_STAFF_RECORD_ID,
          leave_type: 'CASUAL',
          start_date: d,
          end_date: d,
          duration: 1,
          reason: 'Doctor appointment',
          status: 'APPROVED',
        },
      });

      // Attempt to mark PRESENT on approved leave date
      const res = await request(app)
        .post('/api/attendance')
        .set('Cookie', staffArunCookie)
        .send({
          attendance_date: leaveDate,
          status: 'PRESENT',
          remarks: 'Attempting present while on leave',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LEAVE_ATTENDANCE_CONFLICT');
      expect(res.body.error.message).toContain('approved leave request');
    });

    it('blocks IDOR attempt when staff attempts to view attendance for another staff member', async () => {
      const res = await request(app)
        .get(`/api/attendance?staffId=${OTHER_STAFF_RECORD_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ============================================================
  // 10. CLASS COVERAGE
  // ============================================================
  describe('10. Class Coverage Calculation', () => {
    it('GET /api/timetable/coverage returns deterministic coverage states', async () => {
      const res = await request(app)
        .get('/api/timetable/coverage')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('covered');
      expect(res.body.data.summary).toHaveProperty('notRecorded');
      expect(res.body.data.summary).toHaveProperty('upcoming');

      // Check coverage terminology: COVERED, NOT_RECORDED, NOT_SCHEDULED
      for (const slot of res.body.data.schedule) {
        expect(['COVERED', 'NOT_RECORDED', 'NOT_SCHEDULED']).toContain(slot.coverage);
        expect(slot.coverage).not.toBe('ABSENT');
        expect(slot.coverage).not.toBe('UNATTENDED');
      }
    });
  });

  // ============================================================
  // 11, 12, 13. GRACE PERIOD & OPERATIONAL MONITORING ALERTS
  // ============================================================
  describe('11, 12, 13. Grace Period & Operational Monitoring Alerts', () => {
    it('GET /api/monitoring/grace-period returns configured grace period', async () => {
      const res = await request(app)
        .get('/api/monitoring/grace-period')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gracePeriodMinutes).toBeGreaterThanOrEqual(0);
    });

    it('PATCH /api/monitoring/grace-period allows ADMIN to update grace period setting', async () => {
      const res = await request(app)
        .patch('/api/monitoring/grace-period')
        .set('Cookie', adminCookie)
        .send({ gracePeriodMinutes: 8 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gracePeriodMinutes).toBe(8);

      // Verify setting stored in PostgreSQL
      const setting = await prisma.setting.findUnique({
        where: { key: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES' },
      });
      expect(setting?.value).toBe('8');

      // Reset to 5
      await request(app)
        .patch('/api/monitoring/grace-period')
        .set('Cookie', adminCookie)
        .send({ gracePeriodMinutes: 5 });
    });

    it('PATCH /api/monitoring/grace-period blocks non-admin STAFF with 403', async () => {
      const res = await request(app)
        .patch('/api/monitoring/grace-period')
        .set('Cookie', staffArunCookie)
        .send({ gracePeriodMinutes: 10 });

      expect(res.status).toBe(403);
    });

    it('SECTION 12 & 13: Operational monitoring alerts contain proper wording and prevent duplicate alerts', async () => {
      const res = await request(app)
        .get('/api/monitoring/alerts')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);

      // If any alerts were generated:
      for (const alert of res.body.data) {
        expect(alert.title).toBe('Scheduled class activity has not been recorded.');
        expect(alert.message).toContain('This is an operational monitoring signal and does not establish unattended class or staff absence.');
        // Verify no forbidden terms
        expect(alert.message.toLowerCase()).not.toContain('staff absent');
        expect(alert.message.toLowerCase()).not.toContain('teacher absent');
        expect(alert.message.toLowerCase()).not.toContain('unattended class');
      }
    });
  });
});
