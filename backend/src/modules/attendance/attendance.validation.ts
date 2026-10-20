import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';

export const createAttendanceSchema = z.object({
  staff_id: z.string().optional(),
  attendance_date: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid ISO attendance_date',
    }),
  status: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val.trim().toUpperCase().replace(/\s+/g, '_');
      }
      return val;
    },
    z.nativeEnum(AttendanceStatus, {
      errorMap: () => ({
        message: 'Invalid attendance status. Allowed: PRESENT, ABSENT, HALF_DAY, LEAVE, PERMISSION',
      }),
    })
  ),
  remarks: z.string().max(500).optional().nullable(),
});

export const updateAttendanceSchema = z.object({
  status: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.trim().toUpperCase().replace(/\s+/g, '_') : val),
      z.nativeEnum(AttendanceStatus).optional()
    ),
  remarks: z.string().max(500).optional().nullable(),
});

export const attendanceQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    staffId: z.string().optional(),
    staff_id: z.string().optional(),
    status: z.string().optional(),
    startDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Invalid ISO startDate' }),
    endDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Invalid ISO endDate' }),
    date: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Invalid ISO date' }),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate cannot be after endDate',
      path: ['startDate'],
    }
  );
