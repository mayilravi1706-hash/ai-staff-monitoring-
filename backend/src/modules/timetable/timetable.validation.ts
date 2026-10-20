import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

export const createTimetableSchema = z
  .object({
    staff_id: z.string().min(1, 'Staff ID is required'),
    class_id: z.string().min(1, 'Class ID is required'),
    subject_id: z.string().min(1, 'Subject ID is required'),
    academic_year_id: z.string().min(1, 'Academic Year ID is required'),
    day_of_week: z.coerce.number().int().min(1, 'Day must be between 1 and 7').max(7, 'Day must be between 1 and 7'),
    start_time: z.string().regex(timeRegex, 'Start time must be in HH:MM format (24-hour)'),
    end_time: z.string().regex(timeRegex, 'End time must be in HH:MM format (24-hour)'),
    room: z.string().max(50).optional().nullable(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).default('SCHEDULED'),
  })
  .refine((data) => timeToMinutes(data.end_time) > timeToMinutes(data.start_time), {
    message: 'End time must be strictly after start time',
    path: ['end_time'],
  });

export const updateTimetableSchema = z
  .object({
    staff_id: z.string().min(1).optional(),
    class_id: z.string().min(1).optional(),
    subject_id: z.string().min(1).optional(),
    academic_year_id: z.string().min(1).optional(),
    day_of_week: z.coerce.number().int().min(1).max(7).optional(),
    start_time: z.string().regex(timeRegex, 'Start time must be in HH:MM format (24-hour)').optional(),
    end_time: z.string().regex(timeRegex, 'End time must be in HH:MM format (24-hour)').optional(),
    room: z.string().max(50).optional().nullable(),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
  })
  .refine(
    (data) => {
      if (data.start_time && data.end_time) {
        return timeToMinutes(data.end_time) > timeToMinutes(data.start_time);
      }
      return true;
    },
    {
      message: 'End time must be strictly after start time',
      path: ['end_time'],
    }
  );

export const timetableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  staff_id: z.string().optional(),
  staffId: z.string().optional(),
  department_id: z.string().optional(),
  class_id: z.string().optional(),
  subject_id: z.string().optional(),
  academic_year_id: z.string().optional(),
  day_of_week: z.coerce.number().int().min(1).max(7).optional(),
});
