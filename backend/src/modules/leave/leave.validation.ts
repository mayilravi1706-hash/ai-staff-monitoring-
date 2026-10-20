import { z } from 'zod';
import { LeaveStatus } from '@prisma/client';

export const createLeaveSchema = z
  .object({
    leave_type: z
      .string({ required_error: 'Leave type is required.' })
      .min(2, 'Leave type must be at least 2 characters.')
      .max(50, 'Leave type cannot exceed 50 characters.'),
    start_date: z
      .string({ required_error: 'Start date is required.' })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid start date format. Must be an ISO date string.',
      }),
    end_date: z
      .string({ required_error: 'End date is required.' })
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid end date format. Must be an ISO date string.',
      }),
    reason: z
      .string({ required_error: 'Reason for leave is required.' })
      .min(3, 'Reason must be at least 3 characters long.')
      .max(1000, 'Reason cannot exceed 1000 characters.'),
    staff_id: z.string().optional(), // Allowed only for admins creating on behalf
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return end.getTime() >= start.getTime();
    },
    {
      message: 'End date cannot be earlier than start date.',
      path: ['end_date'],
    }
  );

export const updateLeaveSchema = z
  .object({
    leave_type: z
      .string()
      .min(2, 'Leave type must be at least 2 characters.')
      .max(50, 'Leave type cannot exceed 50 characters.')
      .optional(),
    start_date: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid start date format.',
      })
      .optional(),
    end_date: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid end date format.',
      })
      .optional(),
    reason: z
      .string()
      .min(3, 'Reason must be at least 3 characters long.')
      .max(1000, 'Reason cannot exceed 1000 characters.')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.end_date).getTime() >= new Date(data.start_date).getTime();
      }
      return true;
    },
    {
      message: 'End date cannot be earlier than start date.',
      path: ['end_date'],
    }
  );

export const approveLeaveSchema = z.object({
  remarks: z
    .string()
    .max(1000, 'Remarks cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});

export const rejectLeaveSchema = z.object({
  remarks: z
    .string({ required_error: 'Rejection reason is required.' })
    .min(3, 'Rejection reason must be at least 3 characters long.')
    .max(1000, 'Rejection reason cannot exceed 1000 characters.'),
});

export const cancelLeaveSchema = z.object({
  remarks: z
    .string()
    .max(1000, 'Remarks cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});
