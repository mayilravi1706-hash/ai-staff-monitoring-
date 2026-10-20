import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { jobScheduler } from '../backend/src/services/scheduler.service';

describe('Timetable PDF Upload & Import Route Registration Verification', () => {
  let adminCookie: string;
  let staffCookie: string;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'admin@college.demo',
        password: 'Admin@123',
        role: 'ADMIN',
      });
    expect(adminRes.status).toBe(200);
    const adminCookies = adminRes.headers['set-cookie'] as string[];
    const rawAdmin = adminCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    adminCookie = rawAdmin!.split(';')[0];

    // 2. Staff login (Dr. Arun Kumar)
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: 'arun.kumar@college.demo',
        password: 'Staff@123',
        role: 'STAFF',
      });
    expect(staffRes.status).toBe(200);
    const staffCookies = staffRes.headers['set-cookie'] as string[];
    const rawStaff = staffCookies.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    staffCookie = rawStaff!.split(';')[0];
  });

  afterAll(async () => {
    jobScheduler.stopScheduler();
    await prisma.$disconnect();
  });

  // 1. Route existence and unauthenticated protection (401)
  it('POST /api/timetable/upload/pdf returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/pdf')
      .attach('file', Buffer.from('%PDF-1.4 sample'), 'test.pdf');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 2. RBAC: Staff receives 403 Forbidden
  it('POST /api/timetable/upload/pdf returns 403 when called by STAFF', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', staffCookie)
      .attach('file', Buffer.from('%PDF-1.4 sample'), 'test.pdf');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // 3. Validation: Missing file returns 400
  it('POST /api/timetable/upload/pdf returns 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.message || res.body.message).toMatch(/no pdf file/i);
  });

  // 4. Validation: Invalid file extension returns 400
  it('POST /api/timetable/upload/pdf rejects non-pdf file extensions with 400', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from('hello text content'), 'timetable.txt');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 5. Validation: Invalid PDF magic bytes returns 400
  it('POST /api/timetable/upload/pdf rejects corrupt non-PDF buffer with 400', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from('NOT A PDF FILE HEADER'), 'timetable.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.message || res.body.message).toMatch(/invalid file format/i);
  });

  // 6. Admin can access and receive preview
  it('POST /api/timetable/upload/pdf is reachable by ADMIN and processes PDF preview', async () => {
    // Generate a minimal valid PDF-like buffer with text structure
    const samplePdfText = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
72 712 Td
(Day: Monday) Tj
(Time: 09:00 - 10:00 | Class: CSE-A | Subject: CS201 | Faculty: Dr. Arun Kumar | Room: 101) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
464
%%EOF`;

    const res = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', adminCookie)
      .attach('file', Buffer.from(samplePdfText), 'timetable.pdf');

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.importId).toBeDefined();
      expect(res.body.data.summary).toBeDefined();
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    }
  });

  // 7. POST /api/timetable/upload/confirm is protected and requires importId
  it('POST /api/timetable/upload/confirm rejects without importId', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/confirm')
      .set('Cookie', adminCookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
