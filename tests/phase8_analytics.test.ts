import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { workloadService } from '../backend/src/services/workload.service';
import { performanceService } from '../backend/src/services/performance.service';
import { analyticsService } from '../backend/src/services/analytics.service';
import { jobScheduler } from '../backend/src/services/scheduler.service';

describe('Phase 8: Workload Performance Analytics, Dashboards & IDOR Protection', () => {
  let adminCookie: string;
  let staffArunCookie: string;
  let staffPriyaCookie: string;
  let staffArunId: string;
  let staffPriyaId: string;

  beforeAll(async () => {
    resetRateLimiterStore();

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

    resetRateLimiterStore();

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
    staffArunId = staffLoginRes.body.data.user.staffRecordId || staffLoginRes.body.data.user.staffId;

    resetRateLimiterStore();

    // 3. Log in as STAFF (Prof. Priya Sharma)
    const priyaLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'priya.sharma@college.demo',
        password: 'Staff@123',
        role: 'STAFF',
      });
    expect(priyaLoginRes.status).toBe(200);
    const priyaSetCookie = priyaLoginRes.headers['set-cookie'] as string[];
    const rawPriyaCookie = priyaSetCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    staffPriyaCookie = rawPriyaCookie!.split(';')[0];
    staffPriyaId = priyaLoginRes.body.data.user.staffRecordId || priyaLoginRes.body.data.user.staffId;
  });

  afterAll(async () => {
    jobScheduler.stopScheduler();
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. DETERMINISTIC WORKLOAD CALCULATION & METRICS
  // ============================================================
  describe('1. Workload Calculation & Metrics', () => {
    it('calculates deterministic workload metrics for staff from database records', async () => {
      const result = await workloadService.calculateStaffWorkload(staffArunId);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.staffId).toBe(staffArunId);
        expect(typeof result.teachingHours).toBe('number');
        expect(typeof result.activeTaskCount).toBe('number');
        expect(typeof result.pendingTaskCount).toBe('number');
        expect(typeof result.inProgressTaskCount).toBe('number');
        expect(typeof result.completedTaskCount).toBe('number');
        expect(typeof result.overdueTaskCount).toBe('number');
        expect(typeof result.workloadScore).toBe('number');
        expect(['LOW', 'NORMAL', 'HIGH', 'CONCENTRATED', 'INSUFFICIENT_DATA']).toContain(
          result.workloadStatus
        );
        expect(result.contributingFactors).toBeDefined();
        expect(result.explanation).toBeDefined();
      }
    });

    it('GET /api/workload returns only own workload records for STAFF', async () => {
      const res = await request(app)
        .get('/api/workload')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      for (const record of res.body.data) {
        expect(record.staff_id).toBe(staffArunId);
      }
    });

    it('blocks STAFF from querying another staff member workload (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/workload?staffId=${staffPriyaId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows ADMIN to query workload for all staff or specific staff', async () => {
      const resAll = await request(app)
        .get('/api/workload')
        .set('Cookie', adminCookie);

      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(resAll.body.data).toBeInstanceOf(Array);

      const resSpecific = await request(app)
        .get(`/api/workload?staffId=${staffArunId}`)
        .set('Cookie', adminCookie);

      expect(resSpecific.status).toBe(200);
      expect(resSpecific.body.success).toBe(true);
    });
  });

  // ============================================================
  // 2. DETERMINISTIC PERFORMANCE CALCULATION & WEIGHTS
  // ============================================================
  describe('2. Performance Calculation, Scoring & Configurable Weights', () => {
    it('calculates performance score deterministically without inventing data', async () => {
      const result = await performanceService.calculateStaffPerformance(staffArunId);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.staffId).toBe(staffArunId);
        expect(result.componentDetails).toBeDefined();
        expect(result.componentDetails.weightsApplied).toBeDefined();
        expect(['COMPLETE', 'PARTIAL', 'INSUFFICIENT_DATA']).toContain(result.dataCompleteness);
      }
    });

    it('retrieves default performance weights that strictly sum to 100%', async () => {
      const weights = await performanceService.getPerformanceWeights();
      const total =
        weights.attendanceWeight +
        weights.taskCompletionWeight +
        weights.onTimeCompletionWeight +
        weights.classCompletionWeight +
        weights.operationalActivityWeight;

      expect(Math.round(total)).toBe(100);
    });

    it('GET /api/performance/weights returns current weights', async () => {
      const res = await request(app)
        .get('/api/performance/weights')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendanceWeight).toBeDefined();
    });

    it('rejects invalid performance weights (sum != 100 or negative)', async () => {
      const resInvalidSum = await request(app)
        .put('/api/performance/weights')
        .set('Cookie', adminCookie)
        .send({
          attendanceWeight: 50,
          taskCompletionWeight: 50,
          onTimeCompletionWeight: 20,
          classCompletionWeight: 20,
          operationalActivityWeight: 10,
        });

      expect(resInvalidSum.status).toBe(400);
      expect(resInvalidSum.body.success).toBe(false);
    });

    it('blocks STAFF users from modifying performance weights', async () => {
      const res = await request(app)
        .put('/api/performance/weights')
        .set('Cookie', staffArunCookie)
        .send({
          attendanceWeight: 20,
          taskCompletionWeight: 20,
          onTimeCompletionWeight: 20,
          classCompletionWeight: 20,
          operationalActivityWeight: 20,
        });

      expect(res.status).toBe(403);
    });

    it('allows ADMIN to update performance weights and creates audit log', async () => {
      const res = await request(app)
        .put('/api/performance/weights')
        .set('Cookie', adminCookie)
        .send({
          attendanceWeight: 20,
          taskCompletionWeight: 20,
          onTimeCompletionWeight: 20,
          classCompletionWeight: 20,
          operationalActivityWeight: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendanceWeight).toBe(20);

      // Verify audit log
      const logs = await prisma.auditLog.findMany({
        where: { action: 'UPDATE_PERFORMANCE_WEIGHTS' },
        orderBy: { created_at: 'desc' },
        take: 1,
      });
      expect(logs.length).toBe(1);

      // Reset back to standard defaults for consistency
      await performanceService.updatePerformanceWeights({
        attendanceWeight: 20,
        taskCompletionWeight: 25,
        onTimeCompletionWeight: 20,
        classCompletionWeight: 25,
        operationalActivityWeight: 10,
      });
    });

    it('GET /api/performance blocks IDOR attempts from STAFF', async () => {
      const res = await request(app)
        .get(`/api/performance?staffId=${staffPriyaId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================
  // 3. ADMIN ANALYTICS APIS
  // ============================================================
  describe('3. Admin Analytics APIs', () => {
    it('GET /api/analytics/admin/overview returns comprehensive institutional metrics', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/overview')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalStaff');
      expect(res.body.data).toHaveProperty('presentStaff');
      expect(res.body.data).toHaveProperty('absentStaff');
      expect(res.body.data).toHaveProperty('staffOnApprovedLeave');
      expect(res.body.data).toHaveProperty('scheduledClassesToday');
      expect(res.body.data).toHaveProperty('completedClassesToday');
      expect(res.body.data).toHaveProperty('tasks');
      expect(res.body.data).toHaveProperty('departmentsSummary');
    });

    it('GET /api/analytics/admin/workload returns aggregated workload analytics and distribution', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/workload')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('statusDistribution');
      expect(res.body.data).toHaveProperty('aggregateTotals');
      expect(res.body.data).toHaveProperty('departmentSummary');
    });

    it('GET /api/analytics/admin/performance returns performance scores and distribution', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/performance')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('scoreDistribution');
      expect(res.body.data).toHaveProperty('configuredWeights');
    });

    it('GET /api/analytics/admin/attendance returns timeline and attendance rates', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/attendance')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('timeline');
    });

    it('GET /api/analytics/admin/tasks returns task status and priority breakdowns', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/tasks')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('byStatus');
      expect(res.body.data).toHaveProperty('byPriority');
      expect(res.body.data).toHaveProperty('completionRate');
    });

    it('blocks non-admin users from accessing admin analytics', async () => {
      const res = await request(app)
        .get('/api/analytics/admin/overview')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // 4. STAFF ANALYTICS APIS (SELF ONLY)
  // ============================================================
  describe('4. Staff Analytics APIs', () => {
    it('GET /api/analytics/staff/overview returns personal overview for logged in staff', async () => {
      const res = await request(app)
        .get('/api/analytics/staff/overview')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.staff.id).toBe(staffArunId);
      expect(res.body.data).toHaveProperty('currentWorkload');
      expect(res.body.data).toHaveProperty('currentPerformance');
      expect(res.body.data).toHaveProperty('tasksSummary');
    });

    it('GET /api/analytics/staff/workload returns current workload and history', async () => {
      const res = await request(app)
        .get('/api/analytics/staff/workload')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('current');
      expect(res.body.data).toHaveProperty('history');
    });

    it('GET /api/analytics/staff/performance returns performance history and weights', async () => {
      const res = await request(app)
        .get('/api/analytics/staff/performance')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('current');
      expect(res.body.data).toHaveProperty('history');
      expect(res.body.data).toHaveProperty('weights');
    });

    it('GET /api/analytics/staff/attendance returns personal attendance history', async () => {
      const res = await request(app)
        .get('/api/analytics/staff/attendance')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('rate');
      expect(res.body.data).toHaveProperty('records');
    });

    it('GET /api/analytics/staff/tasks returns personal assigned tasks', async () => {
      const res = await request(app)
        .get('/api/analytics/staff/tasks')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('pending');
      expect(res.body.data).toHaveProperty('completed');
    });
  });

  // ============================================================
  // 5. SCHEDULED JOBS: WORKLOAD & PERFORMANCE
  // ============================================================
  describe('5. Scheduled Jobs for Workload & Operations', () => {
    it('executes WORKLOAD_ANALYSIS job successfully', async () => {
      const result = await jobScheduler.runJob('WORKLOAD_ANALYSIS', 'TEST_RUNNER');
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.runRecord?.job_name).toBe('WORKLOAD_ANALYSIS');
    }, 30000);
  });
});
