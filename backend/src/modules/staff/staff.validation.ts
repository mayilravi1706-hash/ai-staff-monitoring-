import { z } from 'zod';

export const createStaffSchema = z.object({
  email: z.string().email('Invalid email address format'),
  staff_id: z.string().min(2, 'Staff ID must be at least 2 characters').max(30),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  department_id: z.string().min(1, 'Department ID is required'),
  designation: z.string().min(2, 'Designation is required'),
  role: z.enum(['ADMIN', 'STAFF', 'SUPER_ADMIN', 'HOD', 'DEPARTMENT_ADMIN']).default('STAFF'),
  qualification: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  joining_date: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
  experience: z.coerce.number().int().min(0).optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  profile_photo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
});

export const updateStaffSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  staff_id: z.string().min(2).max(30).optional(),
  department_id: z.string().min(1).optional(),
  designation: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'STAFF', 'SUPER_ADMIN', 'HOD', 'DEPARTMENT_ADMIN']).optional(),
  qualification: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  experience: z.coerce.number().int().min(0).optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  profile_photo: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const staffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  department_id: z.string().optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  sort: z.enum(['staff_id', 'full_name', 'email', 'designation', 'created_at', 'status']).default('full_name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});
