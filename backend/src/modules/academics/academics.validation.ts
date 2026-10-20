import { z } from 'zod';

// Department schemas
export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters').max(100),
  code: z.string().min(2, 'Department code must be at least 2 characters').max(20).toUpperCase(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).toUpperCase().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const departmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
});

// Class schemas
export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(50),
  section: z.string().max(20).optional().nullable(),
  department_id: z.string().min(1, 'Department ID is required'),
  academic_year_id: z.string().min(1, 'Academic Year ID is required'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  section: z.string().max(20).optional().nullable(),
  department_id: z.string().min(1).optional(),
  academic_year_id: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const classQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  department_id: z.string().optional(),
  academic_year_id: z.string().optional(),
  status: z.string().optional(),
});

// Subject schemas
export const createSubjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required').max(100),
  code: z.string().min(2, 'Subject code is required').max(20).toUpperCase(),
  department_id: z.string().min(1, 'Department ID is required'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).toUpperCase().optional(),
  department_id: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const subjectQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  department_id: z.string().optional(),
  status: z.string().optional(),
});

// Academic Year schemas
export const createAcademicYearSchema = z
  .object({
    name: z.string().min(4, 'Academic year name required (e.g. 2025-2026)').max(50),
    start_date: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
    end_date: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
    active: z.boolean().default(false),
  })
  .refine((data) => data.end_date > data.start_date, {
    message: 'End date must be strictly after start date',
    path: ['end_date'],
  });

export const updateAcademicYearSchema = z
  .object({
    name: z.string().min(4).max(50).optional(),
    start_date: z.union([z.string(), z.date()]).transform((val) => new Date(val)).optional(),
    end_date: z.union([z.string(), z.date()]).transform((val) => new Date(val)).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date > data.start_date;
      }
      return true;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['end_date'],
    }
  );

export const academicYearQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
