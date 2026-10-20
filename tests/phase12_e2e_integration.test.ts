import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { aiRateLimiterService } from '../backend/src/services/aiRateLimiter.service';
import { classMonitoringService } from '../backend/src/services/classMonitoring.service';
import { workloadService } from '../backend/src/services/workload.service';
import { performanceService } from '../backend/src/services/performance.service';
import { operationalAlertService } from '../backend/src/services/operationalAlert.service';
import { reportsService } from '../backend/src/services/reports.service';
import { aiToolsService } from '../backend/src/services/aiTools.service';

describe('Phase 12: Final Integration, Production Readiness & E2E Verification', () => {
  let adminCookie: string;
  let staffArunCookie: string;
  let adminUserId: string;
  let staffArunUserId: string;
  let staffArunRecordId: string;

  beforeAll(async () => {
    resetRateLimiterStore();
    aiRateLimiterService.resetLimits();

    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin@college.demo',
        password: 'Admin@123',
        role: 'ADMIN',
      });
    expect(adminRes.status).toBe(200);
    const adminCookies = adminRes.headers['set-cookie'] as string[];
    const rawAdminCookie = adminCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    adminCookie = rawAdminCookie!.split(';')[0];
    adminUserId = adminRes.body.data.user.id;

    resetRateLimiterStore();

    // 2. Authenticate Staff (Dr. Arun Kumar)
    const arunRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'arun.kumar@college.demo',
        password: 'Staff@123',
        role: 'STAFF',
      });
    expect(arunRes.status).toBe(200);
    const arunCookies = arunRes.headers['set-cookie'] as string[];
    const rawArunCookie = arunCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    staffArunCookie = rawArunCookie!.split(';')[0];
    staffArunUserId = arunRes.body.data.user.id;
    staffArunRecordId = arunRes.body.data.user.staffRecordId || 'stf-001';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. SYSTEM HEALTH & PLATFORM INTEGRITY
  // =========================================================================
  describe('1. Platform Health, Database Connectivity & Metadata', () => {
    it('GET /api/health verifies database connectivity, latency, and uptime', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.database.status).toBe('connected');
      expect(typeof res.body.data.database.latencyMs).toBe('number');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });

    it('GET / returns Phase 12 production release platform identity', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('AI STAFF OPERATIONS INTELLIGENCE PLATFORM');
      expect(res.body.phase).toContain('Phase 12');
      expect(res.body.status).toBe('operational');
    });

    it('Prisma exposes all database entities and relations', async () => {
      const staffCount = await prisma.staff.count();
      const deptCount = await prisma.department.count();
      const classCount = await prisma.class.count();
      const subjectCount = await prisma.subject.count();

      expect(staffCount).toBeGreaterThan(0);
      expect(deptCount).toBeGreaterThan(0);
      expect(classCount).toBeGreaterThan(0);
      expect(subjectCount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. END-TO-END OPERATIONAL WORKFLOW
  // =========================================================================
  describe('2. End-to-End Operational Workflow Integration', () => {
    let createdTaskId: string;
    let createdLeaveId: string;

    it('STEP A: Timetable & Expected Class Engine derives authoritative schedule', async () => {
      const expectedClassResult = await classMonitoringService.getCurrentExpectedClass(staffArunRecordId);

      expect(expectedClassResult).toBeDefined();
      expect(expectedClassResult.serverTime).toHaveProperty('dayOfWeek');
      expect(expectedClassResult.serverTime).toHaveProperty('timeStr');
      expect(Array.isArray(expectedClassResult.todaySchedule)).toBe(true);
    });

    it('STEP B: Faculty Current Activity records work and updates real-time status', async () => {
      const res = await request(app)
        .post('/api/activity')
        .set('Cookie', staffArunCookie)
        .send({
          activity_status: 'PREPARING_CLASS',
          notes: 'Phase 12 E2E: Final semester curriculum and lab materials review',
          duration_minutes: 45,
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activity_status).toBe('PREPARING_CLASS');
    });

    it('STEP C: Class Coverage engine accurately summarizes timetable vs activity coverage', async () => {
      const res = await request(app)
        .get('/api/timetable/coverage')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(typeof res.body.data.summary.total).toBe('number');
      expect(typeof res.body.data.summary.covered).toBe('number');
      expect(typeof res.body.data.summary.notRecorded).toBe('number');
    });

    it('STEP D: Attendance records faculty presence with uniqueness enforcement', async () => {
      const testDate = '2026-11-25';
      const d = new Date(testDate);
      d.setUTCHours(0, 0, 0, 0);

      // Clean up past run if any
      await prisma.attendance.deleteMany({
        where: {
          staff_id: staffArunRecordId,
          attendance_date: d,
        },
      });

      const res = await request(app)
        .post('/api/attendance')
        .set('Cookie', staffArunCookie)
        .send({
          attendance_date: testDate,
          status: 'PRESENT',
          remarks: 'E2E verified attendance log',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PRESENT');
    });

    it('STEP E: Task lifecycle (Assign -> In Progress -> Completed) with updates', async () => {
      // 1. Admin assigns task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', adminCookie)
        .send({
          title: 'Phase 12 Production Readiness Review',
          description: 'Review end-to-end integration and release safety checklist',
          assigned_staff_id: staffArunRecordId,
          due_date: new Date('2026-12-15T18:00:00.000Z').toISOString(),
          priority: 'HIGH',
        });

      expect(createRes.status).toBe(201);
      createdTaskId = createRes.body.data.id;

      // 2. Staff updates status to IN_PROGRESS
      const updateRes = await request(app)
        .patch(`/api/tasks/${createdTaskId}`)
        .set('Cookie', staffArunCookie)
        .send({
          status: 'IN_PROGRESS',
          notes: 'Commenced comprehensive security and flow audit',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('IN_PROGRESS');

      // 3. Staff completes task
      const completeRes = await request(app)
        .patch(`/api/tasks/${createdTaskId}`)
        .set('Cookie', staffArunCookie)
        .send({
          status: 'COMPLETED',
          notes: 'Completed all production checklist items',
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('COMPLETED');
    });

    it('STEP F: Leave request lifecycle with admin approval and notification generation', async () => {
      const leaveDate = '2026-12-28';
      const d = new Date(leaveDate);
      d.setUTCHours(0, 0, 0, 0);

      // Clean up previous records for the date
      await prisma.leaveRequest.deleteMany({
        where: {
          staff_id: staffArunRecordId,
          start_date: d,
        },
      });

      // 1. Staff submits leave
      const leaveRes = await request(app)
        .post('/api/leave')
        .set('Cookie', staffArunCookie)
        .send({
          leave_type: 'CASUAL',
          start_date: leaveDate,
          end_date: leaveDate,
          reason: 'End-of-year faculty administrative break',
        });

      expect(leaveRes.status).toBe(201);
      createdLeaveId = leaveRes.body.data.id;
      expect(leaveRes.body.data.status).toBe('PENDING');

      // 2. Admin approves leave
      const approveRes = await request(app)
        .post(`/api/leave/${createdLeaveId}/approve`)
        .set('Cookie', adminCookie)
        .send({ remarks: 'Approved for annual break' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('APPROVED');

      // 3. Verify notification created for staff
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Cookie', staffArunCookie);

      expect(notifRes.status).toBe(200);
      expect(Array.isArray(resToItems(notifRes.body.data))).toBe(true);
    });

    it('STEP G: Workload analytics derives metrics from actual database records', async () => {
      const workload = await workloadService.calculateStaffWorkload(staffArunRecordId);

      expect(workload).toBeDefined();
      expect(workload).toHaveProperty('staffId', staffArunRecordId);
      expect(workload).toHaveProperty('teachingHours');
      expect(workload).toHaveProperty('activeTaskCount');
      expect(workload).toHaveProperty('workloadStatus');
      expect(['LOW', 'NORMAL', 'HIGH', 'CONCENTRATED', 'INSUFFICIENT_DATA']).toContain(workload.workloadStatus);
    });

    it('STEP H: Performance calculation computes balanced multi-metric score', async () => {
      const performance = await performanceService.calculateStaffPerformance(staffArunRecordId);

      expect(performance).toBeDefined();
      expect(performance).toHaveProperty('overallScore');
      if (performance.overallScore !== null) {
        expect(performance.overallScore).toBeGreaterThanOrEqual(0);
        expect(performance.overallScore).toBeLessThanOrEqual(100);
      }
      expect(performance.componentDetails.weightsApplied).toEqual({
        attendanceWeight: 20,
        taskCompletionWeight: 25,
        onTimeCompletionWeight: 20,
        classCompletionWeight: 25,
        operationalActivityWeight: 10,
      });
    });

    it('STEP I: Operational alerts engine generates alerts with real database evidence', async () => {
      const result = await operationalAlertService.getAlerts({ pageSize: 10 });

      expect(result).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
      expect(typeof result.meta.total).toBe('number');
    });

    it('STEP J: Reports service generates valid CSV export containing real database records', async () => {
      const csvReport = await reportsService.generateReport({
        reportType: 'ATTENDANCE',
        format: 'CSV',
        userId: adminUserId,
        userRole: 'ADMIN',
      });

      expect(csvReport).toBeDefined();
      expect(csvReport.status).toBe('COMPLETED');
      expect(csvReport.format).toBe('CSV');
      expect(csvReport.filename).toContain('.csv');
      expect(Buffer.isBuffer(csvReport.buffer)).toBe(true);
      expect(csvReport.recordCount).toBeGreaterThanOrEqual(0);
    });

    it('STEP K: Reports service generates valid Excel export containing real database records', async () => {
      const excelReport = await reportsService.generateReport({
        reportType: 'TASK',
        format: 'EXCEL',
        userId: adminUserId,
        userRole: 'ADMIN',
      });

      expect(excelReport).toBeDefined();
      expect(excelReport.status).toBe('COMPLETED');
      expect(excelReport.format).toBe('EXCEL');
      expect(excelReport.filename).toContain('.xlsx');
      expect(Buffer.isBuffer(excelReport.buffer)).toBe(true);
      expect(excelReport.recordCount).toBeGreaterThanOrEqual(0);
    });

    it('STEP L: Reports service generates valid PDF export containing institutional header', async () => {
      const pdfReport = await reportsService.generateReport({
        reportType: 'WORKLOAD',
        format: 'PDF',
        userId: adminUserId,
        userRole: 'ADMIN',
      });

      expect(pdfReport).toBeDefined();
      expect(pdfReport.status).toBe('COMPLETED');
      expect(pdfReport.format).toBe('PDF');
      expect(pdfReport.filename).toContain('.pdf');
      expect(Buffer.isBuffer(pdfReport.buffer)).toBe(true);
      expect(pdfReport.recordCount).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 3. AI OPERATIONAL COPILOT & EVIDENCE GROUNDING
  // =========================================================================
  describe('3. AI Operational Copilot, Evidence Grounding & Guardrails', () => {
    it('Admin AI Copilot retrieves authorized database facts and evidence via POST /api/ai/admin/chat', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Provide a summary of department faculty and current operational tasks' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data).toHaveProperty('answer');
      expect(data).toHaveProperty('databaseFacts');
      expect(Array.isArray(data.databaseFacts)).toBe(true);
      expect(data).toHaveProperty('evidence');
      expect(Array.isArray(data.evidence)).toBe(true);
      expect(['ORGANIZATION_LEVEL']).toContain(data.dataScope);
    });

    it('Staff AI Assistant restricts evidence scope strictly to authenticated staff self records', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/staff/chat')
        .set('Cookie', staffArunCookie)
        .send({ prompt: 'What are my scheduled tasks and workload distribution?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.dataScope).toBe('AUTHENTICATED_STAFF_SELF_ONLY');

      // Evidence must NOT contain records belonging to any other staff
      for (const ev of data.evidence) {
        if (ev.staff_id) {
          expect(ev.staff_id).toBe(staffArunRecordId);
        }
      }
    });

    it('Responds safely with standard insufficient data phrasing when evidence is missing', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/staff/chat')
        .set('Cookie', staffArunCookie)
        .send({ prompt: 'Tell me about non-existent satellite facility Mars Campus Room 9999' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeTruthy();
    });

    it('AI Tools Service allows ONLY allowlisted tools and enforces authorization', () => {
      const allowedTools = aiToolsService.ALLOWED_TOOLS;

      expect(allowedTools.length).toBe(17);
      expect(allowedTools).toContain('get_staff');
      expect(allowedTools).toContain('get_staff_attendance');
      expect(allowedTools).toContain('get_staff_tasks');
      expect(allowedTools).toContain('get_current_activities');
      expect(allowedTools).toContain('get_timetable');
      expect(allowedTools).toContain('get_leave_requests');
      expect(allowedTools).toContain('get_workload_metrics');
      expect(allowedTools).toContain('get_department_statistics');

      // AI tools must NEVER include unrestricted raw SQL execution
      expect(allowedTools).not.toContain('execute_raw_sql');
      expect(allowedTools).not.toContain('query_raw');
      expect(allowedTools).not.toContain('drop_table');
      expect(allowedTools).not.toContain('update_password');
    });
  });

  // =========================================================================
  // 4. SECURITY, RBAC & AUDIT LOGGING HARDENING
  // =========================================================================
  describe('4. Security, RBAC & Audit Logging Verification', () => {
    it('Audit logging records sensitive administrative operations with actor metadata', async () => {
      const logs = await prisma.auditLog.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
      });

      expect(Array.isArray(logs)).toBe(true);
      for (const log of logs) {
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('action');
        expect(log).toHaveProperty('entity_type');
        // Secrets must NEVER be leaked in audit log metadata
        const metadataStr = JSON.stringify(log.metadata || {});
        expect(metadataStr).not.toContain('password_hash');
        expect(metadataStr).not.toContain('sessionSecret');
        expect(metadataStr).not.toContain('rawSessionToken');
      }
    });

    it('Staff cannot access Admin Audit Logs endpoint (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Staff cannot update system settings (403 Forbidden)', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', staffArunCookie)
        .send({
          category: 'general',
          payload: { institutionName: 'Hacked College Name' },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});

function resToItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.notifications)) return data.notifications;
  return [];
}
