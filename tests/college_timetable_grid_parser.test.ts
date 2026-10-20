import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import {
  timetablePdfParserService,
  DEFAULT_HOUR_SLOTS,
} from '../backend/src/services/timetablePdfParser.service';
import { classMonitoringService } from '../backend/src/services/classMonitoring.service';
import { ruleEngineService } from '../backend/src/services/ruleEngine.service';
import { jobScheduler } from '../backend/src/services/scheduler.service';
import PDFDocument from 'pdfkit';

describe('College Timetable Grid Parser & Automatic Staff Allocation', () => {
  let adminCookie: string;
  let staffCookie: string;
  let adminUserId: string;
  let staffUserId: string;
  let arunStaffRecordId: string;

  beforeAll(async () => {
    // Ensure test staff user is active
    await prisma.user.updateMany({
      where: { email: 'arun.kumar@college.demo' },
      data: { status: 'ACTIVE' },
    });
    await prisma.staff.updateMany({
      where: { email: 'arun.kumar@college.demo' },
      data: { status: 'ACTIVE' },
    });

    // 1. Authenticate ADMIN
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
    adminUserId = adminRes.body.data.user.id;

    // 2. Authenticate STAFF (Arun Kumar)
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
    staffUserId = staffRes.body.data.user.id;

    const staffRecord = await prisma.staff.findUnique({
      where: { user_id: staffUserId },
    });
    arunStaffRecordId = staffRecord!.id;
  });

  afterAll(async () => {
    jobScheduler.stopScheduler();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. SECTION B ACTUAL GRID EXTRACTION & FACULTY ALLOCATION
  // =========================================================================
  describe('1. Section B Grid Reconstruction & Faculty Mapping', () => {
    const sectionBTimetableText = `
DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
BATCH: 2023-2027 | ACADEMIC YEAR: 2026-2027 | YEAR/SEM: IV/VII
CLASS: CSE IV/VII - SECTION B

TIME TABLE MATRIX:
DAY | HOUR 1 | HOUR 2 | HOUR 3 | HOUR 4 | LUNCH | HOUR 5 | HOUR 6 | HOUR 7
MONDAY | KE | SQM | KE | IRT | LUNCH | CC | NS LAB | NS LAB
TUESDAY | NS | SQM | HCI | CC | LUNCH | C/L/S | IRT | NS
WEDNESDAY | HCI | CC | PROJECT WORK | PROJECT WORK | LUNCH | NS | CC LAB | CC LAB
THURSDAY | CC | IRT | NS | KE | LUNCH | HCI | SQM | IRT
FRIDAY | KE | SQM | NS | CC | LUNCH | IRT | HCI | IRT

FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Mrs.A.ARUNA
NS - NETWORK SECURITY - Mr.K.MEIYALAGAN
IRT - INFORMATION RETRIEVAL TECHNIQUES - Mr.M.VIGNESH
HCI - HUMAN COMPUTER INTERACTION - Mrs.P.JAYASUDHA
CC - CLOUD COMPUTING - Mr.M.TAMIZHARASAN
SQM - SOFTWARE QUALITY MANAGEMENT - Dr.J.STANLY JAYAPRAKASH
NS LAB - NETWORK SECURITY LABORATORY - Mrs.A.ARUNA
CC LAB - CLOUD COMPUTING LABORATORY - Mr.M.VIGNESH
PROJECT WORK - PROJECT WORK (PHASE - I) - Mrs.A.ARUNA
`;

    it('extracts all 5 days and 7 periods per day without including Lunch Break', () => {
      const rows = timetablePdfParserService.parseTextRows(sectionBTimetableText);

      // 5 days * 7 periods = 35 timetable records
      expect(rows.length).toBe(35);

      // Verify no records created for lunch or breaks
      const lunchOrBreak = rows.filter((r) =>
        r.subject.toLowerCase().includes('lunch') || r.subjectCode?.toLowerCase().includes('lunch')
      );
      expect(lunchOrBreak.length).toBe(0);
    });

    it('correctly allocates Section B Monday slots with timings and staff', () => {
      const rows = timetablePdfParserService.parseTextRows(sectionBTimetableText);
      const mondaySlots = rows.filter((r) => r.day === 'Monday');
      expect(mondaySlots.length).toBe(7);

      // Hour 1: 09:20-10:15 KE Knowledge Engineering Mrs.A.ARUNA
      expect(mondaySlots[0].hour).toBe(1);
      expect(mondaySlots[0].startTime).toBe('09:20');
      expect(mondaySlots[0].endTime).toBe('10:15');
      expect(mondaySlots[0].subjectCode).toBe('KE');
      expect(mondaySlots[0].subject).toBe('KNOWLEDGE ENGINEERING');
      expect(mondaySlots[0].staff).toBe('Mrs.A.ARUNA');

      // Hour 2: 10:15-11:10 SQM Software Quality Management Dr.J.STANLY JAYAPRAKASH
      expect(mondaySlots[1].hour).toBe(2);
      expect(mondaySlots[1].startTime).toBe('10:15');
      expect(mondaySlots[1].endTime).toBe('11:10');
      expect(mondaySlots[1].subjectCode).toBe('SQM');
      expect(mondaySlots[1].staff).toBe('Dr.J.STANLY JAYAPRAKASH');

      // Hour 3: 11:20-12:15 KE Knowledge Engineering Mrs.A.ARUNA
      expect(mondaySlots[2].hour).toBe(3);
      expect(mondaySlots[2].subjectCode).toBe('KE');
      expect(mondaySlots[2].staff).toBe('Mrs.A.ARUNA');

      // Hour 4: 12:15-13:10 IRT Information Retrieval Techniques Mr.M.VIGNESH
      expect(mondaySlots[3].hour).toBe(4);
      expect(mondaySlots[3].startTime).toBe('12:15');
      expect(mondaySlots[3].endTime).toBe('13:10');
      expect(mondaySlots[3].subjectCode).toBe('IRT');
      expect(mondaySlots[3].staff).toBe('Mr.M.VIGNESH');

      // Hour 5: 14:00-14:50 CC Cloud Computing Mr.M.TAMIZHARASAN
      expect(mondaySlots[4].hour).toBe(5);
      expect(mondaySlots[4].startTime).toBe('14:00');
      expect(mondaySlots[4].endTime).toBe('14:50');
      expect(mondaySlots[4].subjectCode).toBe('CC');
      expect(mondaySlots[4].staff).toBe('Mr.M.TAMIZHARASAN');

      // Hour 6: 14:50-15:40 NS LAB Network Security Laboratory Mrs.A.ARUNA
      expect(mondaySlots[5].hour).toBe(6);
      expect(mondaySlots[5].subjectCode).toBe('NS LAB');
      expect(mondaySlots[5].staff).toBe('Mrs.A.ARUNA');

      // Hour 7: 15:40-16:30 NS LAB Network Security Laboratory Mrs.A.ARUNA
      expect(mondaySlots[6].hour).toBe(7);
      expect(mondaySlots[6].subjectCode).toBe('NS LAB');
      expect(mondaySlots[6].staff).toBe('Mrs.A.ARUNA');
    });

    it('correctly extracts Wednesday Project Work block', () => {
      const rows = timetablePdfParserService.parseTextRows(sectionBTimetableText);
      const wednesdaySlots = rows.filter((r) => r.day === 'Wednesday');

      // Hour 3 & Hour 4 should be PROJECT WORK allocated to Mrs.A.ARUNA
      const h3 = wednesdaySlots.find((r) => r.hour === 3);
      const h4 = wednesdaySlots.find((r) => r.hour === 4);

      expect(h3).toBeDefined();
      expect(h3?.subjectCode).toBe('PROJECT WORK');
      expect(h3?.staff).toBe('Mrs.A.ARUNA');

      expect(h4).toBeDefined();
      expect(h4?.subjectCode).toBe('PROJECT WORK');
      expect(h4?.staff).toBe('Mrs.A.ARUNA');
    });

    it('marks C/L/S as UNRESOLVED with safe warning if faculty is unassigned', async () => {
      // Build a PDF buffer containing the section B text
      const buffer = await createPdfBuffer(sectionBTimetableText);

      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        buffer,
        'cse_section_b_timetable.pdf',
        adminUserId
      );

      // Tuesday Hour 5 is C/L/S
      const clsRow = preview.rows.find((r) => r.dayName === 'Tuesday' && r.hour === 5);
      expect(clsRow).toBeDefined();
      expect(clsRow?.subjectCode).toBe('C/L/S');
      expect(clsRow?.status).toBe('UNRESOLVED');
      expect(clsRow?.isUnresolved).toBe(true);
      expect(clsRow?.warnings.some((w) => w.includes('Faculty mapping could not be safely determined'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. MULTI-SECTION DETECTION & INDEPENDENT FACULTY MAPPINGS (SECTIONS A, B, C, D)
  // =========================================================================
  describe('2. Multi-Section Support (Sections A, B, C, D)', () => {
    it('detects multiple sections and uses each section’s own faculty mappings', async () => {
      const multiSectionText = `
CLASS: CSE IV/VII - SECTION A
DAY | HOUR 1 | HOUR 2 | HOUR 3 | HOUR 4 | LUNCH | HOUR 5 | HOUR 6 | HOUR 7
MONDAY | KE | NS | CC | IRT | LUNCH | SQM | HCI | NS
FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Prof. Kavita Reddy
NS - NETWORK SECURITY - Dr. Rajesh Verma
CC - CLOUD COMPUTING - Dr. Arun Kumar
IRT - INFORMATION RETRIEVAL TECHNIQUES - Prof. Priya Sharma
SQM - SOFTWARE QUALITY MANAGEMENT - Dr. Sunita Patil
HCI - HUMAN COMPUTER INTERACTION - Prof. Manoj Nair

--- PAGE_BREAK ---

CLASS: CSE IV/VII - SECTION B
DAY | HOUR 1 | HOUR 2 | HOUR 3 | HOUR 4 | LUNCH | HOUR 5 | HOUR 6 | HOUR 7
MONDAY | KE | SQM | KE | IRT | LUNCH | CC | NS LAB | NS LAB
FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Mrs.A.ARUNA
NS - NETWORK SECURITY - Mr.K.MEIYALAGAN
IRT - INFORMATION RETRIEVAL TECHNIQUES - Mr.M.VIGNESH
HCI - HUMAN COMPUTER INTERACTION - Mrs.P.JAYASUDHA
CC - CLOUD COMPUTING - Mr.M.TAMIZHARASAN
SQM - SOFTWARE QUALITY MANAGEMENT - Dr.J.STANLY JAYAPRAKASH
NS LAB - NETWORK SECURITY LABORATORY - Mrs.A.ARUNA
`;

      const buffer = await createPdfBuffer(multiSectionText);
      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        buffer,
        'multi_section_college_timetable.pdf',
        adminUserId
      );

      // Must detect both Section A and Section B
      expect(preview.sectionsDetected).toContain('Section A');
      expect(preview.sectionsDetected).toContain('Section B');

      // Section A KE must be Prof. Kavita Reddy, NOT Mrs.A.ARUNA
      const secARow = preview.rows.find((r) => r.section === 'Section A' && r.hour === 1);
      expect(secARow).toBeDefined();
      expect(secARow?.subjectCode).toBe('KE');
      expect(secARow?.staffName).toContain('Kavita Reddy');

      // Section B KE must be Mrs.A.ARUNA
      const secBRow = preview.rows.find((r) => r.section === 'Section B' && r.hour === 1);
      expect(secBRow).toBeDefined();
      expect(secBRow?.subjectCode).toBe('KE');
      expect(secBRow?.staffName).toBe('Mrs.A.ARUNA');
    });
  });

  // =========================================================================
  // 3. SECURITY & RBAC: ADMIN ONLY / STAFF REJECTION / IDOR
  // =========================================================================
  describe('3. Security & RBAC Enforcement', () => {
    it('allows ADMIN to upload timetable PDF', async () => {
      const buffer = await createPdfBuffer('Monday | 09:20 | 10:15 | CSE-A | KE | Mrs.A.ARUNA');
      const res = await request(app)
        .post('/api/timetable/upload/pdf')
        .set('Cookie', adminCookie)
        .attach('file', buffer, 'timetable_upload.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.importId).toBeDefined();
    });

    it('rejects STAFF from uploading timetable PDF with 403 Forbidden', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'arun.kumar@college.demo', password: 'Staff@123', role: 'STAFF' });
      const currentStaffCookie = (loginRes.headers['set-cookie'] as string[]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

      const buffer = await createPdfBuffer('Monday | 09:20 | 10:15 | CSE-A | KE | Mrs.A.ARUNA');
      const res = await request(app)
        .post('/api/timetable/upload/pdf')
        .set('Cookie', currentStaffCookie)
        .attach('file', buffer, 'unauthorized_timetable.pdf');

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const buffer = await createPdfBuffer('Monday | 09:20 | 10:15 | CSE-A | KE | Mrs.A.ARUNA');
      const res = await request(app)
        .post('/api/timetable/upload/pdf')
        .attach('file', buffer, 'no_auth.pdf');

      expect(res.status).toBe(401);
    });

    it('enforces IDOR protection when staff attempts to view another staff schedule', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'arun.kumar@college.demo', password: 'Staff@123', role: 'STAFF' });
      const currentStaffCookie = (loginRes.headers['set-cookie'] as string[]).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

      // Staff Arun attempts to view schedule for another staff
      const res = await request(app)
        .get('/api/timetable?staffId=stf-stf-cse-002')
        .set('Cookie', currentStaffCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 4. TRANSACTIONAL COMMIT & DUPLICATE PREVENTION
  // =========================================================================
  describe('4. Transactional Import & Duplicate Prevention', () => {
    it('inserts valid records transactionally on confirm import', async () => {
      const sampleText = `
CLASS: CSE IV/VII - SECTION B
DAY | HOUR 1 | HOUR 2
MONDAY | KE | SQM
FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Mrs.A.ARUNA
SQM - SOFTWARE QUALITY MANAGEMENT - Dr.J.STANLY JAYAPRAKASH
`;
      // Clean up existing test slots to test clean insertion
      await prisma.classMonitoringAlert.deleteMany({});
      await prisma.operationalAlert.deleteMany({});
      await prisma.timetable.deleteMany({
        where: {
          day_of_week: 1,
          start_time: { in: ['09:20', '10:15'] },
        },
      });

      const buffer = await createPdfBuffer(sampleText);
      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        buffer,
        'commit_test.pdf',
        adminUserId
      );

      const confirmRes = await request(app)
        .post('/api/timetable/upload/confirm')
        .set('Cookie', adminCookie)
        .send({
          importId: preview.importId,
          rows: preview.rows,
          replaceExisting: true,
        });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.importedCount + confirmRes.body.data.updatedCount).toBeGreaterThanOrEqual(1);

      // Verify records in DB
      const dbEntries = await prisma.timetable.findMany({
        where: {
          start_time: '09:20',
          end_time: '10:15',
          day_of_week: 1,
        },
      });
      expect(dbEntries.length).toBeGreaterThan(0);
    });

    it('detects DUPLICATE when same timetable slot is uploaded again', async () => {
      const sampleText = `
CLASS: CSE IV/VII - SECTION B
DAY | HOUR 1
MONDAY | KE
FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Mrs.A.ARUNA
`;
      const buffer = await createPdfBuffer(sampleText);
      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        buffer,
        'duplicate_test.pdf',
        adminUserId
      );

      const dupRow = preview.rows.find((r) => r.dayName === 'Monday' && r.hour === 1);
      expect(dupRow?.status).toBe('DUPLICATE');
      expect(dupRow?.isDuplicate).toBe(true);
    });
  });

  // =========================================================================
  // 5. SERVER-TIME DETECTION, NOTIFICATION & 10-MIN OPERATIONAL MONITORING
  // =========================================================================
  describe('5. Server-Time Class Detection & 10-Minute Operational Monitoring', () => {
    it('detects scheduled class for current server time', async () => {
      // Create a reference date for Monday at 12:30 PM (between 12:15 and 13:10)
      const mockMondayNoon = new Date('2026-10-05T12:30:00.000Z'); // 2026-10-05 is Monday

      // Create a test timetable entry for Arun Kumar for Monday 12:15 - 13:10
      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      const testClass = await prisma.class.findFirst();
      const testSubject = await prisma.subject.findFirst();

      const slot = await prisma.timetable.create({
        data: {
          staff_id: arunStaffRecordId,
          class_id: testClass!.id,
          subject_id: testSubject!.id,
          academic_year_id: activeYear!.id,
          day_of_week: 1, // Monday
          start_time: '12:15',
          end_time: '13:10',
          room: 'Lab-3',
          status: 'SCHEDULED',
        },
      });

      const currentClassInfo = await classMonitoringService.getCurrentExpectedClass(
        arunStaffRecordId,
        mockMondayNoon
      );

      expect(currentClassInfo.hasCurrentClass).toBe(true);
      expect(currentClassInfo.currentClass?.startTime).toBe('12:15');
      expect(currentClassInfo.currentClass?.endTime).toBe('13:10');

      // Cleanup
      await prisma.timetable.delete({ where: { id: slot.id } });
    });

    it(
      'creates operational alert "Scheduled class activity has not been recorded." if no activity recorded after 10 minutes',
      async () => {
        await classMonitoringService.setGracePeriodMinutes(10);
        await prisma.leaveRequest.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.activity.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.classMonitoringAlert.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.operationalAlert.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.timetable.deleteMany({ where: { staff_id: arunStaffRecordId, day_of_week: 1 } });

        // 10 minutes past class start: 12:15 start + 10 min grace = 12:25 PM, testing at 12:27 PM
        const mockTimeAfterGrace = new Date(2026, 9, 5, 12, 27, 0);

        const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
        const testClass = await prisma.class.findFirst();
        const testSubject = await prisma.subject.findFirst();

        const testSlot = await prisma.timetable.create({
          data: {
            staff_id: arunStaffRecordId,
            class_id: testClass!.id,
            subject_id: testSubject!.id,
            academic_year_id: activeYear!.id,
            day_of_week: 1, // Monday
            start_time: '12:15',
            end_time: '13:10',
            room: 'Hall-4',
            status: 'SCHEDULED',
          },
        });

        const evalRes = await ruleEngineService.evaluateClassMonitoring(mockTimeAfterGrace, arunStaffRecordId);

        // Verify that the operational alert was generated
        const alert = await prisma.operationalAlert.findFirst({
          where: {
            timetable_id: testSlot.id,
          },
        });

        expect(alert).toBeDefined();
        expect(alert?.title).toBe('Scheduled class activity has not been recorded.');
        // Verify compliant wording: MUST NOT contain "Staff did not go to class" or "Staff is absent"
        expect(alert?.message).not.toContain('Staff is absent');
        expect(alert?.message).not.toContain('Staff did not go to class');

        // Cleanup
        await prisma.operationalAlert.deleteMany({ where: { timetable_id: testSlot.id } });
        await prisma.classMonitoringAlert.deleteMany({ where: { timetable_id: testSlot.id } });
        await prisma.timetable.delete({ where: { id: testSlot.id } });
      },
      60000
    );

    it(
      'resolves active operational alert when staff updates their activity',
      async () => {
        await classMonitoringService.setGracePeriodMinutes(10);
        await prisma.leaveRequest.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.activity.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.classMonitoringAlert.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.operationalAlert.deleteMany({ where: { staff_id: arunStaffRecordId } });
        await prisma.timetable.deleteMany({ where: { staff_id: arunStaffRecordId, day_of_week: 1 } });

        const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
        const testClass = await prisma.class.findFirst();
        const testSubject = await prisma.subject.findFirst();
        const mockTime = new Date(2026, 9, 5, 12, 27, 0);

        const slot = await prisma.timetable.create({
          data: {
            staff_id: arunStaffRecordId,
            class_id: testClass!.id,
            subject_id: testSubject!.id,
            academic_year_id: activeYear!.id,
            day_of_week: 1,
            start_time: '12:15',
            end_time: '13:10',
            room: 'Hall-4',
            status: 'SCHEDULED',
          },
        });

        // 1. Generate unrecorded alert
        await ruleEngineService.evaluateClassMonitoring(mockTime, arunStaffRecordId);

        // 2. Staff now records TEACHING activity
        const activity = await prisma.activity.create({
          data: {
            staff_id: arunStaffRecordId,
            class_id: testClass!.id,
            subject_id: testSubject!.id,
            timetable_id: slot.id,
            activity_status: 'TEACHING',
            start_time: new Date(2026, 9, 5, 12, 28, 0),
            description: 'Lecture started late due to lab setup',
          },
        });

        // 3. Re-evaluate monitoring
        await ruleEngineService.evaluateClassMonitoring(mockTime, arunStaffRecordId);

        // Alert should now be marked RESOLVED
        const updatedAlert = await prisma.operationalAlert.findFirst({
          where: { timetable_id: slot.id },
        });
        expect(updatedAlert?.status).toBe('RESOLVED');

        // Cleanup
        await prisma.activity.deleteMany({ where: { id: activity.id } });
        await prisma.operationalAlert.deleteMany({ where: { timetable_id: slot.id } });
        await prisma.classMonitoringAlert.deleteMany({ where: { timetable_id: slot.id } });
        await prisma.timetable.delete({ where: { id: slot.id } });
      },
      60000
    );
  });

  // =========================================================================
  // 6. ERROR HANDLING: SCANNED / EMPTY PDF
  // =========================================================================
  describe('6. Error Handling & Validation', () => {
    it('returns clear error for empty or non-extractable scanned PDF', async () => {
      // Empty PDF without text
      const emptyDoc = new PDFDocument();
      const buffers: Buffer[] = [];
      emptyDoc.on('data', (b) => buffers.push(b));
      emptyDoc.end();

      await new Promise((r) => setTimeout(r, 200));
      const emptyBuf = Buffer.concat(buffers);

      await expect(
        timetablePdfParserService.processPdfAndCreatePreview(emptyBuf, 'scanned.pdf', adminUserId)
      ).rejects.toThrow('OCR is required');
    });
  });

  // =========================================================================
  // 7. DYNAMIC TIME SLOT EXTRACTION FROM PDF (NO FIXED HARDCODED SLOTS)
  // =========================================================================
  describe('7. Dynamic Time Slot Extraction from PDF (No Fixed Slots)', () => {
    it('extracts custom timetable hour timings directly from uploaded PDF (09:00-09:50 format)', async () => {
      const customTimetableText = `
CLASS: CSE IV/VII - SECTION A
1st Hour    09:00 - 09:50
2nd Hour   09:50 - 10:40
3rd Hour   10:55 - 11:45
4th Hour   11:45 - 12:35
5th Hour   01:30 - 02:20
6th Hour   02:20 - 03:10
7th Hour   03:10 - 04:00

TIME TABLE MATRIX:
DAY | HOUR 1 | HOUR 2 | HOUR 3 | HOUR 4 | LUNCH | HOUR 5 | HOUR 6 | HOUR 7
MONDAY | KE | NS | CC | IRT | LUNCH | SQM | HCI | NS

FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Prof. Kavita Reddy
NS - NETWORK SECURITY - Dr. Rajesh Verma
CC - CLOUD COMPUTING - Dr. Arun Kumar
IRT - INFORMATION RETRIEVAL TECHNIQUES - Prof. Priya Sharma
SQM - SOFTWARE QUALITY MANAGEMENT - Dr. Sunita Patil
HCI - HUMAN COMPUTER INTERACTION - Prof. Manoj Nair
`;

      const buffer = await createPdfBuffer(customTimetableText);
      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        buffer,
        'custom_slots_0900.pdf',
        adminUserId
      );

      const mondaySlots = preview.rows.filter((r) => r.dayName === 'Monday');
      expect(mondaySlots.length).toBe(7);

      // Hour 1 must be 09:00 - 09:50 (NOT 09:20 - 10:15)
      expect(mondaySlots[0].hour).toBe(1);
      expect(mondaySlots[0].startTime).toBe('09:00');
      expect(mondaySlots[0].endTime).toBe('09:50');

      // Hour 2 must be 09:50 - 10:40 (NOT 10:15 - 11:10)
      expect(mondaySlots[1].hour).toBe(2);
      expect(mondaySlots[1].startTime).toBe('09:50');
      expect(mondaySlots[1].endTime).toBe('10:40');

      // Hour 3 must be 10:55 - 11:45 (NOT 11:20 - 12:15)
      expect(mondaySlots[2].hour).toBe(3);
      expect(mondaySlots[2].startTime).toBe('10:55');
      expect(mondaySlots[2].endTime).toBe('11:45');
    });

    it('extracts another custom institution timing (08:30 AM - 09:20 AM format)', async () => {
      const customAmPmText = `
CLASS: CSE IV/VII - SECTION B
1st Hour    08:30 AM - 09:20 AM
2nd Hour   09:20 AM - 10:10 AM
3rd Hour   10:25 AM - 11:15 AM
4th Hour   11:15 AM - 12:05 PM

TIME TABLE MATRIX:
DAY | HOUR 1 | HOUR 2 | HOUR 3 | HOUR 4
MONDAY | KE | SQM | KE | IRT

FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Mrs.A.ARUNA
SQM - SOFTWARE QUALITY MANAGEMENT - Dr.J.STANLY JAYAPRAKASH
IRT - INFORMATION RETRIEVAL TECHNIQUES - Mr.M.VIGNESH
`;

      const buffer = await createPdfBuffer(customAmPmText);
      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        buffer,
        'custom_early_slots.pdf',
        adminUserId
      );

      const mondaySlots = preview.rows.filter((r) => r.dayName === 'Monday');
      expect(mondaySlots.length).toBe(4);

      // Hour 1 must be 08:30 - 09:20
      expect(mondaySlots[0].hour).toBe(1);
      expect(mondaySlots[0].startTime).toBe('08:30');
      expect(mondaySlots[0].endTime).toBe('09:20');

      // Hour 2 must be 09:20 - 10:10
      expect(mondaySlots[1].hour).toBe(2);
      expect(mondaySlots[1].startTime).toBe('09:20');
      expect(mondaySlots[1].endTime).toBe('10:10');

      // Hour 3 must be 10:25 - 11:15
      expect(mondaySlots[2].hour).toBe(3);
      expect(mondaySlots[2].startTime).toBe('10:25');
      expect(mondaySlots[2].endTime).toBe('11:15');
    });
  });
});

/**
 * Helper function to create valid PDF buffer containing test text
 */
async function createPdfBuffer(textContent: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 20 });
    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const pages = textContent.split(/---\s*PAGE_BREAK\s*---/i);
    pages.forEach((p, idx) => {
      if (idx > 0) doc.addPage();
      doc.fontSize(8).text(p);
    });

    doc.end();
  });
}
