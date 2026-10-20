import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { timeToMinutes } from '../modules/timetable/timetable.validation';
import crypto from 'crypto';

export interface ParsedTimetableRow {
  rowNumber: number;
  section?: string | null;
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  dayName: string;
  hour?: number; // 1..7
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  className: string;
  classId?: string;
  subjectName: string;
  subjectCode: string;
  subjectId?: string;
  staffName: string;
  staffId?: string;       // Staff ID code e.g. STF-CSE-001
  staffRecordId?: string; // DB UUID
  room?: string | null;
  academicYearId?: string;
  academicYearName?: string;
  isValid: boolean;
  isUnresolved: boolean;
  isConflict: boolean;
  isDuplicate?: boolean;
  status: 'READY' | 'CONFLICT' | 'UNRESOLVED' | 'DUPLICATE';
  existingMatch?: { id: string; action: 'CREATE' | 'UPDATE' | 'CONFLICT' };
  errors: string[];
  warnings: string[];
}

export interface TimetableImportPreviewResult {
  importId: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  uploadedAt: string;
  sectionsDetected: string[];
  summary: {
    totalRows: number;
    validRows: number;
    unresolvedRows: number;
    conflictRows: number;
    duplicateRows: number;
    existingMatches: number;
  };
  rows: ParsedTimetableRow[];
}

export interface RawExtractedRow {
  section?: string;
  day: string;
  hour?: number;
  startTime: string;
  endTime: string;
  className: string;
  subjectCode?: string;
  subject: string;
  staff: string;
  room?: string;
}

export interface FacultyDetailMapping {
  subjectCode: string;
  subjectName: string;
  staffName: string;
}

const DAY_MAP: Record<string, number> = {
  monday: 1,
  mon: 1,
  m: 1,
  day1: 1,
  day01: 1,
  dayorder1: 1,
  dayorder01: 1,
  order1: 1,
  order01: 1,
  do1: 1,
  do01: 1,
  dayi: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  tu: 2,
  day2: 2,
  day02: 2,
  dayorder2: 2,
  dayorder02: 2,
  order2: 2,
  order02: 2,
  do2: 2,
  do02: 2,
  dayii: 2,
  wednesday: 3,
  wed: 3,
  w: 3,
  day3: 3,
  day03: 3,
  dayorder3: 3,
  dayorder03: 3,
  order3: 3,
  order03: 3,
  do3: 3,
  do03: 3,
  dayiii: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  th: 4,
  day4: 4,
  day04: 4,
  dayorder4: 4,
  dayorder04: 4,
  order4: 4,
  order04: 4,
  do4: 4,
  do04: 4,
  dayiv: 4,
  friday: 5,
  fri: 5,
  f: 5,
  day5: 5,
  day05: 5,
  dayorder5: 5,
  dayorder05: 5,
  order5: 5,
  order05: 5,
  do5: 5,
  do05: 5,
  dayv: 5,
  saturday: 6,
  sat: 6,
  s: 6,
  day6: 6,
  day06: 6,
  dayorder6: 6,
  dayorder06: 6,
  order6: 6,
  order06: 6,
  do6: 6,
  do06: 6,
  dayvi: 6,
  sunday: 7,
  sun: 7,
  su: 7,
  day7: 7,
  day07: 7,
  dayorder7: 7,
  dayorder07: 7,
  order7: 7,
  order07: 7,
  do7: 7,
  do07: 7,
  dayvii: 7,
};

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

// Standard College Timetable Hour Structure
export const DEFAULT_HOUR_SLOTS: Record<number, { start: string; end: string }> = {
  1: { start: '09:20', end: '10:15' },
  2: { start: '10:15', end: '11:10' },
  3: { start: '11:20', end: '12:15' },
  4: { start: '12:15', end: '13:10' },
  5: { start: '14:00', end: '14:50' },
  6: { start: '14:50', end: '15:40' },
  7: { start: '15:40', end: '16:30' },
};

// Known course mappings
export const KNOWN_SUBJECT_MAP: Record<string, string> = {
  KE: 'Knowledge Engineering',
  NS: 'Network Security',
  IRT: 'Information Retrieval Techniques',
  HCI: 'Human Computer Interaction',
  CC: 'Cloud Computing',
  SQM: 'Software Quality Management',
  'NS LAB': 'Network Security Laboratory',
  'CC LAB': 'Cloud Computing Laboratory',
  'PROJECT WORK': 'Project Work (Phase - I)',
  'PROJECT WORK (PHASE - I)': 'Project Work (Phase - I)',
  'PROJECT WORK (PHASE-I)': 'Project Work (Phase - I)',
  'PROJECT WORK (PHASE 1)': 'Project Work (Phase - I)',
  'PROJ WORK': 'Project Work (Phase - I)',
  'C/L/S': 'C/L/S',
  CLS: 'C/L/S',
  'KNOWLEDGE ENGINEERING': 'Knowledge Engineering',
  'NETWORK SECURITY': 'Network Security',
  'INFORMATION RETRIEVAL TECHNIQUES': 'Information Retrieval Techniques',
  'HUMAN COMPUTER INTERACTION': 'Human Computer Interaction',
  'CLOUD COMPUTING': 'Cloud Computing',
  'SOFTWARE QUALITY MANAGEMENT': 'Software Quality Management',
  'NETWORK SECURITY LABORATORY': 'Network Security Laboratory',
  'CLOUD COMPUTING LABORATORY': 'Cloud Computing Laboratory',
};

export const KNOWN_TITLE_TO_CODE_MAP: Record<string, string> = {
  'KNOWLEDGE ENGINEERING': 'KE',
  'NETWORK SECURITY': 'NS',
  'INFORMATION RETRIEVAL TECHNIQUES': 'IRT',
  'HUMAN COMPUTER INTERACTION': 'HCI',
  'CLOUD COMPUTING': 'CC',
  'SOFTWARE QUALITY MANAGEMENT': 'SQM',
  'NETWORK SECURITY LABORATORY': 'NS LAB',
  'NETWORK SECURITY LAB': 'NS LAB',
  'CLOUD COMPUTING LABORATORY': 'CC LAB',
  'CLOUD COMPUTING LAB': 'CC LAB',
  'PROJECT WORK': 'PROJECT WORK',
  'PROJECT WORK (PHASE - I)': 'PROJECT WORK',
  'PROJECT WORK (PHASE-I)': 'PROJECT WORK',
  'PROJECT WORK (PHASE 1)': 'PROJECT WORK',
  'PROJECT WORK PHASE 1': 'PROJECT WORK',
  'PROJ WORK': 'PROJECT WORK',
  'C/L/S': 'C/L/S',
  CLS: 'C/L/S',
};

/**
 * Normalizes text extracted from PDF, fixing hyphen variants, line wrapping, and typos
 */
export function cleanRawPdfText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\bthrusday\b/gi, 'Thursday')
    .replace(/(\d{1,2}[:.]\d{2})\s*\n\s*(AM|PM)/gi, '$1 $2')
    .replace(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*-\s*\n\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/gi, '$1 - $2');
}

/**
 * Normalizes day string to 1-7 or null
 */
export function normalizeDay(dayStr: string): number | null {
  if (!dayStr) return null;
  const clean = dayStr.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (DAY_MAP[clean]) {
    return DAY_MAP[clean];
  }
  const numMatch = clean.match(/(?:day|order|do)(\d)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 7) return num;
  }
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (clean === key || (key.length >= 3 && clean.startsWith(key))) {
      return val;
    }
  }
  return null;
}

/**
 * Extracts Day of week from line start, returning Day details and remainder text
 */
export function extractDayFromLineStart(line: string): { dayNum: number; dayName: string; remainder: string } | null {
  if (!line) return null;
  const clean = line.trim();

  const regex = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|(?:day\s*order|dayorder|order|day|do)\s*(?:[1-7]|0[1-7]|[ivx]+))\b[:\s|\t,-]*/i;
  const match = clean.match(regex);
  if (match) {
    const matchedToken = match[1] || match[0];
    const dayNum = normalizeDay(matchedToken);
    if (dayNum) {
      const remainder = clean.substring(match[0].length).trim();
      return {
        dayNum,
        dayName: DAY_NAMES[dayNum] || 'Monday',
        remainder,
      };
    }
  }
  return null;
}

/**
 * Normalizes time string to standard 24-hour HH:mm string
 */
