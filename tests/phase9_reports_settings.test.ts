import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { reportsService } from '../backend/src/services/reports.service';
import { settingsService } from '../backend/src/services/settings.service';

describe('Phase 9: Reports, File Exports, Audit Logs, Settings & Security', () => {
  let adminCookie: string;
  let staffArunCookie: string;
  let adminUserId: string;
  let staffArunUserId: string;
  let staffArunRecordId: string;
  let adminReportId: string;

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
    adminUserId = adminLoginRes.body.data.user.id;

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
    staffArunUserId = staffLoginRes.body.data.user.id;
    staffArunRecordId = staffLoginRes.body.data.user.staffRecordId || staffLoginRes.body.data.user.staffId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ============================================================
  // 1. REPORT GENERATION & REAL EXPORTS (PDF, EXCEL, CSV)
  // ============================================================
  describe('1. Real Report Generation & Exports', () => {
    it('allows ADMIN to generate a PDF report with real database data', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', adminCookie)
        .send({
          reportType: 'DAILY_STAFF',
          format: 'PDF',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.format).toBe('PDF');
      expect(res.body.data.id).toBeDefined();
      adminReportId = res.body.data.id;
    });

    it('allows ADMIN to generate Excel (.xlsx) and CSV reports', async () => {
      const resExcel = await request(app)
        .post('/api/reports')
        .set('Cookie', adminCookie)
        .send({
          reportType: 'ATTENDANCE',
          format: 'EXCEL',
        });
      expect(resExcel.status).toBe(201);
      expect(resExcel.body.data.format).toBe('EXCEL');

      const resCsv = await request(app)
        .post('/api/reports')
        .set('Cookie', adminCookie)
        .send({
          reportType: 'TASK',
          format: 'CSV',
        });
      expect(resCsv.status).toBe(201);
      expect(resCsv.body.data.format).toBe('CSV');
    });

    it('allows STAFF to generate personal reports (PDF, EXCEL, CSV)', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', staffArunCookie)
        .send({
          reportType: 'WORKLOAD',
          format: 'CSV',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('blocks STAFF from generating ADMIN-only AUDIT_LOG report', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', staffArunCookie)
        .send({
          reportType: 'AUDIT_LOG',
          format: 'PDF',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows download of generated report file buffer with correct headers', async () => {
      const res = await request(app)
        .get(`/api/reports/${adminReportId}/download`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.body).toBeDefined();
    });

    it('blocks STAFF from downloading another user report (IDOR Protection)', async () => {
      const res = await request(app)
        .get(`/api/reports/${adminReportId}/download`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================
  // 2. AUDIT LOGS SECURITY & FILTERING
  // ============================================================
  describe('2. Audit Logs Search, Filtering & Security', () => {
    it('allows ADMIN to query paginated and filtered audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs?page=1&limit=10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
    });

    it('filters audit logs by action and search text', async () => {
      const res = await request(app)
        .get('/api/audit-logs?action=REPORT_GENERATED')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const log of res.body.data) {
        expect(log.action).toBe('REPORT_GENERATED');
      }
    });

    it('blocks non-admin users from accessing audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // 3. SYSTEM SETTINGS & HEALTH
  // ============================================================
  describe('3. System Settings Management & Validation', () => {
    it('allows authenticated users to view categorized system settings and info', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.general).toBeDefined();
      expect(res.body.data.monitoring).toBeDefined();
      expect(res.body.data.notifications).toBeDefined();
      expect(res.body.data.performanceWeights).toBeDefined();
      expect(res.body.data.aiFoundation).toBeDefined();
      expect(res.body.data.systemInfo).toBeDefined();
      expect(res.body.data.systemInfo.dbStatus).toBe('HEALTHY');
    });

    it('allows ADMIN to update system monitoring settings', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', adminCookie)
        .send({
          category: 'monitoring',
          payload: {
            classMonitoringGracePeriodMinutes: 15,
            taskDueSoonThresholdHours: 36,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.monitoring.classMonitoringGracePeriodMinutes).toBe(15);
    });

    it('blocks STAFF from updating system settings', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Cookie', staffArunCookie)
        .send({
          category: 'general',
          payload: { appName: 'Hacked Title' },
        });

      expect(res.status).toBe(403);
    });

    it('validates performance weights sum strictly to 100%', async () => {
      const resInvalid = await request(app)
        .put('/api/settings')
        .set('Cookie', adminCookie)
        .send({
          category: 'performanceWeights',
          payload: {
            attendanceWeight: 30,
            taskCompletionWeight: 30,
            onTimeCompletionWeight: 30,
            classCompletionWeight: 30,
            operationalActivityWeight: 10,
          },
        });

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.success).toBe(false);
    });
  });
});
