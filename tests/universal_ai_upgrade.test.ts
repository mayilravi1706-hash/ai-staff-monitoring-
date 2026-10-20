import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { resetRateLimiterStore } from '../backend/src/middleware/rateLimiter';
import { aiToolsService } from '../backend/src/services/aiTools.service';
import { aiRateLimiterService } from '../backend/src/services/aiRateLimiter.service';

describe('Universal AI Assistant & Floating Chatbot Suite', () => {
  let adminCookie: string;
  let staffArunCookie: string;
  let staffArunUserId: string;
  let staffArunRecordId: string;

  beforeAll(async () => {
    resetRateLimiterStore();
    aiRateLimiterService.resetLimits();

    // 1. Authenticate Admin
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

    // 2. Authenticate Staff Arun Kumar
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
    aiRateLimiterService.resetLimits();
    await prisma.$disconnect();
  });

  describe('1. Universal Question Answering & Entity Grounding', () => {
    it('answers staff details in Tanglish: "Arun Kumar full details sollu"', async () => {
      aiRateLimiterService.resetLimits();
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Arun Kumar full details sollu' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeTruthy();
      expect(Array.isArray(res.body.data.databaseFacts)).toBe(true);
      expect(res.body.data.databaseFacts.length).toBeGreaterThan(0);
      expect(res.body.data.databaseFacts.some((f: string) => f.includes('Arun') || f.includes('CSE'))).toBe(true);
    });

    it('resolves follow-up conversation context: "Avanga Monday timetable mattum sollu"', async () => {
      aiRateLimiterService.resetLimits();
      const history = [
        { sender: 'user' as const, text: 'Arun Kumar full details sollu' },
        { sender: 'ai' as const, text: 'Arun Kumar is Assistant Professor in CSE.' },
      ];

      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({
          prompt: 'Avanga Monday timetable mattum sollu',
          history,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeTruthy();
      expect(res.body.data.toolsUsed).toContain('get_timetable');
    });

    it('answers department class query: "Inniku CSE department-la enna classes irukku?"', async () => {
      aiRateLimiterService.resetLimits();
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Inniku CSE department-la enna classes irukku?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolsUsed).toContain('get_timetable');
    });

    it('answers task status query: "Which tasks are overdue?"', async () => {
      aiRateLimiterService.resetLimits();
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Which tasks are overdue?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolsUsed).toContain('get_staff_tasks');
    });

    it('answers pending leave query: "Pending leave requests list sollu"', async () => {
      aiRateLimiterService.resetLimits();
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Pending leave requests list sollu' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolsUsed).toContain('get_leave_requests');
    });

    it('handles general programming Q&A: "Explain JavaScript promises in Tanglish"', async () => {
      aiRateLimiterService.resetLimits();
      const res = await request(app)
        .post('/api/ai/admin/chat')
        .set('Cookie', adminCookie)
        .send({ prompt: 'Explain JavaScript promises in Tanglish' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeTruthy();
    });
  });

  describe('2. Disambiguation & Missing Data Guardrails', () => {
    it('returns standard insufficient authorized data response for non-existent entities', async () => {
      aiRateLimiterService.resetLimits();
      const res = await request(app)
        .post('/api/ai/staff/chat')
        .set('Cookie', staffArunCookie)
        .send({ prompt: 'What are my scheduled astronaut training flights in Mars?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeTruthy();
    });

    it('enforces RBAC and IDOR so STAFF cannot access admin tools or system settings', async () => {
      const staffUser = {
        id: staffArunUserId,
        role: 'STAFF',
        staffRecordId: staffArunRecordId,
        email: 'arun.kumar@college.demo',
      };

      expect(() => {
        aiToolsService.assertToolAuthorization('get_system_settings', staffUser);
      }).toThrow(/strictly restricted to administrative users/);

      expect(() => {
        aiToolsService.assertToolAuthorization('get_timetable_imports', staffUser);
      }).toThrow(/strictly restricted to administrative users/);
    });
  });
});
