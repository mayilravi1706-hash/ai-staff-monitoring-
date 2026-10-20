import { z } from 'zod';
import { ActivityStatus } from '@prisma/client';

export const createActivitySchema = z
  .object({
    staff_id: z.string().optional(),
    activity_status: z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          // Normalize e.g. "Teaching" -> "TEACHING", "Preparing Class" -> "PREPARING_CLASS"
          const normalized = val.trim().toUpperCase().replace(/\s+/g, '_');
          return normalized;
        }
        return val;
      },
      z.nativeEnum(ActivityStatus, {
        errorMap: () => ({
          message:
            'Invalid activity status. Allowed: TEACHING, MEETING, PREPARING_CLASS, ADMINISTRATIVE_WORK, AVAILABLE, BREAK, LEAVE',
        }),
      })
    ),
    description: z.string().max(500).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    title: z.string().max(200).optional().nullable(),
    timetable_id: z.string().optional().nullable(),
    class_id: z.string().optional().nullable(),
    subject_id: z.string().optional().nullable(),
    room: z.string().max(50).optional().nullable(),
    duration_minutes: z.coerce.number().int().min(5).max(480).optional(),
    start_time: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid ISO start_time timestamp',
      }),
    expected_end_time: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid ISO expected_end_time timestamp',
      }),
  })
  .refine(
    (data) => {
      if (data.start_time && data.expected_end_time) {
        return new Date(data.expected_end_time).getTime() > new Date(data.start_time).getTime();
      }
      return true;
    },
    {
      message: 'Expected end time must be after start time',
      path: ['expected_end_time'],
    }
  );

export const updateActivitySchema = z
  .object({
    activity_status: z
      .preprocess(
        (val) => (typeof val === 'string' ? val.trim().toUpperCase().replace(/\s+/g, '_') : val),
        z.nativeEnum(ActivityStatus).optional()
      ),
    description: z.string().max(500).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    room: z.string().max(50).optional().nullable(),
    actual_end_time: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid ISO actual_end_time timestamp',
      }),
    expected_end_time: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid ISO expected_end_time timestamp',
      }),
  });

export const activityQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    staffId: z.string().optional(),
    staff_id: z.string().optional(),
    status: z.string().optional(),
    activity_status: z.string().optional(),
    startDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Invalid ISO startDate' }),
    endDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), { message: 'Invalid ISO endDate' }),
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
