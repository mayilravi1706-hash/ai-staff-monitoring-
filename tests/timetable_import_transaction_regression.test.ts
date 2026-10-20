import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../backend/src/app';
import { prisma } from '../backend/src/config/database';
import { SESSION_COOKIE_NAME } from '../backend/src/middleware/auth';
import { timetablePdfParserService } from '../backend/src/services/timetablePdfParser.service';
import { jobScheduler } from '../backend/src/services/scheduler.service';
import PDFDocument from 'pdfkit';

describe('Timetable Import Transaction Regression Tests (No Closed Transaction)', () => {
  let adminCookie: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Authenticate ADMIN
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

  it('imports a large multi-section, multi-day timetable PDF without transaction timeout or closed transaction errors', async () => {
    // Generate a multi-section, multi-day college timetable containing 70 records (Section A & Section B)
    const largeTimetableText = `
DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
BATCH: 2023-2027 | ACADEMIC YEAR: 2026-2027 | YEAR/SEM: IV/VII
CLASS: CSE IV/VII - SECTION A

TIME TABLE MATRIX:
DAY | HOUR 1 | HOUR 2 | HOUR 3 | HOUR 4 | LUNCH | HOUR 5 | HOUR 6 | HOUR 7
MONDAY | KE | SQM | KE | IRT | LUNCH | CC | NS LAB | NS LAB
TUESDAY | NS | SQM | HCI | CC | LUNCH | C/L/S | IRT | NS
WEDNESDAY | HCI | CC | PROJECT WORK | PROJECT WORK | LUNCH | NS | CC LAB | CC LAB
THURSDAY | CC | IRT | NS | KE | LUNCH | HCI | SQM | IRT
FRIDAY | KE | SQM | NS | CC | LUNCH | IRT | HCI | IRT

FACULTY DETAILS:
KE - KNOWLEDGE ENGINEERING - Prof. Kavita Reddy
NS - NETWORK SECURITY - Dr. Rajesh Verma
CC - CLOUD COMPUTING - Dr. Arun Kumar
IRT - INFORMATION RETRIEVAL TECHNIQUES - Prof. Priya Sharma
SQM - SOFTWARE QUALITY MANAGEMENT - Dr. Sunita Patil
HCI - HUMAN COMPUTER INTERACTION - Prof. Manoj Nair
NS LAB - NETWORK SECURITY LABORATORY - Dr. Rajesh Verma
CC LAB - CLOUD COMPUTING LABORATORY - Dr. Arun Kumar
PROJECT WORK - PROJECT WORK (PHASE - I) - Prof. Kavita Reddy

--- PAGE_BREAK ---

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

    // Clean up timetable records for these classes to ensure clean test state
    const cseClasses = await prisma.class.findMany({
      where: {
        section: { in: ['A', 'B'] },
      },
      select: { id: true },
    });
    const cseClassIds = cseClasses.map((c) => c.id);

    await prisma.classMonitoringAlert.deleteMany({});
    await prisma.operationalAlert.deleteMany({});
    await prisma.timetable.deleteMany({
      where: {
        class_id: { in: cseClassIds },
      },
    });

    const pdfBuffer = await createPdfBuffer(largeTimetableText);

    // 1. Process PDF and generate Preview (OUTSIDE database transaction)
    const previewRes = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', adminCookie)
      .attach('file', pdfBuffer, 'large_multi_section_timetable.pdf');

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.success).toBe(true);
    const previewData = previewRes.body.data;
    expect(previewData.importId).toBeDefined();
    expect(previewData.rows.length).toBeGreaterThanOrEqual(60);

    // 2. Confirm Import (Executes short-lived, preloaded, batch transaction)
    const confirmRes = await request(app)
      .post('/api/timetable/upload/confirm')
      .set('Cookie', adminCookie)
      .send({
        importId: previewData.importId,
        rows: previewData.rows,
        replaceExisting: false,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.importedCount).toBeGreaterThan(0);
    expect(confirmRes.body.data.status).toMatch(/COMPLETED/);

    // 3. Verify records actually exist in the database
    const savedCount = await prisma.timetable.count({
      where: {
        class_id: { in: cseClassIds },
      },
    });
    expect(savedCount).toBe(confirmRes.body.data.importedCount);

    // 4. Duplicate Import Protection: Upload & Confirm the exact same PDF again with replaceExisting = false
    const dupPreviewRes = await request(app)
      .post('/api/timetable/upload/pdf')
      .set('Cookie', adminCookie)
      .attach('file', pdfBuffer, 'large_multi_section_timetable.pdf');

    expect(dupPreviewRes.status).toBe(200);
    const dupPreviewData = dupPreviewRes.body.data;

    const dupConfirmRes = await request(app)
      .post('/api/timetable/upload/confirm')
      .set('Cookie', adminCookie)
      .send({
        importId: dupPreviewData.importId,
        rows: dupPreviewData.rows,
        replaceExisting: false,
      });

    expect(dupConfirmRes.status).toBe(200);
    expect(dupConfirmRes.body.success).toBe(true);
    // Zero new records created on duplicate import!
    expect(dupConfirmRes.body.data.importedCount).toBe(0);
    expect(dupConfirmRes.body.data.skippedCount).toBeGreaterThan(0);

    // Total in database remains unchanged (no duplicates inserted)
    const finalCount = await prisma.timetable.count({
      where: {
        class_id: { in: cseClassIds },
      },
    });
    expect(finalCount).toBe(savedCount);

    // 5. Replace Existing: Confirming with replaceExisting = true updates existing records
    const replaceConfirmRes = await request(app)
      .post('/api/timetable/upload/confirm')
      .set('Cookie', adminCookie)
      .send({
        importId: dupPreviewData.importId,
        rows: dupPreviewData.rows,
        replaceExisting: true,
      });

    expect(replaceConfirmRes.status).toBe(200);
    expect(replaceConfirmRes.body.data.updatedCount).toBeGreaterThan(0);
  });

  it('rejects confirm import with 404 if importId is invalid without unhandled transaction error', async () => {
    const res = await request(app)
      .post('/api/timetable/upload/confirm')
      .set('Cookie', adminCookie)
      .send({
        importId: 'non-existent-import-id',
        rows: [],
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
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
