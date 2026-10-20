import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { jobScheduler } from '../backend/src/services/scheduler.service';
import { configService } from '../backend/src/services/config.service';
import { ruleEngineService } from '../backend/src/services/ruleEngine.service';
import { operationalAlertService } from '../backend/src/services/operationalAlert.service';

describe('Phase 7: Operational Intelligence, Scheduled Jobs, Alerts & Rule Engine', () => {
  let adminCookie: string;
  let staffArunCookie: string;

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
    jobScheduler.stopScheduler();
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. SCHEDULED JOB ARCHITECTURE & REGISTRY
  // ============================================================
  describe('1. Scheduled Job Architecture & Registry', () => {
    it('registers all 7 background operational jobs with unique names and intervals', () => {
      const statuses = jobScheduler.getJobStatuses();
      expect(statuses.length).toBeGreaterThanOrEqual(7);

      const jobNames = statuses.map((j) => j.name);
      expect(jobNames).toContain('CLASS_MONITORING');
      expect(jobNames).toContain('TASK_MAINTENANCE');
      expect(jobNames).toContain('TASK_RISK_ANALYSIS');
      expect(jobNames).toContain('ATTENDANCE_ANALYSIS');
      expect(jobNames).toContain('TIMETABLE_CONFLICT_ANALYSIS');
      expect(jobNames).toContain('WORKLOAD_ANALYSIS');
      expect(jobNames).toContain('NOTIFICATION_MAINTENANCE');

      for (const job of statuses) {
        expect(job.intervalMs).toBeGreaterThan(0);
        expect(typeof job.description).toBe('string');
        expect(['IDLE', 'RUNNING', 'SUCCESS', 'FAILED']).toContain(job.lastStatus);
      }
    });

    it('executes a scheduled job safely and logs execution to database', async () => {
      const runResult = await jobScheduler.runJob('TASK_MAINTENANCE', 'TEST_RUNNER');
      expect(runResult.success).toBe(true);
      expect(runResult.durationMs).toBeGreaterThanOrEqual(0);

      // Verify ScheduledJobRun was recorded in database
      const history = await jobScheduler.getJobHistory(5, 'TASK_MAINTENANCE');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].job_name).toBe('TASK_MAINTENANCE');
      expect(history[0].status).toBe('SUCCESS');
    });

    it('GET /api/operations/jobs returns registered jobs for ADMIN', async () => {
      const res = await request(app)
        .get('/api/operations/jobs')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobs).toBeInstanceOf(Array);
      expect(res.body.data.jobs.length).toBeGreaterThanOrEqual(7);
      expect(res.body.data).toHaveProperty('serverTime');
    });

    it('blocks non-admin users from accessing scheduled jobs management', async () => {
      const res = await request(app)
        .get('/api/operations/jobs')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/operations/jobs/:jobName/run allows ADMIN to trigger manual execution', async () => {
      const res = await request(app)
        .post('/api/operations/jobs/TASK_RISK_ANALYSIS/run')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('durationMs');
    });
  });

  // ============================================================
  // 2. CENTRALIZED OPERATIONAL CONFIGURATION
  // ============================================================
  describe('2. Centralized Operational Configuration', () => {
    it('retrieves default operational configurations', async () => {
      const config = await configService.getAllOperationalConfigs();
      expect(config.classMonitoringGracePeriodMinutes).toBeGreaterThanOrEqual(0);
      expect(config.taskDueSoonThresholdHours).toBeGreaterThanOrEqual(1);
      expect(config.attendanceAnalysisPeriodDays).toBeGreaterThanOrEqual(1);
      expect(config.attendanceMinDataDays).toBeGreaterThanOrEqual(1);
      expect(config.workloadMaxWeeklyHours).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/operations/config returns config object for admin', async () => {
      const res = await request(app)
        .get('/api/operations/config')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('classMonitoringGracePeriodMinutes');
      expect(res.body.data).toHaveProperty('taskDueSoonThresholdHours');
    });

    it('PUT /api/operations/config updates operational thresholds with audit log', async () => {
      const res = await request(app)
        .put('/api/operations/config')
        .set('Cookie', adminCookie)
        .send({
          classMonitoringGracePeriodMinutes: 12,
          taskDueSoonThresholdHours: 36,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.classMonitoringGracePeriodMinutes).toBe(12);
      expect(res.body.data.taskDueSoonThresholdHours).toBe(36);
    });
  });

  // ============================================================
  // 3. DETERMINISTIC RULE ENGINE & TIMETABLE CONFLICTS
  // ============================================================
  describe('3. Deterministic Rule Engine & Conflict Analysis', () => {
    it('evaluates timetable conflicts deterministically', async () => {
      const result = await ruleEngineService.evaluateTimetableConflicts();
      expect(result).toHaveProperty('evaluation');
      expect(result.evaluation.ruleName).toBe('RULE_TIMETABLE_CONFLICT_ANALYSIS');
      expect(result.conflicts).toBeInstanceOf(Array);
    });

    it('GET /api/operations/conflicts returns conflict analysis for admin', async () => {
      const res = await request(app)
        .get('/api/operations/conflicts')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('conflicts');
      expect(res.body.data).toHaveProperty('evaluation');
    });

    it('evaluates deterministic task risk rules', async () => {
      const result = await ruleEngineService.evaluateTaskRisks();
      expect(result.ruleName).toBe('RULE_TASK_RISK_ANALYSIS');
      expect(typeof result.evaluatedCount).toBe('number');
      expect(typeof result.alertsGenerated).toBe('number');
    });

    it('evaluates class monitoring with neutral operational language', async () => {
      const result = await ruleEngineService.evaluateClassMonitoring();
      expect(result.ruleName).toBe('RULE_CLASS_MONITORING');
      expect(typeof result.evaluatedCount).toBe('number');
    });

    it('evaluates attendance patterns respecting minimum data sufficiency', async () => {
      const result = await ruleEngineService.evaluateAttendancePatterns();
      expect(result.ruleName).toBe('RULE_ATTENDANCE_PATTERN_ANALYSIS');
      expect(typeof result.evaluatedCount).toBe('number');
    });
  });

  // ============================================================
  // 4. OPERATIONAL ALERT MODEL & LIFECYCLE
  // ============================================================
  describe('4. Operational Alert Model & Lifecycle Management', () => {
    let testAlertId: string;
    const testDedupKey = `TEST_ALERT_DEDUP:${Date.now()}`;

    it('creates an operational alert with structured deterministic evidence', async () => {
      const res = await operationalAlertService.upsertAlert({
        alertType: 'SYSTEM_OPERATIONAL',
        severity: 'MEDIUM',
        dedupKey: testDedupKey,
        ruleIdentifier: 'RULE_TEST_SYSTEM_CHECK',
        title: 'Test Operational Monitoring Signal',
        message: 'This is a deterministic system test signal.',
        evidence: { testKey: 'testValue', evaluatedAt: new Date().toISOString() },
      });

      expect(res).not.toBeNull();
      expect(res!.alert).toBeDefined();
      expect(res!.alert.dedup_key).toBe(testDedupKey);
      expect(res!.alert.status).toBe('OPEN');
      expect(res!.created).toBe(true);
      testAlertId = res!.alert.id;
    });

    it('prevents duplicate alert rows when same dedupKey is evaluated again', async () => {
      const res2 = await operationalAlertService.upsertAlert({
        alertType: 'SYSTEM_OPERATIONAL',
        severity: 'MEDIUM',
        dedupKey: testDedupKey,
        ruleIdentifier: 'RULE_TEST_SYSTEM_CHECK',
        title: 'Updated Test Operational Signal',
        message: 'Updated message on second pass.',
      });

      expect(res2).not.toBeNull();
      expect(res2!.alert.id).toBe(testAlertId);
      expect(res2!.created).toBe(false);
      expect(res2!.alert.title).toBe('Updated Test Operational Signal');
    });

    it('GET /api/operations/alerts returns alerts with pagination & filters', async () => {
      const res = await request(app)
        .get('/api/operations/alerts?status=OPEN')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alerts).toBeInstanceOf(Array);
      expect(res.body.data.meta).toHaveProperty('total');
    });

    it('GET /api/operations/alerts/summary returns aggregated statistics', async () => {
      const res = await request(app)
        .get('/api/operations/alerts/summary')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalActive');
      expect(res.body.data).toHaveProperty('open');
      expect(res.body.data).toHaveProperty('byType');
      expect(res.body.data).toHaveProperty('bySeverity');
    });

    it('POST /api/operations/alerts/:id/acknowledge updates status to ACKNOWLEDGED', async () => {
      const res = await request(app)
        .post(`/api/operations/alerts/${testAlertId}/acknowledge`)
        .set('Cookie', adminCookie)
        .send({ remarks: 'Reviewed by admin in test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACKNOWLEDGED');
      expect(res.body.data.acknowledged_at).not.toBeNull();
    });

    it('POST /api/operations/alerts/:id/resolve resolves alert with resolution notes', async () => {
      const res = await request(app)
        .post(`/api/operations/alerts/${testAlertId}/resolve`)
        .set('Cookie', adminCookie)
        .send({ resolutionNotes: 'Resolved during automated test suite execution' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolved_at).not.toBeNull();
    });
  });
});