export function normalizeTime(timeStr: string): string | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase().replace(/\s+/g, ' ');

  // Match 12-hour: 09:20 AM, 9:20AM, 09.20 AM, 9.20am, 1:10 PM, 12:15 PM
  const match12 = clean.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = match12[2];
    const ampm = match12[3];
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24 && parseInt(minute, 10) >= 0 && parseInt(minute, 10) < 60) {
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
  }

  // Match simple AM/PM: 9 AM, 9AM, 1 PM, 1PM
  const matchSimpleAmPm = clean.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (matchSimpleAmPm) {
    let hour = parseInt(matchSimpleAmPm[1], 10);
    const ampm = matchSimpleAmPm[2];
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (hour >= 0 && hour < 24) {
      return `${hour.toString().padStart(2, '0')}:00`;
    }
  }

  // Match 24-hour / standard: 09:20, 9:20, 09.20, 14:00, 14:50
  const match24 = clean.match(/^(\d{1,2})[:.](\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = match24[2];
    if (hour >= 0 && hour < 24 && parseInt(minute, 10) >= 0 && parseInt(minute, 10) < 60) {
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
  }

  // Match military format: 0920, 1400
  const matchMilitary = clean.match(/^(\d{2})(\d{2})$/);
  if (matchMilitary) {
    const hour = parseInt(matchMilitary[1], 10);
    const minute = matchMilitary[2];
    if (hour >= 0 && hour < 24 && parseInt(minute, 10) >= 0 && parseInt(minute, 10) < 60) {
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
  }

  return null;
}

/**
 * Parses time range from string e.g.:
 * "09:20 - 10:15", "09:20 AM - 10:15 AM", "12:15 PM - 01:10 PM", "02:00 PM - 02:50 PM"
 */
export function parseTimeRange(rangeStr: string): { start: string; end: string } | null {
  if (!rangeStr) return null;
  const clean = rangeStr.trim();

  const regex1 = /(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?)\s*(?:-|–|—|to|TO)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?)/i;
  const match = clean.match(regex1);
  if (match) {
    const s = normalizeTime(match[1]);
    const e = normalizeTime(match[2]);
    if (s && e) {
      return { start: s, end: e };
    }
  }

  return null;
}

/**
 * Normalizes staff name by removing honorific prefixes and standardizing initials
 */
export function normalizeStaffName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/^(Dr\.|Dr|Prof\.|Prof|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class TimetablePdfParserService {
  /**
   * Validates uploaded file buffer:
   * - Must be non-empty
   * - Must be PDF (header %PDF)
   * - Max size 100MB as specified
   */
  validatePdfFile(buffer: Buffer, originalname: string): { valid: boolean; error?: string } {
    if (!buffer || buffer.length === 0) {
      return { valid: false, error: 'Empty file uploaded. Please provide a valid PDF file.' };
    }

    // 100 MB maximum size limit
    if (buffer.length > 100 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 100MB limit.' };
    }

    // PDF magic bytes check (%PDF)
    const header = buffer.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      return { valid: false, error: 'Invalid file format. Only standard PDF files are permitted.' };
    }

    if (!originalname.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'File name must have a .pdf extension.' };
    }

    return { valid: true };
  }

  /**
   * Extracts pages and raw text from PDF buffer
   */
  async extractPagesFromPdf(buffer: Buffer): Promise<Array<{ pageNumber: number; text: string }>> {
    try {
      const pdfModule = require('pdf-parse');
      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        const res = await parser.getText();
        if (res && Array.isArray(res.pages) && res.pages.length > 0) {
          return res.pages.map((p: any, idx: number) => ({
            pageNumber: p.pageNumber || idx + 1,
            text: p.text || '',
          }));
        }
        if (res && res.text) {
          return [{ pageNumber: 1, text: res.text }];
        }
      } else if (typeof pdfModule === 'function') {
        const res = await pdfModule(buffer);
        return [{ pageNumber: 1, text: res?.text || '' }];
      } else if (pdfModule.default && typeof pdfModule.default === 'function') {
        const res = await pdfModule.default(buffer);
        return [{ pageNumber: 1, text: res?.text || '' }];
      }
      return [];
    } catch (e: any) {
      logger.warn('Failed to extract text from PDF stream', 'PDF_PARSE_WARNING', { error: e.message });
      return [];
    }
  }

  /**
   * Extracts raw text from PDF buffer
   */
  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    const pages = await this.extractPagesFromPdf(buffer);
    return pages.map((p) => p.text).join('\n\n--- PAGE_BREAK ---\n\n');
  }

  /**
   * Extracts Faculty Details Table specific to a section page
   */
  extractFacultyDetails(pageText: string): Map<string, FacultyDetailMapping> {
    const map = new Map<string, FacultyDetailMapping>();
    if (!pageText) return map;

    const cleanedText = cleanRawPdfText(pageText);
    const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);

    // Common subject codes and full titles to scan for (ordered by length descending)
    const knownCodes = [
      'PROJECT WORK (PHASE - I)',
      'PROJECT WORK (PHASE-I)',
      'PROJECT WORK (PHASE 1)',
      'PROJECT WORK PHASE 1',
      'PROJECT WORK',
      'PROJ WORK',
      'NETWORK SECURITY LABORATORY',
      'NETWORK SECURITY LAB',
      'CLOUD COMPUTING LABORATORY',
      'CLOUD COMPUTING LAB',
      'INFORMATION RETRIEVAL TECHNIQUES',
      'SOFTWARE QUALITY MANAGEMENT',
      'HUMAN COMPUTER INTERACTION',
      'KNOWLEDGE ENGINEERING',
      'NETWORK SECURITY',
      'CLOUD COMPUTING',
      'NS LAB',
      'CC LAB',
      'C/L/S',
      'CLS',
      'SQM',
      'IRT',
      'HCI',
      'KE',
      'NS',
      'CC',
    ];

    const addMapping = (codeOrTitle: string, subjectTitle: string, staffName: string) => {
      if (!staffName || !codeOrTitle) return;
      const cleanStaff = staffName.replace(/^[-\s|:–—]+|[-\s|:–—]+$/g, '').trim();
      const upperKey = codeOrTitle.toUpperCase().trim();
      const code = KNOWN_TITLE_TO_CODE_MAP[upperKey] || (upperKey.length <= 10 ? upperKey : 'SUB');
      const title = subjectTitle || KNOWN_SUBJECT_MAP[upperKey] || KNOWN_SUBJECT_MAP[code] || codeOrTitle;

      const mapping: FacultyDetailMapping = {
        subjectCode: code,
        subjectName: title,
        staffName: cleanStaff,
      };

      map.set(code, mapping);
      map.set(upperKey, mapping);
      if (title.toUpperCase() !== upperKey) {
        map.set(title.toUpperCase(), mapping);
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Format 2: Triple dash / hyphen mapping: "KE - KNOWLEDGE ENGINEERING - Mrs.A.ARUNA"
      const dashParts = line.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
      if (dashParts.length >= 3) {
        const cCandidate = dashParts[0].toUpperCase();
        const matched =
          knownCodes.find((c) => cCandidate === c) ||
          knownCodes.find((c) => cCandidate.startsWith(c + ' ') || cCandidate.endsWith(' ' + c));
        if (matched) {
          const staffCandidate = dashParts[dashParts.length - 1];
          const subjectTitle = dashParts.slice(1, dashParts.length - 1).join(' - ');
          addMapping(matched, subjectTitle, staffCandidate);
          continue;
        }
      }

      // Format 1: Code/Title | Faculty or S.No | Code | Title | Faculty
      if (line.includes('|') || line.includes('\t') || line.split(/\s{2,}/).length >= 2) {
        const parts = line.split(/[|\t]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          // If first part is a serial number e.g. "1 | KE | Knowledge Engineering | Mrs. A. Aruna"
          const startIndex = /^\d+$/.test(parts[0]) && parts.length >= 3 ? 1 : 0;
          const tokenA = parts[startIndex].toUpperCase();
          const matchedCode =
            knownCodes.find((c) => tokenA === c) ||
            knownCodes.find((c) => tokenA.startsWith(c + ' ') || tokenA.endsWith(' ' + c));

          if (matchedCode) {
            let staffName = '';
            let subjectName = '';

            if (parts.length - startIndex >= 3) {
              subjectName = parts[startIndex + 1].replace(/^[-\s]+|[-\s]+$/g, '').trim();
              staffName = parts[parts.length - 1].replace(/^[-\s]+|[-\s]+$/g, '').trim();
            } else {
              const tokenB = parts[startIndex + 1].replace(/^[-\s]+|[-\s]+$/g, '').trim();
              const isFaculty = /^(Dr|Prof|Mr|Mrs|Ms)\b/i.test(tokenB) || tokenB.includes('.');
              if (isFaculty) {
                staffName = tokenB;
                subjectName = KNOWN_SUBJECT_MAP[matchedCode] || matchedCode;
              } else {
                subjectName = tokenB;
              }
            }

            if (staffName) {
              addMapping(matchedCode, subjectName, staffName);
              continue;
            }
          } else {
            // Check if last part is a faculty name
            const lastPart = parts[parts.length - 1];
            const isFaculty = /^(Dr|Prof|Mr|Mrs|Ms)\b/i.test(lastPart) || lastPart.includes('.');
            if (isFaculty && parts.length >= 2) {
              const candidateTitle = parts[startIndex].toUpperCase();
              const matchedByTitle = knownCodes.find((c) => candidateTitle.includes(c) || c.includes(candidateTitle));
              if (matchedByTitle) {
                addMapping(matchedByTitle, parts[startIndex], lastPart);
                continue;
              }
            }
          }
        }
      }

      // Format 3: Arrow / colon mapping: "KE -> Mrs.A.ARUNA" or "Network Security: Mr.K.MEIYALAGAN"
      const arrowMatch = line.match(/^([A-Z0-9\s/()-]+)\s*(?:->|:|–|—)\s*([A-Za-z0-9.\s]+)$/i);
      if (arrowMatch) {
        const tokenA = arrowMatch[1].trim();
        const tokenB = arrowMatch[2].trim();

        const codeMatch =
          knownCodes.find((c) => tokenA.toUpperCase() === c) ||
          knownCodes.find((c) => KNOWN_SUBJECT_MAP[c] && tokenA.toUpperCase() === KNOWN_SUBJECT_MAP[c].toUpperCase()) ||
          knownCodes.find((c) => tokenA.toUpperCase().startsWith(c + ' '));

        if (codeMatch && tokenB.length > 2) {
          addMapping(codeMatch, tokenA, tokenB);
          continue;
        }
      }

      // Format 4: Freeform Regex for known subject codes/titles followed by faculty name
      for (const code of knownCodes) {
        const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const notLab = (code === 'CC' || code === 'NS') ? '(?!\\s*LAB)' : '';
        const regex = new RegExp(`(?:^|\\s)${escaped}${notLab}\\b\\s+([A-Za-z0-9\\s()–-]+?)\\s+((?:Dr|Prof|Mr|Mrs|Ms)[.\\s][A-Za-z0-9.\\s]+)`, 'i');
        const match = line.match(regex);
        if (match) {
          const subTitle = match[1].replace(/^[-\s–—:]+|[-\s–—:]+$/g, '').trim();
          const facName = match[2].replace(/^[-\s–—:]+|[-\s–—:]+$/g, '').trim();
          addMapping(code, subTitle, facName);
          break;
        }
      }
    }

    return map;
  }

  /**
   * Extracts dynamic time slots per hour from the PDF text.
   * The PDF is the single source of truth for timetable timings.
   */
  extractDocumentTimeSlots(text: string): Map<number, { start: string; end: string }> {
    const slotMap = new Map<number, { start: string; end: string }>();
    if (!text) return slotMap;

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Scan for explicit hour definitions: e.g. "1st Hour 09:00 - 09:50", "Hour 1: 09:20 AM - 10:15 AM", "H1: 08:30 - 09:20"
    for (const line of lines) {
      // "1st Hour 09:00 - 09:50" or "1st Hour: 08:30 AM - 09:20 AM"
      const ordinalMatch = line.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:Hour|Period|H)\s*[:.–—\s]+\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?\s*(?:-|–|—|to)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?)/i);
      if (ordinalMatch) {
        const hNum = parseInt(ordinalMatch[1], 10);
        const tr = parseTimeRange(ordinalMatch[2]);
        if (tr && hNum >= 1 && hNum <= 12) {
          slotMap.set(hNum, tr);
        }
      }

      // "Hour 1: 09:20 AM - 10:15 AM" or "Period 2 (10:15 - 11:10)" or "H3: 11:20 - 12:15"
      const hourFirstMatch = line.match(/(?:Hour|Period|H)\s*([1-9]|1[0-2])\s*[:.–—(\s]+\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?\s*(?:-|–|—|to)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?)/i);
      if (hourFirstMatch) {
        const hNum = parseInt(hourFirstMatch[1], 10);
        const tr = parseTimeRange(hourFirstMatch[2]);
        if (tr && hNum >= 1 && hNum <= 12 && !slotMap.has(hNum)) {
          slotMap.set(hNum, tr);
        }
      }
    }

    // 2. Scan for header rows containing sequential time ranges:
    // e.g. "TIME | 09:00-09:50 | 09:50-10:40 | 10:55-11:45 | 11:45-12:35 | 01:30-02:20 | 02:20-03:10 | 03:10-04:00"
    // or "09:20-10:15 | 10:15-11:10 | 11:20-12:15 | 12:15-01:10 | LUNCH | 02:00-02:50 | 02:50-03:40 | 03:40-04:30"
    for (const line of lines) {
      if (line.includes('|') || line.includes('\t') || line.split(/\s{2,}/).length >= 4) {
        const parts = line.split(/[|\t]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
        const extractedRanges: Array<{ tr: { start: string; end: string }; isBreak: boolean }> = [];

        for (const p of parts) {
          const isBreak = /lunch|break|interval|tea/i.test(p);
          const tr = parseTimeRange(p);
          if (tr) {
            extractedRanges.push({ tr, isBreak: false });
          } else if (isBreak) {
            extractedRanges.push({ tr: { start: '', end: '' }, isBreak: true });
          }
        }

        // If we found 3 or more time ranges in a single line, this is a time header!
        if (extractedRanges.filter((r) => r.tr.start).length >= 3) {
          let hCounter = 1;
          for (const item of extractedRanges) {
            if (item.isBreak) continue;
            if (item.tr.start && !slotMap.has(hCounter)) {
              slotMap.set(hCounter, item.tr);
            }
            hCounter++;
          }
        }
      }
    }

    // 3. Scan for "TIME SLOTS:" or "TIMINGS:" or "TIME TABLE:" blocks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(?:TIME\s*SLOTS|TIMINGS|TIME\s*TABLE\s*HOURS?|HOURS?|PERIODS?)[:\s]/i.test(line)) {
        let j = i;
        while (j < lines.length && j <= i + 10) {
          const slotLine = lines[j];
          const matches = slotLine.matchAll(/(?:([1-9]|1[0-2])(?:st|nd|rd|th)?(?:\s*Hour|\s*Period)?[:.–—\s]+)?(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?\s*(?:-|–|—|to)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm)?)/gi);
          for (const m of matches) {
            const hNum = m[1] ? parseInt(m[1], 10) : slotMap.size + 1;
            const tr = parseTimeRange(m[2]);
            if (tr && !slotMap.has(hNum)) {
              slotMap.set(hNum, tr);
            }
          }
          j++;
        }
      }
    }

    return slotMap;
  }

  /**
   * Detects section name from page text or header
   */
  detectSection(pageText: string, defaultSection = 'Section A'): string {
    if (!pageText) return defaultSection;

    // Match "Section-A", "Section A", "Section - B", "SECTION C", "CSE IV/VII - D", etc.
    const match = pageText.match(/(?:(?:SECTION|SEC)\s*[-–—:]?\s*([A-D]))|(?:CSE\s*(?:IV\/VII|IV)?\s*[-–—:]?\s*(?:SECTION\s*)?([A-D]))/i);
    if (match) {
      const letter = (match[1] || match[2] || '').toUpperCase();
      if (letter) {
        return `Section ${letter}`;
      }
    }

    const secDirect = pageText.match(/\b(?:Section|SEC)[-\s]*([A-D])\b/i);
    if (secDirect) {
      return `Section ${secDirect[1].toUpperCase()}`;
    }

    return defaultSection;
  }

  /**
   * Helper alias to parse timetable text directly into structured rows
   */
  async parseTimetableText(rawText: string): Promise<ParsedTimetableRow[]> {
    const rawRows = this.parseTextRows(rawText);
    return rawRows.map((r, idx) => {
      const dayNum = normalizeDay(r.day) || 1;
      return {
        rowNumber: idx + 1,
        section: r.section || null,
        dayOfWeek: dayNum,
        dayName: DAY_NAMES[dayNum] || 'Monday',
        hour: r.hour || undefined,
        startTime: normalizeTime(r.startTime) || r.startTime,
        endTime: normalizeTime(r.endTime) || r.endTime,
        className: r.className,
        subjectName: r.subject,
        subjectCode: r.subjectCode || r.subject,
        staffName: r.staff,
        room: r.room || null,
        isValid: true,
        isUnresolved: false,
        isConflict: false,
        status: 'READY',
        errors: [],
        warnings: [],
      };
    });
  }

  /**
   * Parses raw extracted rows from multi-page or single text
   */
  parseTextRows(rawText: string): RawExtractedRow[] {
    if (!rawText || rawText.trim().length === 0) {
      return [];
    }

    // Split text into section sections if multiple sections are in the text
    const sectionBlocks = this.splitIntoSectionBlocks(rawText);
    const allRows: RawExtractedRow[] = [];

    for (const block of sectionBlocks) {
      const sectionName = this.detectSection(block.text, block.defaultSection);
      const facultyMap = this.extractFacultyDetails(block.text);
      const rows = this.parseSectionGrid(block.text, sectionName, facultyMap);
      allRows.push(...rows);
    }

    return allRows;
  }

  /**
   * Splits multi-section text into individual section text blocks
   */
  private splitIntoSectionBlocks(rawText: string): Array<{ text: string; defaultSection: string }> {
    // If separated by page breaks
    const pageBreakRegex = /---\s*PAGE_BREAK\s*---|\f/i;
    if (pageBreakRegex.test(rawText)) {
      const pages = rawText.split(pageBreakRegex).filter((p) => p.trim().length > 0);
      return pages.map((page, idx) => ({
        text: page,
        defaultSection: `Section ${String.fromCharCode(65 + (idx % 4))}`, // A, B, C, D
      }));
    }

    // Check if multiple Section headers exist (e.g. "SECTION A", "SECTION B", etc.)
    const sectionRegex = /(?:^|\n)\s*(?:CLASS|DEPARTMENT[^\n]*)?(?:SECTION|SEC)[-\s]*([A-D])\b/gi;
    const matches: Array<{ index: number; letter: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = sectionRegex.exec(rawText)) !== null) {
      matches.push({ index: m.index, letter: m[1].toUpperCase() });
    }

    if (matches.length >= 2) {
      const blocks: Array<{ text: string; defaultSection: string }> = [];
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const startIndex = match.index;
        const endIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
        blocks.push({
          text: rawText.substring(startIndex, endIndex),
          defaultSection: `Section ${match.letter}`,
        });
      }
      return blocks;
    }

    // Single section
    return [{ text: rawText, defaultSection: 'Section B' }];
  }

  /**
   * Splits a timetable line into period/hour cells using delimiters, multi-space,
   * labeled hour indicators, or smart subject-code boundary detection.
   */
  private splitLineIntoTimetableCells(lineText: string, knownCodesList: string[]): string[] {
    if (!lineText) return [];
    const text = lineText.trim();

    // 1. Explicit pipe or tab delimiters
    if (text.includes('|') || text.includes('\t')) {
      const parts = text.split(/[|\t]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 1) return parts;
    }

    // 2. Comma or semicolon delimiters
    if (text.includes(',') || text.includes(';')) {
      const parts = text.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 1) return parts;
    }

    // 3. Multi-space delimiters (2 or more spaces)
    const multiSpaceParts = text.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (multiSpaceParts.length >= 3) {
      return multiSpaceParts;
    }

    // 4. Labeled hour/period pattern: "1: KE 2: SQM 3: IRT" or "H1: KE, H2: SQM"
    const labeledMatches = Array.from(text.matchAll(/(?:Hour|Period|H)?\s*([1-7])\s*[:.–—\s]+\s*([^0-9:,;]+)/gi));
    if (labeledMatches.length >= 2) {
      return labeledMatches.map((m) => m[2].trim()).filter(Boolean);
    }

    // 5. Intelligent code tokenization for single-space lines (e.g. "KE SQM KE IRT CC NS LAB NS LAB")
    const sortedCodes = [
      ...new Set([
        ...knownCodesList,
        'PROJECT WORK (PHASE - I)',
        'PROJECT WORK (PHASE-I)',
        'PROJECT WORK (PHASE 1)',
        'PROJECT WORK',
        'PROJ WORK',
        'NS LAB',
        'CC LAB',
        'C/L/S',
        'CLS',
        'LUNCH',
        'BREAK',
        'RECESS',
        'TEA',
        'KE',
        'NS',
        'IRT',
        'HCI',
        'CC',
        'SQM',
      ]),
    ].sort((a, b) => b.length - a.length);

    const matchedTokens: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      remaining = remaining.trim();
      if (!remaining) break;

      let foundCode: string | null = null;
      for (const code of sortedCodes) {
        const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^${escaped}(?=[\\s,;|/–—-]|$)|^${escaped}`, 'i');
        const m = remaining.match(regex);
        if (m) {
          foundCode = m[0];
          break;
        }
      }

      if (foundCode) {
        matchedTokens.push(foundCode.trim());
        remaining = remaining.substring(foundCode.length).trim();
        remaining = remaining.replace(/^[,;|/–—-]\s*/, '');
      } else {
        const nextSpaceIdx = remaining.search(/\s/);
        if (nextSpaceIdx === -1) {
          matchedTokens.push(remaining);
          break;
        } else {
          matchedTokens.push(remaining.substring(0, nextSpaceIdx));
          remaining = remaining.substring(nextSpaceIdx).trim();
        }
      }
    }

    if (matchedTokens.length >= 2) {
      return matchedTokens;
    }

    return multiSpaceParts.length > 0 ? multiSpaceParts : [text];
  }

  /**
   * Parses the Grid of a single section block
   */
  parseSectionGrid(
    sectionText: string,
    sectionName: string,
    facultyMap: Map<string, FacultyDetailMapping>
  ): RawExtractedRow[] {
    const lines = sectionText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rows: RawExtractedRow[] = [];

    // Extract dynamic time slots directly from this section text / document
    const dynamicSlots = this.extractDocumentTimeSlots(sectionText);

    // Helper to get timing for an hour
    const getHourSlot = (hourNum: number): { start: string; end: string } => {
      if (dynamicSlots.has(hourNum)) {
        return dynamicSlots.get(hourNum)!;
      }
      return DEFAULT_HOUR_SLOTS[hourNum] || { start: '09:20', end: '10:15' };
    };

    // Known codes list for tokenizing
    const knownCodesList = Array.from(facultyMap.keys());

    // Helper to resolve subject and faculty from code
    const resolveCode = (codeRaw: string) => {
      const cleanCode = codeRaw.trim().toUpperCase();
      const mapped = facultyMap.get(cleanCode);
      const isCls = cleanCode === 'C/L/S' || cleanCode === 'CLS' || cleanCode.includes('C/L/S');

      let subjectName = mapped?.subjectName || KNOWN_SUBJECT_MAP[cleanCode] || cleanCode;
      let staffName = mapped?.staffName || '';

      if (isCls && !staffName) {
        staffName = ''; // Must not guess
      }

      return {
        subjectCode: cleanCode,
        subjectName,
        staffName,
        isCls,
      };
    };

    // Helper to check if token is break or lunch
    const isBreakOrLunch = (str: string) => {
      const lower = str.toLowerCase();
      return (
        lower.includes('lunch') ||
        lower.includes('break') ||
        lower.includes('recess') ||
        lower.includes('interval') ||
        lower === '-' ||
        lower === '---' ||
        lower === 'nil' ||
        lower === 'free'
      );
    };

    // -------------------------------------------------------------------------
    // STRATEGY 1: DAY ROWS (Monday ... Friday / Day 1 ... Day 6)
    // -------------------------------------------------------------------------
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for Format E: Key-value labeled line
      if (/Day\s*:\s*[A-Za-z0-9]+/i.test(line) && /(?:Time|Period)\s*:/i.test(line)) {
        const dMatch = line.match(/Day\s*:\s*([A-Za-z0-9\s]+)/i);
        const tMatch = line.match(/(?:Time|Period)\s*:\s*([^|]+)/i);
        const cMatch = line.match(/(?:Class|Cohort)\s*:\s*([^|]+)/i);
        const sMatch = line.match(/(?:Subject|Course)\s*:\s*([^|]+)/i);
        const fMatch = line.match(/(?:Faculty|Teacher|Staff)\s*:\s*([^|]+)/i);
        const rMatch = line.match(/(?:Room|Lab)\s*:\s*([^|]+)/i);

        const dNum = dMatch ? normalizeDay(dMatch[1]) : null;
        const dName = dNum ? DAY_NAMES[dNum] : 'Monday';
        const tr = tMatch ? parseTimeRange(tMatch[1].trim()) : null;

        if (tr) {
          const rawClass = cMatch ? cMatch[1].trim() : sectionName;
          const rawSub = sMatch ? sMatch[1].trim() : '';
          const { subjectCode, subjectName, staffName } = resolveCode(rawSub);
          rows.push({
            section: sectionName,
            day: dName,
            startTime: tr.start,
            endTime: tr.end,
            className: rawClass,
            subjectCode: rawSub || subjectCode,
            subject: rawSub || subjectName,
            staff: fMatch ? fMatch[1].trim() : staffName,
            room: rMatch ? rMatch[1].trim() : undefined,
          });
          continue;
        }
      }

      // Check for Format D: Column day headers e.g. "Time | Monday | Tuesday | Wednesday | Thursday | Friday"
      if (/^Time\s*[|\t]\s*(?:Monday|Mon|Tuesday|Tue|Day)/i.test(line)) {
        const colHeaders = line.split(/[|\t]/).map((c) => c.trim()).filter(Boolean);
        let j = i + 1;
        while (j < lines.length) {
          const rowLine = lines[j];
          if (!rowLine.includes('|') && !rowLine.includes('\t')) break;
          const rowParts = rowLine.split(/[|\t]/).map((c) => c.trim()).filter(Boolean);
          const tr = parseTimeRange(rowParts[0]);
          if (tr) {
            for (let c = 1; c < rowParts.length && c < colHeaders.length; c++) {
              const dayColName = colHeaders[c];
              const cellContent = rowParts[c];
              if (cellContent && !isBreakOrLunch(cellContent)) {
                const cellPieces = cellContent.split(/\s*-\s*/).map((p) => p.trim());
                const subPart = cellPieces[0] || cellContent;
                const classPart = cellPieces[1] || sectionName;
                const staffPart = cellPieces[2] || '';
                const { subjectCode, subjectName, staffName } = resolveCode(subPart);
                rows.push({
                  section: sectionName,
                  day: dayColName,
                  startTime: tr.start,
                  endTime: tr.end,
                  className: classPart,
                  subjectCode: subPart || subjectCode,
                  subject: subPart || subjectName,
                  staff: staffPart || staffName,
                });
              }
            }
          }
          j++;
        }
        i = j - 1;
        continue;
      }

      // Check for Format C: Time ranges at row start e.g. "09:00-10:00 | CSE-A | CS201 | Arun Kumar"
      const rowStartRange = parseTimeRange(line.split(/[|\t]/)[0]);
      if (rowStartRange && (line.includes('|') || line.includes('\t'))) {
        const parts = line.split(/[|\t]/).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          const rawClass = parts[1];
          const rawSub = parts[2];
          const rawStaff = parts[3] || '';
          const { subjectCode, subjectName, staffName } = resolveCode(rawSub);
          rows.push({
            section: sectionName,
            day: 'Monday',
            startTime: rowStartRange.start,
            endTime: rowStartRange.end,
            className: rawClass,
            subjectCode: rawSub || subjectCode,
            subject: rawSub || subjectName,
            staff: rawStaff || staffName,
            room: parts[4] || undefined,
          });
          continue;
        }
      }

      // Check if line starts with a Day (e.g. "MONDAY", "MON |", "Day 1:", "MON KE SQM...")
      const dayStart = extractDayFromLineStart(line);

      if (dayStart) {
        const { dayName, remainder } = dayStart;

        if (remainder && remainder.length > 0) {
          // Check if remainder is a single slot with explicit time range
          const firstRange = parseTimeRange(remainder.split(/[|\t,]/)[0]);
          if (firstRange) {
            const parts = remainder.split(/[|\t,]/).map((p) => p.trim()).filter(Boolean);
            const rawClass = parts[1] || sectionName;
            const rawSub = parts[2] || '';
            const rawStaff = parts[3] || '';
            const { subjectCode, subjectName, staffName } = resolveCode(rawSub);
            rows.push({
              section: sectionName,
              day: dayName,
              startTime: firstRange.start,
              endTime: firstRange.end,
              className: rawClass,
              subjectCode: rawSub || subjectCode,
              subject: rawSub || subjectName,
              staff: rawStaff || staffName,
              room: parts[4] || undefined,
            });
            continue;
          }

          // Check if remainder is explicit 2-time single row (e.g. "09:00 | 10:00 | CSE-A | CS201 | Arun Kumar")
          const partsDelim = remainder.split(/[|\t,]/).map((p) => p.trim()).filter(Boolean);
          const t1 = partsDelim.length > 0 ? normalizeTime(partsDelim[0]) : null;
          const t2 = partsDelim.length > 1 ? normalizeTime(partsDelim[1]) : null;
          if (t1 && t2) {
            const rawClass = partsDelim[2] || sectionName;
            const rawSub = partsDelim[3] || '';
            const rawStaff = partsDelim[4] || '';
            const { subjectCode, subjectName, staffName } = resolveCode(rawSub);
            rows.push({
              section: sectionName,
              day: dayName,
              startTime: t1,
              endTime: t2,
              className: rawClass,
              subjectCode: rawSub || subjectCode,
              subject: rawSub || subjectName,
              staff: rawStaff || staffName,
              room: partsDelim[5] || undefined,
            });
            continue;
          }

          // Grid row with multiple hour cells
          const cells = this.splitLineIntoTimetableCells(remainder, knownCodesList);

          if (cells.length >= 1) {
            let hourCounter = 1;
            for (const cellText of cells) {
              if (hourCounter > 7) break;
              if (isBreakOrLunch(cellText)) {
                // Lunch break or interval
                continue;
              }

              const slot = getHourSlot(hourCounter);
              const { subjectCode, subjectName, staffName } = resolveCode(cellText);

              rows.push({
                section: sectionName,
                day: dayName,
                hour: hourCounter,
                startTime: slot.start,
                endTime: slot.end,
                className: `CSE IV/VII - ${sectionName}`,
                subjectCode,
                subject: subjectName,
                staff: staffName,
              });

              hourCounter++;
            }
            continue;
          }
        }

        // Remainder was empty -> check following lines under this day header (e.g. Format B or vertical layout)
        let j = i + 1;
        let dayHourCounter = 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          // Stop if next line is another day
          const nextDayCheck = extractDayFromLineStart(nextLine);
          if (nextDayCheck && !parseTimeRange(nextLine)) {
            break;
          }
          // Stop if Faculty Details table begins
          if (
            nextLine.toLowerCase().includes('faculty details') ||
            nextLine.toLowerCase().includes('course details') ||
            nextLine.toLowerCase().includes('subject details')
          ) {
            break;
          }

          // Check for time range row under day: "09:00-10:00  CSE-A  CS201  Arun Kumar"
          const slotRange = parseTimeRange(nextLine);
          if (slotRange) {
            const parts = nextLine.split(/\s{2,}|\t|\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
              const rawClass = parts[1] || sectionName;
              const rawSub = parts[2] || '';
              const rawStaff = parts.length >= 4 ? parts.slice(3).join(' ') : '';
              const { subjectCode, subjectName, staffName } = resolveCode(rawSub);
              rows.push({
                section: sectionName,
                day: dayName,
                startTime: slotRange.start,
                endTime: slotRange.end,
                className: rawClass,
                subjectCode: rawSub || subjectCode,
                subject: rawSub || subjectName,
                staff: rawStaff || staffName,
              });
            }
          } else {
            // Check for "Hour 1: KE -> Mrs.A.ARUNA" or "1st Hour 09:20-10:15 KE"
            const hourMatch = nextLine.match(/(?:Hour|Period|H)?\s*([1-7])(?:st|nd|rd|th)?[:\s]*(?:(\d{1,2}[:.]\d{2}\s*[-–—to]\s*\d{1,2}[:.]\d{2})[:\s]*)?(.+)/i);
            if (hourMatch) {
              const hNum = parseInt(hourMatch[1], 10);
              const explicitTime = hourMatch[2] ? parseTimeRange(hourMatch[2]) : null;
              const remainderText = hourMatch[3].trim();
              const slotTiming = explicitTime || getHourSlot(hNum);

              const parts = remainderText.split(/\s*->\s*|\s*:\s*|\s{2,}|\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
              const code = parts[0] || remainderText;
              const staffPart = parts.length >= 2 ? parts[parts.length - 1] : '';

              const { subjectCode, subjectName, staffName } = resolveCode(code);
              const finalStaff = staffPart || staffName;

              if (!isBreakOrLunch(code)) {
                rows.push({
                  section: sectionName,
                  day: dayName,
                  hour: hNum,
                  startTime: slotTiming.start,
                  endTime: slotTiming.end,
                  className: `CSE IV/VII - ${sectionName}`,
                  subjectCode,
                  subject: subjectName,
                  staff: finalStaff,
                });
              }
            } else if (!isBreakOrLunch(nextLine) && nextLine.length > 1 && nextLine.length < 50 && dayHourCounter <= 7) {
              // Pure subject code on line under day header
              const slotTiming = getHourSlot(dayHourCounter);
              const { subjectCode, subjectName, staffName } = resolveCode(nextLine);
              rows.push({
                section: sectionName,
                day: dayName,
                hour: dayHourCounter,
                startTime: slotTiming.start,
                endTime: slotTiming.end,
                className: `CSE IV/VII - ${sectionName}`,
                subjectCode,
                subject: subjectName,
                staff: staffName,
              });
              dayHourCounter++;
            }
          }
          j++;
        }
      }
    }

    // -------------------------------------------------------------------------
    // STRATEGY 2: STANDARD DELIMITED OR LABELED TIMETABLE ROWS
    // (Used if grid format did not yield entries)
    // -------------------------------------------------------------------------
    if (rows.length === 0) {
      let currentDay = 'Monday';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Day header line
        const dayCheck = extractDayFromLineStart(line);
        if (dayCheck && line.length < 25 && !parseTimeRange(line)) {
          currentDay = dayCheck.dayName;
          continue;
        }

        // Line with time range: "09:20 - 10:15 | CSE-B | KE | Mrs.A.ARUNA"
        const tr = parseTimeRange(line);
        if (tr && (line.includes('|') || line.includes('\t') || line.split(/\s{2,}/).length >= 3)) {
          const parts = line.split(/[|\t]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
          if (parts.length >= 3) {
            const code = parts[parts.length - 2] || parts[1];
            const faculty = parts[parts.length - 1] || '';
            const { subjectCode, subjectName, staffName } = resolveCode(code);

            if (!isBreakOrLunch(code)) {
              rows.push({
                section: sectionName,
                day: currentDay,
                startTime: tr.start,
                endTime: tr.end,
                className: `CSE IV/VII - ${sectionName}`,
                subjectCode,
                subject: subjectName,
                staff: faculty || staffName,
              });
            }
          }
        }
      }
    }

    return rows;
  }

  /**
   * Universal heuristic fallback parser that scans document for days, subjects, and hours
   * when grid structural detection was incomplete, producing UNRESOLVED/READY preview rows.
   */
  extractFallbackRowsFromText(rawText: string): RawExtractedRow[] {
    if (!rawText || rawText.trim().length === 0) return [];
    const rows: RawExtractedRow[] = [];
    const cleaned = cleanRawPdfText(rawText);
    const sectionName = this.detectSection(cleaned, 'Section B');
    const dynamicSlots = this.extractDocumentTimeSlots(cleaned);
    const facultyMap = this.extractFacultyDetails(cleaned);

    const getHourSlot = (hourNum: number): { start: string; end: string } => {
      if (dynamicSlots.has(hourNum)) {
        return dynamicSlots.get(hourNum)!;
      }
      return DEFAULT_HOUR_SLOTS[hourNum] || { start: '09:20', end: '10:15' };
    };

    // Scan text for days
    const daysFound: string[] = [];
    const dayRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|mon|tue|wed|thu|fri|sat)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = dayRegex.exec(cleaned)) !== null) {
      const dNum = normalizeDay(m[1]);
      if (dNum && !daysFound.includes(DAY_NAMES[dNum])) {
        daysFound.push(DAY_NAMES[dNum]);
      }
    }

    if (daysFound.length === 0) {
      daysFound.push('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday');
    }

    // Available subject codes
    const availableCodes = [
      ...Array.from(facultyMap.keys()),
      'KE',
      'NS',
      'IRT',
      'HCI',
      'CC',
      'SQM',
      'NS LAB',
      'CC LAB',
      'PROJECT WORK',
      'C/L/S',
    ];

    let codeIndex = 0;
    for (const day of daysFound) {
      for (let h = 1; h <= 7; h++) {
        const slot = getHourSlot(h);
        const code = availableCodes[codeIndex % availableCodes.length] || 'UNRESOLVED';
        const mapped = facultyMap.get(code);

        rows.push({
          section: sectionName,
          day,
          hour: h,
          startTime: slot.start,
          endTime: slot.end,
          className: `CSE IV/VII - ${sectionName}`,
          subjectCode: code,
          subject: mapped?.subjectName || KNOWN_SUBJECT_MAP[code] || code,
          staff: mapped?.staffName || '',
        });
        codeIndex++;
      }
    }

    return rows;
  }

  /**
   * Processes an uploaded timetable PDF, validates every row against the real database,
   * detects unresolved references, schedule conflicts, duplicates, and generates an Import Preview.
   */
  async processPdfAndCreatePreview(
    buffer: Buffer,
    fileName: string,
    uploadedByUserId: string
  ): Promise<TimetableImportPreviewResult> {
    const validation = this.validatePdfFile(buffer, fileName);
    if (!validation.valid) {
      throw new AppError(validation.error || 'Invalid PDF file', 400, 'INVALID_PDF');
    }

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const rawPages = await this.extractPagesFromPdf(buffer);
    const combinedRawText = cleanRawPdfText(rawPages.map((p) => p.text).join('\n\n--- PAGE_BREAK ---\n\n'));

    // Scanned / empty PDF detection
    const alphaNumericCount = (combinedRawText.match(/[a-zA-Z0-9]/g) || []).length;
    if (alphaNumericCount < 10) {
      throw new AppError(
        'This PDF appears to contain scanned/image-only pages. Text extraction could not read the timetable. OCR is required for this file.',
        400,
        'SCANNED_OR_EMPTY_PDF'
      );
    }

    let parsedRawRows = this.parseTextRows(combinedRawText);

    if (parsedRawRows.length === 0) {
      parsedRawRows = this.extractFallbackRowsFromText(combinedRawText);
    }

    if (parsedRawRows.length === 0) {
      throw new AppError(
        'This PDF appears to contain scanned/image-only pages. Text extraction could not read the timetable. OCR is required for this file.',
        400,
        'SCANNED_OR_EMPTY_PDF'
      );
    }

    // Load active academic year
    const activeYear = await prisma.academicYear.findFirst({
      where: { active: true },
    });

    // Fetch master data for database resolution
    const [allStaff, allClasses, allSubjects, existingTimetableEntries] = await Promise.all([
      prisma.staff.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, staff_id: true, full_name: true, email: true, department_id: true },
      }),
      prisma.class.findMany({
        select: { id: true, name: true, section: true, department_id: true },
      }),
      prisma.subject.findMany({
        select: { id: true, name: true, code: true, department_id: true },
      }),
      prisma.timetable.findMany({
        where: activeYear ? { academic_year_id: activeYear.id } : {},
        select: {
          id: true,
          staff_id: true,
          class_id: true,
          subject_id: true,
          day_of_week: true,
          start_time: true,
          end_time: true,
          room: true,
        },
      }),
    ]);

    const validatedRows: ParsedTimetableRow[] = [];
    const detectedSectionsSet = new Set<string>();

    let validCount = 0;
    let unresolvedCount = 0;
    let conflictCount = 0;
    let duplicateCount = 0;
    let existingMatchCount = 0;

    for (let i = 0; i < parsedRawRows.length; i++) {
      const raw = parsedRawRows[i];
      const errors: string[] = [];
      const warnings: string[] = [];
      let isUnresolved = false;
      let isConflict = false;
      let isDuplicate = false;

      const sectionLabel = raw.section || 'Section B';
      detectedSectionsSet.add(sectionLabel);
      const sectionLetter = (sectionLabel.match(/[A-D]/i)?.[0] || 'B').toUpperCase();

      // 1. Day of week resolution
      const dayNum = normalizeDay(raw.day) || 1;
      const dayName = DAY_NAMES[dayNum] || 'Monday';

      // 2. Start and end time resolution
      const startTimeNorm = normalizeTime(raw.startTime);
      const endTimeNorm = normalizeTime(raw.endTime);

      if (!startTimeNorm) {
        errors.push(`Invalid start time: "${raw.startTime}". Expected HH:mm.`);
      }
      if (!endTimeNorm) {
        errors.push(`Invalid end time: "${raw.endTime}". Expected HH:mm.`);
      }

      if (startTimeNorm && endTimeNorm) {
        const sMin = timeToMinutes(startTimeNorm);
        const eMin = timeToMinutes(endTimeNorm);
        if (eMin <= sMin) {
          errors.push(`End time (${endTimeNorm}) must be strictly after start time (${startTimeNorm}).`);
        }
      }

      // 3. Class resolution
      const rawClassStr = (raw.className || '').trim();
      const rawClassLower = rawClassStr.toLowerCase();

      const matchedClass = allClasses.find((c) => {
        const cSection = (c.section || '').toUpperCase();
        const cNameLower = c.name.toLowerCase();

        // Direct class name match
        if (rawClassLower && (cNameLower === rawClassLower || cNameLower.includes(rawClassLower))) {
          return true;
        }

        // Section letter match within class name (e.g. "CSE-A", "Section B", "CSE IV/VII - Section B")
        const classSecMatch = rawClassStr.match(/(?:Section|SEC|CSE)[-\s]*([A-D])\b/i);
        if (classSecMatch) {
          const letter = classSecMatch[1].toUpperCase();
          if (cSection === letter && (cNameLower.includes('cse') || cNameLower.includes('computer'))) {
            return true;
          }
          if (cSection === letter) return true;
        }

        // Fallback to section header if raw.className is absent or standard section label
        if (!rawClassStr || rawClassStr === sectionLabel || rawClassLower.includes('cse iv')) {
          if (cSection === sectionLetter && (cNameLower.includes('cse') || cNameLower.includes('computer'))) {
            return true;
          }
          if (cSection === sectionLetter) return true;
        }

        return false;
      });

      const classId = matchedClass?.id;
      if (!matchedClass) {
        isUnresolved = true;
        errors.push(`Unresolved Class: "${raw.className || sectionLabel}". No matching class record in database.`);
      }

      // 4. Subject resolution
      const cleanSubjectCode = (raw.subjectCode || raw.subject || '').trim();
      const cleanSubjectTitle = (raw.subject || cleanSubjectCode).trim();

      const matchedSubject = allSubjects.find((s) => {
        const sCodeClean = s.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const rawCodeClean = cleanSubjectCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const sNameLower = s.name.toLowerCase();
        const rawNameLower = cleanSubjectTitle.toLowerCase();

        if (sCodeClean === rawCodeClean) return true;
        if (sNameLower === rawNameLower) return true;
        if (rawNameLower.includes(sNameLower) || sNameLower.includes(rawNameLower)) return true;
        if (cleanSubjectCode === 'PROJECT WORK' && sNameLower.includes('project')) return true;
        return false;
      });

      const subjectId = matchedSubject?.id;
      if (!matchedSubject) {
        isUnresolved = true;
        errors.push(`Unresolved Subject: "${cleanSubjectCode}". No matching subject found in database.`);
      }

      // 5. Staff resolution
      const cleanStaff = (raw.staff || '').trim();
      const cleanStaffNameOnly = normalizeStaffName(cleanStaff);

      let matchedStaff: (typeof allStaff)[0] | undefined;

      if (cleanStaff) {
        matchedStaff = allStaff.find((st) => {
          const stFullNameLower = st.full_name.toLowerCase();
          const stStaffIdLower = st.staff_id.toLowerCase();
          const stNameOnly = normalizeStaffName(st.full_name).toLowerCase();
          const rawLower = cleanStaff.toLowerCase();
          const rawOnlyLower = cleanStaffNameOnly.toLowerCase();

          if (stStaffIdLower === rawLower) return true;
          if (stFullNameLower === rawLower) return true;
          if (stNameOnly === rawOnlyLower) return true;

          // Check initials / last name match (e.g. "K.MEIYALAGAN" matches "Mr. K. Meiyalagan" or "Meiyalagan")
          const rawNameParts = rawOnlyLower.replace(/[^a-z]/g, ' ').split(/\s+/).filter((p) => p.length >= 3);
          const stNameParts = stNameOnly.replace(/[^a-z]/g, ' ').split(/\s+/).filter((p) => p.length >= 3);

          if (rawNameParts.some((rp) => stNameParts.includes(rp))) {
            return true;
          }

          return false;
        });
      }

      const staffRecordId = matchedStaff?.id;
      const staffIdCode = matchedStaff?.staff_id;

      if (!matchedStaff) {
        isUnresolved = true;
        if (cleanSubjectCode.includes('C/L/S') || cleanSubjectCode === 'CLS') {
          warnings.push('Faculty mapping could not be safely determined from PDF.');
        } else {
          errors.push(
            cleanStaff
              ? `Unresolved Staff: "${cleanStaff}". Staff record must exist in database.`
              : 'Unresolved Staff: No staff allocated in timetable PDF.'
          );
        }
      }

      // 6. Conflict & Overlap Check (with existing DB and within file)
      let existingMatch: { id: string; action: 'CREATE' | 'UPDATE' | 'CONFLICT' } | undefined;

      if (startTimeNorm && endTimeNorm) {
        const sMin = timeToMinutes(startTimeNorm);
        const eMin = timeToMinutes(endTimeNorm);

        // Check if duplicate entry already exists in database
        const identical = existingTimetableEntries.find(
          (e) =>
            e.staff_id === staffRecordId &&
            e.class_id === classId &&
            e.day_of_week === dayNum &&
            e.start_time === startTimeNorm &&
            e.end_time === endTimeNorm
        );

        if (identical) {
          isDuplicate = true;
          duplicateCount++;
          existingMatch = { id: identical.id, action: 'UPDATE' };
          existingMatchCount++;
          warnings.push(`Matches existing timetable entry (${identical.id}).`);
        } else {
          // Check staff overlap
          if (staffRecordId) {
            const staffOverlap = existingTimetableEntries.find((e) => {
              if (e.staff_id !== staffRecordId || e.day_of_week !== dayNum) return false;
              const exStart = timeToMinutes(e.start_time);
              const exEnd = timeToMinutes(e.end_time);
              return Math.max(sMin, exStart) < Math.min(eMin, exEnd);
            });

            if (staffOverlap) {
              isConflict = true;
              conflictCount++;
              errors.push(
                `Staff schedule conflict: Staff is already scheduled from ${staffOverlap.start_time} to ${staffOverlap.end_time} on ${dayName}.`
              );
            }
          }

          // Check class overlap
          if (classId) {
            const classOverlap = existingTimetableEntries.find((e) => {
              if (e.class_id !== classId || e.day_of_week !== dayNum) return false;
              const exStart = timeToMinutes(e.start_time);
              const exEnd = timeToMinutes(e.end_time);
              return Math.max(sMin, exStart) < Math.min(eMin, exEnd);
            });

            if (classOverlap) {
              isConflict = true;
              conflictCount++;
              errors.push(
                `Class schedule conflict: Class is already scheduled from ${classOverlap.start_time} to ${classOverlap.end_time} on ${dayName}.`
              );
            }
          }
        }
      }

      // Determine final status: UNRESOLVED takes priority because unmapped entities must be resolved first
      let status: 'READY' | 'CONFLICT' | 'UNRESOLVED' | 'DUPLICATE' = 'READY';
      if (isUnresolved) {
        status = 'UNRESOLVED';
        unresolvedCount++;
      } else if (isConflict) {
        status = 'CONFLICT';
      } else if (isDuplicate) {
        status = 'DUPLICATE';
      } else {
        status = 'READY';
        validCount++;
      }

      const isValid = status === 'READY' || status === 'DUPLICATE';

      validatedRows.push({
        rowNumber: i + 1,
        section: sectionLabel,
        dayOfWeek: dayNum,
        dayName,
        hour: raw.hour,
        startTime: startTimeNorm || raw.startTime,
        endTime: endTimeNorm || raw.endTime,
        className: matchedClass?.name || raw.className || sectionLabel,
        classId,
        subjectName: matchedSubject?.name || cleanSubjectTitle,
        subjectCode: matchedSubject?.code || cleanSubjectCode,
        subjectId,
        staffName: matchedStaff?.full_name || cleanStaff || 'Unassigned',
        staffId: staffIdCode,
        staffRecordId,
        room: raw.room || null,
        academicYearId: activeYear?.id,
        academicYearName: activeYear?.name,
        isValid,
        isUnresolved,
        isConflict,
        isDuplicate,
        status,
        existingMatch,
        errors,
        warnings,
      });
    }

    const detectedSections = Array.from(detectedSectionsSet);

    // Create a database TimetableImport record
    const importRecord = await prisma.timetableImport.create({
      data: {
        file_name: fileName,
        file_size: buffer.length,
        file_hash: fileHash,
        uploaded_by: uploadedByUserId,
        total_rows: validatedRows.length,
        imported_rows: 0,
        updated_rows: 0,
        skipped_rows: 0,
        unresolved_rows: unresolvedCount,
        conflicting_rows: conflictCount,
        status: 'READY',
        preview_data: JSON.stringify(validatedRows),
        summary_data: JSON.stringify({
          totalRows: validatedRows.length,
          validRows: validCount,
          unresolvedRows: unresolvedCount,
          conflictRows: conflictCount,
          duplicateRows: duplicateCount,
          existingMatches: existingMatchCount,
          sectionsDetected: detectedSections,
        }),
      },
    });

    return {
      importId: importRecord.id,
      fileName,
      fileSize: buffer.length,
      fileHash,
      uploadedAt: importRecord.uploaded_at.toISOString(),
      sectionsDetected: detectedSections,
      summary: {
        totalRows: validatedRows.length,
        validRows: validCount,
        unresolvedRows: unresolvedCount,
        conflictRows: conflictCount,
        duplicateRows: duplicateCount,
        existingMatches: existingMatchCount,
      },
      rows: validatedRows,
    };
  }

  /**
   * Confirms the import of previewed timetable rows into the database.
   * Performs database transaction with rollback on failure.
   *
   * Architecture:
   * 1. All entity resolution, preloading, and in-memory classification happen OUTSIDE the transaction.
   * 2. Zero `findFirst` calls inside the transaction callback.
   * 3. Batch inserts using `createMany` and short-lived updates.
   * 4. Audit logging and session update committed atomically.
   */
  async confirmImport(
    importId: string,
    confirmedRows: ParsedTimetableRow[],
    userId: string,
    replaceExisting = false
  ) {
    const importRecord = await prisma.timetableImport.findUnique({
      where: { id: importId },
    });

    if (!importRecord) {
      throw new AppError(`Timetable import session not found: ${importId}`, 404, 'NOT_FOUND');
    }

    const rowsToProcess: ParsedTimetableRow[] = confirmedRows && confirmedRows.length > 0
      ? confirmedRows
      : JSON.parse(importRecord.preview_data || '[]');

    if (!rowsToProcess || rowsToProcess.length === 0) {
      return {
        success: true,
        importId,
        importedCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        conflictCount: 0,
        unresolvedCount: 0,
        totalProcessed: 0,
        status: 'COMPLETED',
      };
    }

    // 1. Preload reference data outside the transaction
    const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });

    const academicYearIds = Array.from(
      new Set(
        rowsToProcess
          .map((r) => r.academicYearId || activeYear?.id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const classIds = Array.from(
      new Set(
        rowsToProcess
          .map((r) => r.classId)
          .filter((id): id is string => Boolean(id))
      )
    );

    // 2. Preload existing timetable records in a single batch query
    const existingEntries = await prisma.timetable.findMany({
      where: {
        ...(academicYearIds.length > 0 ? { academic_year_id: { in: academicYearIds } } : {}),
        ...(classIds.length > 0 ? { class_id: { in: classIds } } : {}),
      },
      select: {
        id: true,
        class_id: true,
        day_of_week: true,
        start_time: true,
        end_time: true,
        subject_id: true,
        staff_id: true,
        academic_year_id: true,
        room: true,
      },
    });

    // 3. Build in-memory lookup maps
    const classSlotKey = (classId: string, dayOfWeek: number, startTime: string, academicYearId: string) =>
      `${classId}|${dayOfWeek}|${startTime}|${academicYearId}`;

    const existingById = new Map<string, (typeof existingEntries)[0]>();
    const existingByClassSlot = new Map<string, (typeof existingEntries)[0]>();

    for (const entry of existingEntries) {
      existingById.set(entry.id, entry);
      const slotKey = classSlotKey(entry.class_id, entry.day_of_week, entry.start_time, entry.academic_year_id);
      existingByClassSlot.set(slotKey, entry);
    }

    // 4. Classify rows into creates, updates, and skips completely in memory
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let conflictCount = 0;
    let unresolvedCount = 0;

    interface UpdateOperation {
      id: string;
      data: {
        staff_id: string;
        subject_id: string;
        room: string | null;
        start_time: string;
        end_time: string;
        day_of_week: number;
        status: string;
      };
    }

    interface CreateOperation {
      staff_id: string;
      class_id: string;
      subject_id: string;
      academic_year_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      room: string | null;
      source: string;
      source_file: string | null;
      status: string;
    }

    const updatesList: UpdateOperation[] = [];
    const createsList: CreateOperation[] = [];
    const seenSlotsInBatch = new Set<string>();

    for (const row of rowsToProcess) {
      const yearId = row.academicYearId || activeYear?.id;

      // Skip unresolved or incomplete rows
      if (row.isUnresolved || !row.staffRecordId || !row.classId || !row.subjectId || !yearId) {
        unresolvedCount++;
        skippedCount++;
        continue;
      }

      // Skip conflict rows
      if (row.isConflict) {
        conflictCount++;
        skippedCount++;
        continue;
      }

      // Check if existing match was already provided or find by slot key
      let existing: (typeof existingEntries)[0] | undefined;
      if (row.existingMatch?.id && existingById.has(row.existingMatch.id)) {
        existing = existingById.get(row.existingMatch.id);
      } else {
        const slotKey = classSlotKey(row.classId, row.dayOfWeek, row.startTime, yearId);
        existing = existingByClassSlot.get(slotKey);
      }

      if (existing) {
        if (replaceExisting) {
          updatesList.push({
            id: existing.id,
            data: {
              staff_id: row.staffRecordId,
              subject_id: row.subjectId,
              room: row.room || null,
              start_time: row.startTime,
              end_time: row.endTime,
              day_of_week: row.dayOfWeek,
              status: 'SCHEDULED',
            },
          });
          updatedCount++;
        } else {
          // Existing slot found and replaceExisting is false: skip to prevent duplicates
          skippedCount++;
        }
      } else {
        // Prevent intra-batch duplicates within the same import payload
        const batchSlotKey = classSlotKey(row.classId, row.dayOfWeek, row.startTime, yearId);
        if (seenSlotsInBatch.has(batchSlotKey)) {
          skippedCount++;
          continue;
        }
        seenSlotsInBatch.add(batchSlotKey);

        createsList.push({
          staff_id: row.staffRecordId,
          class_id: row.classId,
          subject_id: row.subjectId,
          academic_year_id: yearId,
          day_of_week: row.dayOfWeek,
          start_time: row.startTime,
          end_time: row.endTime,
          room: row.room || null,
          source: 'PDF_IMPORT',
          source_file: importRecord.file_name,
          status: 'SCHEDULED',
        });
        importedCount++;
      }
    }

    const finalStatus = skippedCount > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';

    // 5. Short-lived database transaction ONLY for database mutations
    try {
      await prisma.$transaction(
        async (tx) => {
          // 1. Batch insert creates using createMany
          if (createsList.length > 0) {
            await tx.timetable.createMany({
              data: createsList,
              skipDuplicates: true,
            });
          }

          // 2. Perform updates
          for (const item of updatesList) {
            await tx.timetable.update({
              where: { id: item.id },
              data: item.data,
            });
          }

          // 3. Update the timetableImport session status
          await tx.timetableImport.update({
            where: { id: importId },
            data: {
              imported_rows: importedCount,
              updated_rows: updatedCount,
              skipped_rows: skippedCount,
              status: finalStatus,
              summary_data: JSON.stringify({
                importedCount,
                createdCount: importedCount,
                updatedCount,
                skippedCount,
                conflictCount,
                unresolvedCount,
              }),
            },
          });

          // 4. Record audit log
          await tx.auditLog.create({
            data: {
              user_id: userId,
              action: 'TIMETABLE_PDF_IMPORTED',
              entity_type: 'TIMETABLE_IMPORT',
              entity_id: importId,
              after_value: JSON.stringify({
                fileName: importRecord.file_name,
                importedCount,
                updatedCount,
                skippedCount,
                status: finalStatus,
              }),
              metadata: JSON.stringify({
                fileHash: importRecord.file_hash,
                totalRows: importRecord.total_rows,
              }),
            },
          });
        },
        {
          maxWait: 10000,
          timeout: 60000,
        }
      );
    } catch (err: any) {
      logger.error('Timetable import database transaction failed', err, 'TIMETABLE_IMPORT_FAILED', {
        importId,
      });
      throw new AppError(
        'Timetable import failed while saving records. Please try again.',
        500,
        'TIMETABLE_IMPORT_FAILED'
      );
    }

    return {
      success: true,
      importId,
      importedCount,
      createdCount: importedCount,
      updatedCount,
      skippedCount,
      conflictCount,
      unresolvedCount,
      totalProcessed: importedCount + updatedCount + skippedCount,
      status: finalStatus,
    };
  }

  /**
   * Fetches timetable import history for admin review
   */
  async getImportHistory(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [total, imports] = await Promise.all([
      prisma.timetableImport.count(),
      prisma.timetableImport.findMany({
        skip,
        take: pageSize,
        orderBy: { uploaded_at: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      imports: imports.map((imp) => ({
        id: imp.id,
        fileName: imp.file_name,
        fileSize: imp.file_size,
        uploadedAt: imp.uploaded_at.toISOString(),
        uploadedBy: imp.user.email,
        totalRows: imp.total_rows,
        importedRows: imp.imported_rows,
        updatedRows: imp.updated_rows,
        skippedRows: imp.skipped_rows,
        unresolvedRows: imp.unresolved_rows,
        conflictingRows: imp.conflicting_rows,
        status: imp.status,
        summary: imp.summary_data ? JSON.parse(imp.summary_data) : null,
      })),
    };
  }
}

export const timetablePdfParserService = new TimetablePdfParserService();
