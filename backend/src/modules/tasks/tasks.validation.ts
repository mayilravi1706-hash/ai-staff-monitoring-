import { z } from 'zod';
import { TaskPriority, TaskStatus } from '@prisma/client';

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Task title is required.' })
    .min(3, 'Title must be at least 3 characters long.')
    .max(200, 'Title cannot exceed 200 characters.'),
  description: z
    .string()
    .max(2000, 'Description cannot exceed 2000 characters.')
    .optional()
    .nullable(),
  assigned_staff_id: z
    .string({ required_error: 'Assignee staff is required.' })
    .min(1, 'Assignee staff ID is required.'),
  due_date: z
    .string({ required_error: 'Due date is required.' })
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid due date format. Must be an ISO date string.',
    }),
  priority: z
    .nativeEnum(TaskPriority)
    .optional()
    .default(TaskPriority.MEDIUM),
  category: z
    .string()
    .max(100, 'Category cannot exceed 100 characters.')
    .optional()
    .nullable(),
  remarks: z
    .string()
    .max(1000, 'Remarks cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters long.')
    .max(200, 'Title cannot exceed 200 characters.')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description cannot exceed 2000 characters.')
    .optional()
    .nullable(),
  assigned_staff_id: z
    .string()
    .min(1, 'Assignee staff ID cannot be empty.')
    .optional(),
  due_date: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid due date format.',
    })
    .optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z
    .string()
    .max(100, 'Category cannot exceed 100 characters.')
    .optional()
    .nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
  remarks: z
    .string()
    .max(1000, 'Remarks cannot exceed 1000 characters.')
    .optional()
    .nullable(),
});

export const createTaskUpdateSchema = z.object({
  remarks: z
    .string({ required_error: 'Update note/comment is required.' })
    .min(1, 'Update remarks cannot be empty.')
    .max(2000, 'Remarks cannot exceed 2000 characters.'),
  new_status: z.nativeEnum(TaskStatus).optional(),
});
