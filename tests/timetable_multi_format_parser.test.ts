import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { timetablePdfParserService, normalizeTime, normalizeDay, parseTimeRange } from '../backend/src/services/timetablePdfParser.service';
import { jobScheduler } from '../backend/src/services/scheduler.service';

describe('Universal Timetable PDF Multi-Layout Parser Tests', () => {
  let adminCookie: string;
  let adminUserId: string;

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    jobScheduler.stopScheduler();
    await prisma.$disconnect();
  });

  // ==========================================
  // 1. TIME & DAY NORMALIZERS
  // ==========================================
  describe('1. Time, Day & Range Normalization', () => {
    it('normalizes 12-hour, 24-hour, dot-separated and am/pm time representations', () => {
      expect(normalizeTime('9:00 AM')).toBe('09:00');
      expect(normalizeTime('09:00 AM')).toBe('09:00');
      expect(normalizeTime('9.00 AM')).toBe('09:00');
      expect(normalizeTime('9.00am')).toBe('09:00');
      expect(normalizeTime('9am')).toBe('09:00');
      expect(normalizeTime('09am')).toBe('09:00');
      expect(normalizeTime('1:00 PM')).toBe('13:00');
      expect(normalizeTime('01:00 PM')).toBe('13:00');
      expect(normalizeTime('1.00 PM')).toBe('13:00');
      expect(normalizeTime('1pm')).toBe('13:00');
      expect(normalizeTime('14:30')).toBe('14:30');
      expect(normalizeTime('09:00')).toBe('09:00');
    });

    it('normalizes day names and abbreviations', () => {
      expect(normalizeDay('Monday')).toBe(1);
      expect(normalizeDay('Mon')).toBe(1);
      expect(normalizeDay('MON')).toBe(1);
      expect(normalizeDay('Tuesday')).toBe(2);
      expect(normalizeDay('Tue')).toBe(2);
      expect(normalizeDay('TUE')).toBe(2);
      expect(normalizeDay('Wednesday')).toBe(3);
      expect(normalizeDay('Wed')).toBe(3);
      expect(normalizeDay('Thursday')).toBe(4);
      expect(normalizeDay('Thu')).toBe(4);
      expect(normalizeDay('Friday')).toBe(5);
      expect(normalizeDay('Fri')).toBe(5);
      expect(normalizeDay('Saturday')).toBe(6);
      expect(normalizeDay('Sat')).toBe(6);
    });

    it('parses time ranges in various delimiter styles', () => {
      const r1 = parseTimeRange('09:00 - 10:00');
      expect(r1).toEqual({ start: '09:00', end: '10:00' });

      const r2 = parseTimeRange('9:00 to 10:00');
      expect(r2).toEqual({ start: '09:00', end: '10:00' });

      const r3 = parseTimeRange('9.00 AM - 10.00 AM');
      expect(r3).toEqual({ start: '09:00', end: '10:00' });

      const r4 = parseTimeRange('9am - 10am');
      expect(r4).toEqual({ start: '09:00', end: '10:00' });
    });
  });

  // ==========================================
  // 2. FORMAT A: PIPE / DELIMITED COLUMNS
  // ==========================================
  describe('2. Format A: Standard Delimited (Day | Start | End | Class | Subject | Staff)', () => {
    it('parses pipe-delimited columns accurately', async () => {
      const text = `
        Day | Start | End | Class | Subject | Staff | Room
        Monday | 09:00 | 10:00 | CSE-A | CS201 | Dr. Arun Kumar | Room 101
        Monday | 10:00 | 11:00 | CSE-A | CS202 | Dr. Sneha Sharma | Room 102
        Tuesday | 11:15 | 12:15 | CSE-B | CS203 | Dr. Arun Kumar | Room 103
      `;

      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBe(3);
      expect(rows[0].day).toBe('Monday');
      expect(rows[0].startTime).toBe('09:00');
      expect(rows[0].endTime).toBe('10:00');
      expect(rows[0].className).toContain('CSE-A');
      expect(rows[0].subject).toContain('CS201');
      expect(rows[0].staff).toContain('Arun Kumar');
    });
  });

  // ==========================================
  // 3. FORMAT B: DAY-GROUPED BLOCKS
  // ==========================================
  describe('3. Format B: Day Blocks with Whitespace-Separated Slots', () => {
    it('parses day header sections followed by slot lines', () => {
      const text = `
        DEPARTMENT OF COMPUTER SCIENCE
        TIMETABLE 2025-2026
        
        MONDAY
        09:00-10:00  CSE-A  CS201  Arun Kumar
        10:00-11:00  CSE-A  CS202  Sneha Sharma
        
        TUESDAY
        11:15-12:15  CSE-B  CS203  Arun Kumar
      `;

      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBe(3);
      expect(rows[0].day).toBe('Monday');
      expect(rows[0].startTime).toBe('09:00');
      expect(rows[0].endTime).toBe('10:00');
      expect(rows[2].day).toBe('Tuesday');
      expect(rows[2].startTime).toBe('11:15');
      expect(rows[2].endTime).toBe('12:15');
    });
  });

  // ==========================================
  // 4. FORMAT C: TIME RANGE FIRST PER ROW
  // ==========================================
  describe('4. Format C: Time Ranges at Row Start', () => {
    it('parses rows starting with time ranges', () => {
      const text = `
        09:00-10:00 | CSE-A | CS201 | Arun Kumar
        10:00-11:00 | CSE-B | CS202 | Sneha Sharma
      `;

      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBe(2);
      expect(rows[0].startTime).toBe('09:00');
      expect(rows[0].endTime).toBe('10:00');
      expect(rows[0].className).toBe('CSE-A');
      expect(rows[0].subject).toBe('CS201');
    });
  });

  // ==========================================
  // 5. FORMAT D: GRID FORMAT (DAYS AS COLUMNS)
  // ==========================================
  describe('5. Format D: Timetable Grid Layout', () => {
    it('parses grid table where columns are days and rows are time slots', () => {
      const text = `
        Time | Monday | Tuesday | Wednesday | Thursday | Friday
        09:00-10:00 | CS201 - CSE-A - Arun Kumar | CS202 - CSE-B - Sneha Sharma | CS201 - CSE-A - Arun Kumar | CS203 - CSE-A - Rajesh | CS201 - CSE-A - Arun
        10:00-11:00 | CS202 - CSE-A - Sneha Sharma | CS201 - CSE-B - Arun Kumar | CS202 - CSE-A - Sneha | CS201 - CSE-A - Arun | CS202 - CSE-B - Sneha
      `;

      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBeGreaterThanOrEqual(8);
      expect(rows.some((r) => r.day === 'Monday' && r.startTime === '09:00')).toBe(true);
      expect(rows.some((r) => r.day === 'Tuesday' && r.startTime === '09:00')).toBe(true);
      expect(rows.some((r) => r.day === 'Friday' && r.startTime === '10:00')).toBe(true);
    });
  });

  // ==========================================
  // 6. FORMAT E: KEY-VALUE LABELED LINES
  // ==========================================
  describe('6. Format E: Key-Value Labeled Format', () => {
    it('parses key-value labeled lines with custom field names', () => {
      const text = `
        Day: Monday | Time: 09:00 - 10:00 | Class: CSE-A | Subject: CS201 | Faculty: Dr. Arun Kumar | Room: CS-101
        Day: Wednesday | Period: 10:00 - 11:00 | Cohort: CSE-B | Course: CS202 | Teacher: Dr. Sneha Sharma | Lab: CS-102
      `;

      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBe(2);
      expect(rows[0].day).toBe('Monday');
      expect(rows[0].startTime).toBe('09:00');
      expect(rows[0].endTime).toBe('10:00');
      expect(rows[0].className).toBe('CSE-A');
      expect(rows[0].subject).toBe('CS201');
      expect(rows[0].staff).toBe('Dr. Arun Kumar');
      expect(rows[0].room).toBe('CS-101');

      expect(rows[1].day).toBe('Wednesday');
      expect(rows[1].startTime).toBe('10:00');
      expect(rows[1].endTime).toBe('11:00');
      expect(rows[1].className).toBe('CSE-B');
      expect(rows[1].subject).toBe('CS202');
    });
  });

  // ==========================================
  // 7. TAB & COMMA SEPARATED FORMATS
  // ==========================================
  describe('7. Tab and Comma Separated Timetable Formats', () => {
    it('parses tab-separated values', () => {
      const text = "Monday\t09:00-10:00\tCSE-A\tCS201\tArun Kumar\t101\nTuesday\t10:00-11:00\tCSE-B\tCS202\tSneha Sharma\t102";
      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBe(2);
      expect(rows[0].day).toBe('Monday');
      expect(rows[0].startTime).toBe('09:00');
      expect(rows[0].endTime).toBe('10:00');
      expect(rows[1].day).toBe('Tuesday');
    });

    it('parses comma-separated values', () => {
      const text = "Monday, 09:00, 10:00, CSE-A, CS201, Arun Kumar, 101\nWednesday, 11:15, 12:15, CSE-B, CS203, Sneha Sharma, 102";
      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBe(2);
      expect(rows[0].day).toBe('Monday');
      expect(rows[1].day).toBe('Wednesday');
      expect(rows[1].startTime).toBe('11:15');
      expect(rows[1].endTime).toBe('12:15');
    });

    it('parses abbreviated day headers and Day Order formats', () => {
      const text = `
        MON | KE | SQM | KE | IRT | CC | NS LAB | NS LAB
        TUE | NS | IRT | CC | SQM | KE | CC LAB | CC LAB
        DAY 1: KE, SQM, KE, IRT, CC, NS LAB
        DO 2: NS, IRT, CC, SQM, KE, CC LAB
      `;
      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBeGreaterThanOrEqual(14);
      expect(rows[0].day).toBe('Monday');
      expect(rows[0].subjectCode).toBe('KE');
    });

    it('parses single-space tokenized subject rows', () => {
      const text = `
        MON KE SQM KE IRT CC NS LAB CC LAB
        TUE NS IRT CC SQM KE CC LAB NS LAB
      `;
      const rows = timetablePdfParserService.parseTextRows(text);
      expect(rows.length).toBeGreaterThanOrEqual(12);
      expect(rows[0].day).toBe('Monday');
    });
  });

  // ==========================================
  // 8. UNRESOLVED RECORDS & SCANNED/EMPTY PDFS
  // ==========================================
  describe('8. Database Resolution, Unresolved Flags & Scanned PDF Rejection', () => {
    it('marks unknown staff, class, or subject as UNRESOLVED without inventing database IDs', async () => {
      const PDFDocument = require('pdfkit');
      const pdfBuffer: Buffer = await new Promise((resolve) => {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];
        doc.on('data', (c: Buffer) => buffers.push(c));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.text('Day | Start | End | Class | Subject | Staff');
        doc.text('Monday | 09:00 | 10:00 | UnknownCohort99 | FakeSubject99 | NonExistentProfXYZ');
        doc.end();
      });

      const preview = await timetablePdfParserService.processPdfAndCreatePreview(
        pdfBuffer,
        'unknowns.pdf',
        adminUserId
      );

      expect(preview.summary.unresolvedRows).toBeGreaterThanOrEqual(1);
      const row = preview.rows[0];
      expect(row.isUnresolved).toBe(true);
      expect(row.isValid).toBe(false);
      expect(row.errors.length).toBeGreaterThanOrEqual(1);
      expect(row.staffRecordId).toBeUndefined();
    });

    it('rejects scanned/empty PDFs with the exact informative OCR error message', async () => {
      const PDFDocument = require('pdfkit');
      // Create empty PDF without text
      const emptyBuffer: Buffer = await new Promise((resolve) => {
        const doc = new PDFDocument();
        const buffers: Buffer[] = [];
        doc.on('data', (c: Buffer) => buffers.push(c));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        // No text drawn, blank canvas
        doc.end();
      });

      await expect(
        timetablePdfParserService.processPdfAndCreatePreview(
          emptyBuffer,
          'scanned.pdf',
          adminUserId
        )
      ).rejects.toThrow(/OCR is required/i);
    });
  });
});
