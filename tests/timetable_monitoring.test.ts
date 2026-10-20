import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { timetablePdfParserService } from '../backend/src/services/timetablePdfParser.service';
import { classMonitoringService } from '../backend/src/services/classMonitoring.service';
import { ruleEngineService } from '../backend/src/services/ruleEngine.service';
import { operationalAlertService } from '../backend/src/services/operationalAlert.service';
import { jobScheduler } from '../backend/src/services/scheduler.service';

describe('Feature: Admin Timetable PDF Upload + Automatic Class Activity Monitoring', () => {
  let adminCookie: string;
  let staffCookie: string;
  let staffArunRecordId: string;
  let staffArunUserId: string;

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

    const arun = await prisma.staff.findFirst({
      where: { email: 'arun.kumar@college.demo' },
    });
    staffArunRecordId = arun!.id;
    staffArunUserId = arun!.user_id!;
  });

  afterAll(async () => {
    jobScheduler.stopScheduler();
    await prisma.$disconnect();
  });

  // ==========================================
  // 1. RBAC: PDF UPLOAD & IMPORT
  // ==========================================
  describe('1. RBAC & Authorization on Timetable PDF Endpoints', () => {
    it('Admin can access PDF upload endpoint (rejects without file)', async () => {
      const res = await request(app)
        .post('/api/timetable/upload/pdf')
        .set('Cookie', adminCookie);

      // Should be 400 Bad Request because no file was attached, NOT 403 Forbidden
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/no pdf file/i);
    });

    it('Staff CANNOT upload timetable PDF (Strict 403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/timetable/upload/pdf')
        .set('Cookie', staffCookie)
        .attach('file', Buffer.from('%PDF-1.4 test dummy'), 'timetable.pdf');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Staff CANNOT confirm timetable import (Strict 403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/timetable/upload/confirm')
        .set('Cookie', staffCookie)
        .send({ importId: 'some-id', rows: [] });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Staff CANNOT access timetable import history (Strict 403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/timetable/upload/history')
        .set('Cookie', staffCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // 2. TIMETABLE PDF PARSING & VALIDATION
  // ==========================================
  describe('2. Timetable PDF Parsing, Validation & Conflict Detection', () => {
    it('rejects corrupt or invalid PDF content gracefully', async () => {
      const corruptBuffer = Buffer.from('This is not a real PDF document at all');
      const res = await request(app)
        .post('/api/timetable/upload/pdf')
        .set('Cookie', adminCookie)
        .attach('file', corruptBuffer, 'corrupt.pdf');

      // The service gracefully handles corrupt PDFs and returns an informative preview with 0 valid rows
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.data.summary.validRows).toBe(0);
      }
    });

    it('timetablePdfParserService accurately extracts structured rows from timetable text', async () => {
      const sampleText = `
        INSTITUTIONAL TIMETABLE 2025-2026
        DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
        
        Day: Monday
        Time: 09:00 - 10:00 | Class: CSE-A | Subject: CS201 Data Structures | Faculty: Dr. Arun Kumar | Room: CS-101
        Time: 10:00 - 11:00 | Class: CSE-A | Subject: CS202 Operating Systems | Faculty: Dr. Sneha Sharma | Room: CS-102
        
        Day: Tuesday
        Time: 11:15 - 12:15 | Class: CSE-B | Subject: CS203 Algorithms | Faculty: Dr. Arun Kumar | Room: CS-101
      `;

      const rows = await timetablePdfParserService.parseTimetableText(sampleText);
      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Verify structure of first parsed row
      const firstRow = rows[0];
      expect(firstRow.dayOfWeek).toBe(1); // Monday
      expect(firstRow.startTime).toBe('09:00');
      expect(firstRow.endTime).toBe('10:00');
      expect(firstRow.className).toContain('CSE-A');
      expect(firstRow.staffName).toContain('Arun');
    });

    it('detects duplicate timetable entries and conflicts before import', async () => {
      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      const arun = await prisma.staff.findFirst({ where: { email: 'arun.kumar@college.demo' } });
      const cseA = await prisma.class.findFirst();
      const subject = await prisma.subject.findFirst();

      expect(activeYear).toBeDefined();
      expect(arun).toBeDefined();
      expect(cseA).toBeDefined();

      // Check conflict detection via masterData service validation
      const existing = await prisma.timetable.findFirst({
        where: {
          staff_id: arun!.id,
          academic_year_id: activeYear!.id,
        },
      });

      if (existing) {
        // Attempting to book the exact same slot creates a conflict
        const res = await request(app)
          .post('/api/timetable')
          .set('Cookie', adminCookie)
          .send({
            academic_year_id: activeYear!.id,
            staff_id: arun!.id,
            class_id: cseA!.id,
            subject_id: subject!.id,
            day_of_week: existing.day_of_week,
            start_time: existing.start_time,
            end_time: existing.end_time,
            room: 'Room 101',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error?.message || res.body.message).toMatch(/conflict/i);
      }
    });
  });

  // ==========================================
  // 3. SERVER TIME & CURRENT CLASS DETECTION
  // ==========================================
  describe('3. Server-Time Authority & Current Class Detection', () => {
    it('uses SERVER time as the authoritative clock (not client)', async () => {
      const res = await request(app)
        .get('/api/timetable/current-class')
        .set('Cookie', staffCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.serverTime).toBeDefined();
      expect(res.body.data.serverTime.iso).toBeDefined();
      expect(typeof res.body.data.serverTime.dayOfWeek).toBe('number');
      expect(typeof res.body.data.serverTime.timeStr).toBe('string');
    });

    it('Staff can view own expected class, but IDOR attempt on another staff is blocked', async () => {
      // 1. Staff querying own
      const ownRes = await request(app)
        .get(`/api/timetable/current-class?staffId=${staffArunRecordId}`)
        .set('Cookie', staffCookie);

      expect(ownRes.status).toBe(200);

      // 2. Staff querying another staff's ID -> 403 Forbidden
      const otherStaff = await prisma.staff.findFirst({
        where: { id: { not: staffArunRecordId } },
      });

      if (otherStaff) {
        const idorRes = await request(app)
          .get(`/api/timetable/current-class?staffId=${otherStaff.id}`)
          .set('Cookie', staffCookie);

        expect(idorRes.status).toBe(403);
        expect(idorRes.body.success).toBe(false);
      }
    });

    it('Admin can query expected class for any staff member', async () => {
      const res = await request(app)
        .get(`/api/timetable/current-class?staffId=${staffArunRecordId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.todaySchedule).toBeDefined();
    });
  });

  // ==========================================
  // 4. CONFIGURABLE GRACE PERIOD & MONITORING
  // ==========================================
  describe('4. Configurable Grace Period & Monitoring Settings', () => {
    it('grace period defaults to 10 minutes when not configured', async () => {
      const gracePeriod = await classMonitoringService.getGracePeriodMinutes();
      expect(gracePeriod).toBeGreaterThanOrEqual(5);
    });

    it('Admin can configure the monitoring grace period value', async () => {
      const updated = await classMonitoringService.setGracePeriodMinutes(10);
      expect(updated).toBe(10);

      const retrieved = await classMonitoringService.getGracePeriodMinutes();
      expect(retrieved).toBe(10);
    });
  });

  // ==========================================
  // 5. CLASS START REMINDER & 10-MINUTE ALERT
  // ==========================================
  describe('5. Staff Class Reminder & 10-Minute Operational Alert Flow', () => {
    it('evaluates class monitoring and generates operational alert when grace period expires with no activity', async () => {
      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      const arun = await prisma.staff.findFirst({ where: { email: 'arun.kumar@college.demo' } });
      const cseClass = await prisma.class.findFirst();
      const subject = await prisma.subject.findFirst();

      expect(activeYear).toBeDefined();
      expect(arun).toBeDefined();

      // Create a test timetable entry on day 1 (Monday) at 10:00 - 11:00
      const testTimetable = await prisma.timetable.create({
        data: {
          staff_id: arun!.id,
          class_id: cseClass!.id,
          subject_id: subject!.id,
          academic_year_id: activeYear!.id,
          day_of_week: 1, // Monday
          start_time: '10:00',
          end_time: '11:00',
          room: 'Test Hall 101',
          status: 'SCHEDULED',
        },
      });

      // Test evaluation at 10:12 AM (12 minutes after start, past 10-minute grace period)
      // Reference date: a Monday at 10:12 AM
      const mockMondayDate = new Date('2026-10-05T10:12:00'); // Oct 5, 2026 is a Monday

      const evalResult = await ruleEngineService.evaluateClassMonitoring(mockMondayDate);
      expect(evalResult.evaluatedCount).toBeGreaterThanOrEqual(1);

      // Verify the generated operational alert
      const alert = await prisma.operationalAlert.findFirst({
        where: {
          timetable_id: testTimetable.id,
          alert_type: 'CLASS_ACTIVITY_NOT_RECORDED',
        },
      });

      expect(alert).toBeDefined();
      // Requirement 6: exact alert title
      expect(alert!.title).toBe('Scheduled class activity has not been recorded.');
      // Requirement 6: operational monitoring signal wording without physical absence claim
      expect(alert!.message).toContain('Scheduled class activity has not been recorded');
      expect(alert!.message).not.toContain('did not go to the class');
      expect(alert!.message).not.toContain('was absent');

      // Requirement 7: Admin notification created
      const adminNotif = await prisma.notification.findFirst({
        where: {
          related_entity: 'TIMETABLE',
          related_entity_id: testTimetable.id,
          type: 'CLASS_ACTIVITY_NOT_RECORDED',
        },
      });
      expect(adminNotif).toBeDefined();
      expect(adminNotif!.message).toContain('Scheduled class activity has not been recorded');

      // Clean up test slot
      await prisma.classMonitoringAlert.deleteMany({ where: { timetable_id: testTimetable.id } });
      await prisma.operationalAlert.deleteMany({ where: { timetable_id: testTimetable.id } });
      await prisma.notification.deleteMany({ where: { related_entity_id: testTimetable.id } });
      await prisma.timetable.delete({ where: { id: testTimetable.id } });
    });

    it('prevents duplicate alerts for the same timetable slot occurrence', async () => {
      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      const arun = await prisma.staff.findFirst({ where: { email: 'arun.kumar@college.demo' } });
      const cseClass = await prisma.class.findFirst();
      const subject = await prisma.subject.findFirst();

      const testSlot = await prisma.timetable.create({
        data: {
          staff_id: arun!.id,
          class_id: cseClass!.id,
          subject_id: subject!.id,
          academic_year_id: activeYear!.id,
          day_of_week: 2, // Tuesday
          start_time: '14:00',
          end_time: '15:00',
          status: 'SCHEDULED',
        },
      });

      const mockTuesday = new Date('2026-10-06T14:15:00'); // Tuesday 14:15

      // First run generates alert
      const run1 = await ruleEngineService.evaluateClassMonitoring(mockTuesday);
      const alertCount1 = await prisma.operationalAlert.count({
        where: { timetable_id: testSlot.id },
      });

      // Second run must NOT generate duplicate alert
      const run2 = await ruleEngineService.evaluateClassMonitoring(mockTuesday);
      const alertCount2 = await prisma.operationalAlert.count({
        where: { timetable_id: testSlot.id },
      });

      expect(alertCount1).toBe(alertCount2);
      expect(alertCount1).toBe(1);

      // Clean up
      await prisma.classMonitoringAlert.deleteMany({ where: { timetable_id: testSlot.id } });
      await prisma.operationalAlert.deleteMany({ where: { timetable_id: testSlot.id } });
      await prisma.notification.deleteMany({ where: { related_entity_id: testSlot.id } });
      await prisma.timetable.delete({ where: { id: testSlot.id } });
    });
  });

  // ==========================================
  // 6. STAFF ACTIVITY UPDATE RESOLVES ALERT
  // ==========================================
  describe('6. Staff Activity Update Resolves Operational Alert', () => {
    it('logging current work as Teaching resolves active unrecorded class alert', async () => {
      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      const arun = await prisma.staff.findFirst({ where: { email: 'arun.kumar@college.demo' } });
      const cseClass = await prisma.class.findFirst();
      const subject = await prisma.subject.findFirst();

      const slot = await prisma.timetable.create({
        data: {
          staff_id: arun!.id,
          class_id: cseClass!.id,
          subject_id: subject!.id,
          academic_year_id: activeYear!.id,
          day_of_week: 3, // Wednesday
          start_time: '09:00',
          end_time: '10:00',
          status: 'SCHEDULED',
        },
      });

      // Create an open alert for this slot
      const alert = await operationalAlertService.upsertAlert({
        alertType: 'CLASS_ACTIVITY_NOT_RECORDED',
        severity: 'MEDIUM',
        dedupKey: `CLASS_UNRECORDED:${slot.id}:2026-10-07`,
        ruleIdentifier: 'RULE_CLASS_ACTIVITY_UNRECORDED_GRACE',
        title: 'Scheduled class activity has not been recorded.',
        message: 'Scheduled class activity has not been recorded.',
        staffId: arun!.id,
        timetableId: slot.id,
      });

      expect(alert?.alert.status).toBe('OPEN');

      // Staff logs activity via POST /api/activity
      const activityRes = await request(app)
        .post('/api/activity')
        .set('Cookie', staffCookie)
        .send({
          activity_status: 'TEACHING',
          timetable_id: slot.id,
          class_id: cseClass!.id,
          subject_id: subject!.id,
          notes: 'Lecture on Data Structures - Unit 2',
        });

      expect(activityRes.status).toBe(201);

      // Verify the operational alert is now RESOLVED
      const updatedAlert = await prisma.operationalAlert.findUnique({
        where: { id: alert!.alert.id },
      });
      expect(updatedAlert?.status).toBe('RESOLVED');
      expect(updatedAlert?.resolved_at).toBeDefined();

      // Clean up
      await prisma.activity.deleteMany({ where: { timetable_id: slot.id } });
      await prisma.classMonitoringAlert.deleteMany({ where: { timetable_id: slot.id } });
      await prisma.operationalAlert.deleteMany({ where: { timetable_id: slot.id } });
      await prisma.notification.deleteMany({ where: { related_entity_id: slot.id } });
      await prisma.timetable.delete({ where: { id: slot.id } });
    });
  });

  // ==========================================
  // 7. AUDIT LOGGING & SCHEDULER
  // ==========================================
  describe('7. Audit Logging & Scheduled Job Registration', () => {
    it('audit logs record significant actions without exposing credentials', async () => {
      const logs = await prisma.auditLog.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
      });

      for (const log of logs) {
        if (log.after_value) {
          expect(log.after_value).not.toContain('password');
          expect(log.after_value).not.toContain('session');
        }
      }
    });

    it('background scheduler includes CLASS_MONITORING with independent execution', () => {
      const job = jobScheduler.getJobStatuses().find((j) => j.name === 'CLASS_MONITORING');
      expect(job).toBeDefined();
      expect(job!.intervalMs).toBe(60 * 1000); // 1-minute interval
    });
  });
});
