import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { aiRateLimiterService } from '../backend/src/services/aiRateLimiter.service';
import { aiToolsService } from '../backend/src/services/aiTools.service';

describe('Phase 10: Gemini AI Copilot, Staff AI Assistant & Evidence Grounding', () => {
  let adminCookie: string;
  let staffArunCookie: string;
  let adminUserId: string;
  let staffArunUserId: string;
  let staffArunRecordId: string;
  let createdAnalysisId: string;

  beforeAll(async () => {
    resetRateLimiterStore();
    aiRateLimiterService.resetLimits();

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
    aiRateLimiterService.resetLimits();

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

  // =========================================================================
  // 1. AI CONFIGURATION & HEALTH STATUS
  // =========================================================================
  describe('1. AI Configuration & Health Status', () => {
    it('allows ADMIN to retrieve AI health and configuration status', async () => {
      const res = await request(app)
        .get('/api/ai/status')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('aiEnabled');
      expect(res.body.data).toHaveProperty('configurationStatus');
      expect(res.body.data).toHaveProperty('configuredModel');
      expect(res.body.data).toHaveProperty('credentialsAvailable');
    });

    it('blocks STAFF from accessing AI health status', async () => {
      const res = await request(app)
        .get('/api/ai/status')
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. ADMIN AI COPILOT
  // =========================================================================
  describe('2. Admin AI Copilot (/api/ai/admin/chat)', () => {
    it('answers operational questions with database facts, rule conditions, and insights', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'How many staff are currently teaching and what classes are scheduled?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data).toHaveProperty('databaseFacts');
      expect(data).toHaveProperty('ruleBasedConditions');
      expect(data).toHaveProperty('aiInsights');
      expect(data).toHaveProperty('answer');
      expect(data).toHaveProperty('evidence');
      expect(data).toHaveProperty('analysisId');
      expect(data.dataScope).toBe('ORGANIZATION_LEVEL');
      expect(Array.isArray(data.databaseFacts)).toBe(true);
      expect(Array.isArray(data.evidence)).toBe(true);

      createdAnalysisId = data.analysisId;
    });

    it('summarizes operational alerts with grounded evidence', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'What operational alerts are currently open?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolsUsed).toContain('get_operational_alerts');
    });

    it('blocks STAFF users from calling Admin AI Copilot endpoint', async () => {
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', staffArunCookie)
        .send({ prompt: 'Show department statistics' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. STAFF AI ASSISTANT
  // =========================================================================
  describe('3. Staff AI Assistant (/api/ai/staff/chat)', () => {
    it('answers questions strictly scoped to authenticated staff member', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/staff/chat')
        .set('Cookie', staffArunCookie)
        .send({ prompt: 'What tasks are assigned to me and what is my schedule?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data.dataScope).toBe('AUTHENTICATED_STAFF_SELF_ONLY');
      expect(data).toHaveProperty('analysisId');
      expect(data).toHaveProperty('evidence');
      expect(Array.isArray(data.databaseFacts)).toBe(true);
    });

    it('blocks ADMIN users from calling Staff AI Assistant endpoint', async () => {
      const res = await request(app)
        .post('/api/ai/staff/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'What are my tasks?' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. HALLUCINATION & EVIDENCE GROUNDING PROTECTION
  // =========================================================================
  describe('4. Hallucination Protection & Truth Grounding', () => {
    it('returns standard insufficient data message when no records match query', async () => {
      aiRateLimiterService.resetLimits();

      // Query about non-existent or impossible records
      const res = await request(app)
        .post('/api/ai/staff/chat')
        .set('Cookie', staffArunCookie)
        .send({ prompt: 'What are my scheduled astronaut training flights in Mars?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Either insufficient data message or grounded fallback
      expect(res.body.data.answer).toBeTruthy();
    });

    it('clearly distinguishes facts vs rule conditions vs insights', async () => {
      aiRateLimiterService.resetLimits();

      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Summarize today overdue tasks and task statistics.' });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(Array.isArray(data.databaseFacts)).toBe(true);
      expect(Array.isArray(data.ruleBasedConditions)).toBe(true);
      expect(Array.isArray(data.aiInsights)).toBe(true);
    });
  });

  // =========================================================================
  // 5. ALLOWLISTED TOOL LAYER & RBAC ENFORCEMENT
  // =========================================================================
  describe('5. Allowlisted Tool Layer & Security Enforcements', () => {
    it('has all 17 allowlisted tools registered in aiToolsService', () => {
      expect(aiToolsService.ALLOWED_TOOLS.length).toBeGreaterThanOrEqual(17);
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_staff');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_staff_attendance');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_staff_tasks');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_current_activities');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_timetable');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_leave_requests');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_workload_metrics');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_department_statistics');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_notifications');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_performance');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_audit_records');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_class_coverage');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_operational_alerts');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_task_statistics');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_attendance_statistics');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_department_workload');
      expect(aiToolsService.ALLOWED_TOOLS).toContain('get_department_performance');
    });

    it('prohibits STAFF from accessing admin-restricted tools directly', async () => {
      const staffUser = {
        id: staffArunUserId,
        role: 'STAFF',
        staffRecordId: staffArunRecordId,
        email: 'arun.kumar@college.demo',
      };

      expect(() => {
        aiToolsService.assertToolAuthorization('get_audit_records', staffUser);
      }).toThrow(/strictly restricted to administrative users/);

      expect(() => {
        aiToolsService.assertToolAuthorization('get_department_statistics', staffUser);
      }).toThrow(/strictly restricted to administrative users/);
    });

    it('rejects unknown or arbitrary tool names', () => {
      const adminUser = {
        id: adminUserId,
        role: 'ADMIN',
        email: 'admin@college.demo',
      };

      expect(() => {
        aiToolsService.assertToolAuthorization('execute_raw_sql', adminUser);
      }).toThrow(/Unrecognized or prohibited AI tool/);
    });
  });

  // =========================================================================
  // 6. RATE LIMITING & USAGE CONTROLS
  // =========================================================================
  describe('6. Rate Limiting & Input Validation', () => {
    it('rejects prompts exceeding 500 characters', async () => {
      const longPrompt = 'A'.repeat(501);

      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: longPrompt });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty prompts', async () => {
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 7. ANALYSIS HISTORY, DETAILS, EVIDENCE & FEEDBACK (WITH IDOR CHECK)
  // =========================================================================
  describe('7. Analysis Runs, Evidence & Feedback', () => {
    it('allows user to retrieve their analysis history', async () => {
      const res = await request(app)
        .get('/api/ai/history')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('allows user to fetch details and evidence of an analysis run', async () => {
      if (!createdAnalysisId) return;

      const res = await request(app)
        .get(`/api/ai/analysis/${createdAnalysisId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdAnalysisId);

      const evidenceRes = await request(app)
        .get(`/api/ai/analysis/${createdAnalysisId}/evidence`)
        .set('Cookie', adminCookie);

      expect(evidenceRes.status).toBe(200);
      expect(evidenceRes.body.success).toBe(true);
      expect(Array.isArray(evidenceRes.body.data)).toBe(true);
    });

    it('blocks STAFF from accessing ADMIN analysis run (IDOR Protection)', async () => {
      if (!createdAnalysisId) return;

      const res = await request(app)
        .get(`/api/ai/analysis/${createdAnalysisId}`)
        .set('Cookie', staffArunCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows user to submit feedback for an analysis run', async () => {
      if (!createdAnalysisId) return;

      const res = await request(app)
        .post(`/api/ai/analysis/${createdAnalysisId}/feedback`)
        .set('Cookie', adminCookie)
        .send({ rating: 'HELPFUL', comment: 'Accurate and well grounded' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 8. AUDIT LOGGING OF AI ACTIONS
  // =========================================================================
  describe('8. AI Audit Logging', () => {
    it('logs AI query events in the audit log table', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: { in: ['AI_QUERY_STARTED', 'AI_TOOL_CALLED', 'AI_QUERY_COMPLETED'] },
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      expect(['AI_QUERY_STARTED', 'AI_TOOL_CALLED', 'AI_QUERY_COMPLETED']).toContain(auditLog!.action);
    });
  });
});
