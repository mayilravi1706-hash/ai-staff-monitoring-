import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';

describe('Phase 3: RBAC, Server-Side Authorization & IDOR Protection', () => {
  let adminCookie: string;
  let staffArunCookie: string;

  const ARUN_STAFF_RECORD_ID = 'stf-001';
  const ARUN_STAFF_ID = 'STF-CSE-001';

  const OTHER_STAFF_RECORD_ID = 'stf-stf-cse-002';
  const OTHER_STAFF_ID = 'STF-CSE-002';

  beforeAll(async () => {
    resetRateLimiterStore();

    // Ensure sample records exist for the other staff member (Prof. Priya Sharma)
    await prisma.staff.upsert({
      where: { staff_id: OTHER_STAFF_ID },
      update: {},
      create: {
        id: OTHER_STAFF_RECORD_ID,
        user_id: 'usr-staff-002',
        staff_id: OTHER_STAFF_ID,
        full_name: 'Prof. Priya Sharma',
        email: 'priya.sharma@college.demo',
        phone: '+91 98765 43211',
        department_id: 'dept-cse',
        designation: 'Assistant Professor',
        qualification: 'M.Tech CSE',
        joining_date: new Date('2022-01-10T00:00:00.000Z'),
        experience: 4,
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    // 1. Task for other staff
    await prisma.task.upsert({
      where: { id: 'task-priya-001' },
      update: {},
      create: {
        id: 'task-priya-001',
        title: 'Conduct Lab Assessment for CSE-A',
        description: 'Grade practical assignments and update portal',
        assigned_staff_id: OTHER_STAFF_RECORD_ID,
        due_date: new Date('2026-10-15T17:00:00.000Z'),
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      },
    });

    // 2. Attendance for other staff
    await prisma.attendance.upsert({
      where: {
        staff_id_attendance_date: {
          staff_id: OTHER_STAFF_RECORD_ID,
          attendance_date: new Date('2026-09-20T00:00:00.000Z'),
        },
      },
      update: {},
      create: {
        id: 'att-priya-001',
        staff_id: OTHER_STAFF_RECORD_ID,
        attendance_date: new Date('2026-09-20T00:00:00.000Z'),
        status: 'PRESENT',
        remarks: 'Biometric verified at 08:45 AM',
      },
    });

    // 3. Leave request for other staff
    await prisma.leaveRequest.upsert({
      where: { id: 'leave-priya-001' },
      update: {},
      create: {
        id: 'leave-priya-001',
        staff_id: OTHER_STAFF_RECORD_ID,
        leave_type: 'CASUAL',
        start_date: new Date('2026-10-01T00:00:00.000Z'),
        end_date: new Date('2026-10-02T00:00:00.000Z'),
        duration: 2,
        reason: 'Personal family event',
        status: 'PENDING',
      },
    });

    // 4. Activity for other staff
    await prisma.activity.upsert({
      where: { id: 'act-priya-001' },
      update: {},
      create: {
        id: 'act-priya-001',
        staff_id: OTHER_STAFF_RECORD_ID,
        activity_status: 'TEACHING',
        description: 'Delivered lecture on Advanced Graph Algorithms',
        start_time: new Date('2026-09-21T09:00:00.000Z'),
      },
    });

    // 5. Workload for other staff
    await prisma.workloadMetric.upsert({
      where: { id: 'wl-priya-001' },
      update: {},
      create: {
        id: 'wl-priya-001',
        staff_id: OTHER_STAFF_RECORD_ID,
        period_start: new Date('2026-09-01T00:00:00.000Z'),
        period_end: new Date('2026-09-30T00:00:00.000Z'),
        teaching_hours: 18,
        class_count: 3,
        workload_score: 82.5,
      },
    });

    // 6. Performance for other staff
    await prisma.performance.upsert({
      where: { id: 'perf-priya-001' },
      update: {},
      create: {
        id: 'perf-priya-001',
        staff_id: OTHER_STAFF_RECORD_ID,
        period_start: new Date('2026-08-01T00:00:00.000Z'),
        period_end: new Date('2026-08-31T00:00:00.000Z'),
        attendance_score: 95,
        task_completion_score: 90,
        overall_score: 92.5,
      },
    });

    // 7. Audit Log
    await prisma.auditLog.upsert({
      where: { id: 'audit-test-001' },
      update: {},
      create: {
        id: 'audit-test-001',
        action: 'SYSTEM_STARTUP',
        entity_type: 'SYSTEM',
        entity_id: 'sys-001',
        metadata: JSON.stringify({ event: 'Phase 3 RBAC Initialization' }),
      },
    });

    // Log in as ADMIN
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

    // Log in as STAFF (Dr. Arun Kumar)
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
  }, 60000);

  afterAll(async () => {
    // Clean up test sessions
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: { in: ['admin@college.demo', 'arun.kumar@college.demo'] },
        },
      },
    });
    await prisma.$disconnect();
  }, 30000);

  // ==========================================
  // SECTION 1: ADMIN ROLE ACCESS
  // ==========================================
  describe('1. ADMIN Role Permissions (Full Institutional Access)', () => {
    it('ADMIN can access all staff records via GET /api/staff', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('ADMIN can access all departments via GET /api/departments', async () => {
      const res = await request(app)
        .get('/api/departments')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('ADMIN can access all classes via GET /api/classes', async () => {
      const res = await request(app)
        .get('/api/classes')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all subjects via GET /api/subjects', async () => {
      const res = await request(app)
        .get('/api/subjects')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all academic years via GET /api/academic-years', async () => {
      const res = await request(app)
        .get('/api/academic-years')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all timetable records via GET /api/timetable', async () => {
      const res = await request(app)
        .get('/api/timetable')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all attendance records via GET /api/attendance', async () => {
      const res = await request(app)
        .get('/api/attendance')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all tasks via GET /api/tasks', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all leave requests via GET /api/leave', async () => {
      const res = await request(app)
        .get('/api/leave')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all activities via GET /api/activity', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all workload information via GET /api/workload', async () => {
      const res = await request(app)
        .get('/api/workload')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all performance information via GET /api/performance', async () => {
      const res = await request(app)
        .get('/api/performance')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access all operational alerts via GET /api/ai-alerts', async () => {
      const res = await request(app)
        .get('/api/ai-alerts')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN can access audit logs via GET /api/audit-logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ==========================================
  // SECTION 2: STAFF ROLE SCOPING
  // ==========================================
  describe('2. STAFF Role Scoping (Access ONLY to Own Data)', () => {
    it('STAFF is BLOCKED from audit logs with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('STAFF GET /api/staff returns strictly their own staff record', async () => {
      const res = await request(app)
        .get('/api/staff')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(ARUN_STAFF_RECORD_ID);
      expect(res.body.data[0].staff_id).toBe(ARUN_STAFF_ID);
    });

    it('STAFF GET /api/staff/me returns their own profile', async () => {
      const res = await request(app)
        .get('/api/staff/me')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(ARUN_STAFF_RECORD_ID);
      expect(res.body.data.staff_id).toBe(ARUN_STAFF_ID);
    });

    it('STAFF GET /api/staff/:ownId allows access to own staff record', async () => {
      const res = await request(app)
        .get(`/api/staff/${ARUN_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff_id).toBe(ARUN_STAFF_ID);
    });

    it('STAFF GET /api/tasks returns strictly tasks assigned to them', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const task of res.body.data) {
        expect(task.assigned_staff_id).toBe(ARUN_STAFF_RECORD_ID);
      }
    });

    it('STAFF GET /api/attendance returns strictly own attendance records', async () => {
      const res = await request(app)
        .get('/api/attendance')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const record of res.body.data) {
        expect(record.staff_id).toBe(ARUN_STAFF_RECORD_ID);
      }
    });

    it('STAFF GET /api/leave returns strictly own leave requests', async () => {
      const res = await request(app)
        .get('/api/leave')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const leave of res.body.data) {
        expect(leave.staff_id).toBe(ARUN_STAFF_RECORD_ID);
      }
    });

    it('STAFF GET /api/activity returns strictly own activity', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const act of res.body.data) {
        expect(act.staff_id).toBe(ARUN_STAFF_RECORD_ID);
      }
    });

    it('STAFF GET /api/workload returns strictly own workload metrics', async () => {
      const res = await request(app)
        .get('/api/workload')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const wl of res.body.data) {
        expect(wl.staff_id).toBe(ARUN_STAFF_RECORD_ID);
      }
    });

    it('STAFF GET /api/performance returns strictly own performance', async () => {
      const res = await request(app)
        .get('/api/performance')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const perf of res.body.data) {
        expect(perf.staff_id).toBe(ARUN_STAFF_RECORD_ID);
      }
    });
  });

  // ==========================================
  // SECTION 3: IDOR PROTECTION (BLOCK VECTORS)
  // ==========================================
  describe('3. IDOR Attack Protection (Blocks Unauthorized Cross-Staff Access)', () => {
    it('BLOCKS GET /api/staff/OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/staff/:otherId (UUID) with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/${OTHER_STAFF_RECORD_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS PUT /api/staff/OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/staff/${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie)
        .send({ phone: '+91 99999 88888' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/attendance?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/attendance?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/attendance?staffId=OTHER_STAFF_RECORD_ID (UUID) with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/attendance?staffId=${OTHER_STAFF_RECORD_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/tasks?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/tasks?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/leave?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/leave?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/activity?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/activity?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/workload?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/workload?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/performance?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/performance?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/timetable?staffId=OTHER_STAFF_ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/timetable?staffId=${OTHER_STAFF_ID}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/tasks/:id where task belongs to other staff with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/tasks/task-priya-001')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS PATCH /api/tasks/:id where task belongs to other staff with 403 Forbidden', async () => {
      const res = await request(app)
        .patch('/api/tasks/task-priya-001')
        .set('Cookie', staffArunCookie)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS GET /api/leave/:id where leave belongs to other staff with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/leave/leave-priya-001')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS POST /api/leave with forged body staff_id pointing to another staff with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/leave')
        .set('Cookie', staffArunCookie)
        .send({
          staff_id: OTHER_STAFF_RECORD_ID,
          leave_type: 'CASUAL',
          start_date: '2026-11-01',
          end_date: '2026-11-02',
          reason: 'Forged leave request',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('BLOCKS unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/staff');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
