import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditLog } from '../../utils/auditLogger';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentQuerySchema,
  createClassSchema,
  updateClassSchema,
  classQuerySchema,
  createSubjectSchema,
  updateSubjectSchema,
  subjectQuerySchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  academicYearQuerySchema,
} from './academics.validation';

export class AcademicsController {
  // ==========================================
  // 1. DEPARTMENTS
  // ==========================================

  async getDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const query = departmentQuerySchema.parse(req.query);
      const { page, pageSize, search, status } = query;

      const where: any = {};
      if (search && search.trim()) {
        const s = search.trim();
        where.OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { code: { contains: s, mode: 'insensitive' } },
        ];
      }
      if (status) {
        where.status = status;
      }

      const total = await prisma.department.count({ where });

      const departments = await prisma.department.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { staff: true, subjects: true, classes: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: departments,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDepartmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const department = await prisma.department.findFirst({
        where: { OR: [{ id }, { code: id.toUpperCase() }] },
        include: {
          _count: {
            select: { staff: true, subjects: true, classes: true },
          },
        },
      });

      if (!department) {
        throw new AppError(`Department not found: ${id}`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, data: department });
    } catch (error) {
      next(error);
    }
  }

  async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = createDepartmentSchema.parse(req.body);

      // Check duplicate code
      const existing = await prisma.department.findUnique({
        where: { code: data.code },
      });
      if (existing) {
        throw new AppError(`Department code '${data.code}' already exists.`, 400, 'DUPLICATE_DEPARTMENT_CODE');
      }

      const department = await prisma.department.create({
        data: {
          name: data.name,
          code: data.code,
          status: data.status,
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'DEPARTMENT_CREATED',
        entityType: 'DEPARTMENT',
        entityId: department.id,
        afterValue: { name: department.name, code: department.code },
      });

      res.status(201).json({
        success: true,
        message: 'Department created successfully.',
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = updateDepartmentSchema.parse(req.body);

      const existing = await prisma.department.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(`Department not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (data.code && data.code !== existing.code) {
        const duplicate = await prisma.department.findUnique({ where: { code: data.code } });
        if (duplicate && duplicate.id !== id) {
          throw new AppError(`Department code '${data.code}' already in use.`, 400, 'DUPLICATE_DEPARTMENT_CODE');
        }
      }

      const updated = await prisma.department.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.code && { code: data.code }),
          ...(data.status && { status: data.status }),
        },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'DEPARTMENT',
        entityId: updated.id,
        beforeValue: { name: existing.name, code: existing.code, status: existing.status },
        afterValue: { name: updated.name, code: updated.code, status: updated.status },
      });

      res.status(200).json({
        success: true,
        message: 'Department updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const existing = await prisma.department.findUnique({
        where: { id },
        include: {
          _count: {
            select: { staff: true, classes: true, subjects: true },
          },
        },
      });

      if (!existing) {
        throw new AppError(`Department not found: ${id}`, 404, 'NOT_FOUND');
      }

      const totalAssociated = existing._count.staff + existing._count.classes + existing._count.subjects;
      if (totalAssociated > 0) {
        throw new AppError(
          `Cannot delete department with associated records (${existing._count.staff} staff, ${existing._count.classes} classes, ${existing._count.subjects} subjects). Deactivate the department instead.`,
          400,
          'CANNOT_DELETE_ASSOCIATED_RECORDS'
        );
      }

      await prisma.department.delete({ where: { id } });

      await recordAuditLog({
        userId: user.id,
        action: 'DEPARTMENT_DELETED',
        entityType: 'DEPARTMENT',
        entityId: id,
        beforeValue: { name: existing.name, code: existing.code },
      });

      res.status(200).json({
        success: true,
        message: 'Department deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 2. CLASSES
  // ==========================================

  async getClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const query = classQuerySchema.parse(req.query);
      const { page, pageSize, search, department_id, academic_year_id, status } = query;

      const where: any = {};
      if (search && search.trim()) {
        const s = search.trim();
        where.name = { contains: s, mode: 'insensitive' };
      }
      if (department_id) where.department_id = department_id;
      if (academic_year_id) where.academic_year_id = academic_year_id;
      if (status) where.status = status;

      const total = await prisma.class.count({ where });

      const classes = await prisma.class.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ department_id: 'asc' }, { name: 'asc' }],
        include: {
          department: true,
          academic_year: true,
          _count: {
            select: { timetable: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: classes,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getClassById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const classRecord = await prisma.class.findUnique({
        where: { id },
        include: {
          department: true,
          academic_year: true,
          _count: {
            select: { timetable: true },
          },
        },
      });

      if (!classRecord) {
        throw new AppError(`Class not found: ${id}`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, data: classRecord });
    } catch (error) {
      next(error);
    }
  }

  async createClass(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = createClassSchema.parse(req.body);

      // Verify department and academic year exist
      const [dept, year] = await Promise.all([
        prisma.department.findUnique({ where: { id: data.department_id } }),
        prisma.academicYear.findUnique({ where: { id: data.academic_year_id } }),
      ]);

      if (!dept) throw new AppError(`Department not found: ${data.department_id}`, 400, 'INVALID_DEPARTMENT');
      if (!year) throw new AppError(`Academic Year not found: ${data.academic_year_id}`, 400, 'INVALID_ACADEMIC_YEAR');

      // Prevent duplicate class in same department and academic year
      const duplicate = await prisma.class.findFirst({
        where: {
          name: data.name,
          department_id: data.department_id,
          academic_year_id: data.academic_year_id,
          ...(data.section ? { section: data.section } : {}),
        },
      });
      if (duplicate) {
        throw new AppError(
          `Class '${data.name}' already exists in this department for the specified academic year.`,
          400,
          'DUPLICATE_CLASS'
        );
      }

      const created = await prisma.class.create({
        data: {
          name: data.name,
          section: data.section || null,
          department_id: data.department_id,
          academic_year_id: data.academic_year_id,
          status: data.status,
        },
        include: { department: true, academic_year: true },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'CLASS_CREATED',
        entityType: 'CLASS',
        entityId: created.id,
        afterValue: { name: created.name, department_id: created.department_id },
      });

      res.status(201).json({
        success: true,
        message: 'Class created successfully.',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateClass(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = updateClassSchema.parse(req.body);

      const existing = await prisma.class.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(`Class not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (data.department_id && data.department_id !== existing.department_id) {
        const dept = await prisma.department.findUnique({ where: { id: data.department_id } });
        if (!dept) throw new AppError(`Department not found: ${data.department_id}`, 400, 'INVALID_DEPARTMENT');
      }

      if (data.academic_year_id && data.academic_year_id !== existing.academic_year_id) {
        const year = await prisma.academicYear.findUnique({ where: { id: data.academic_year_id } });
        if (!year) throw new AppError(`Academic Year not found: ${data.academic_year_id}`, 400, 'INVALID_ACADEMIC_YEAR');
      }

      const updated = await prisma.class.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.section !== undefined && { section: data.section }),
          ...(data.department_id && { department_id: data.department_id }),
          ...(data.academic_year_id && { academic_year_id: data.academic_year_id }),
          ...(data.status && { status: data.status }),
        },
        include: { department: true, academic_year: true },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'CLASS_UPDATED',
        entityType: 'CLASS',
        entityId: updated.id,
        beforeValue: { name: existing.name, status: existing.status },
        afterValue: { name: updated.name, status: updated.status },
      });

      res.status(200).json({
        success: true,
        message: 'Class updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteClass(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const existing = await prisma.class.findUnique({
        where: { id },
        include: {
          _count: {
            select: { timetable: true, activities: true },
          },
        },
      });

      if (!existing) {
        throw new AppError(`Class not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (existing._count.timetable + existing._count.activities > 0) {
        // Safe deactivate
        await prisma.class.update({
          where: { id },
          data: { status: 'INACTIVE' },
        });

        await recordAuditLog({
          userId: user.id,
          action: 'CLASS_DEACTIVATED',
          entityType: 'CLASS',
          entityId: id,
          metadata: { reason: 'Historical timetable records preserved' },
        });

        return res.status(200).json({
          success: true,
          message: 'Class deactivated to preserve timetable history.',
          deactivated: true,
        });
      }

      await prisma.class.delete({ where: { id } });

      await recordAuditLog({
        userId: user.id,
        action: 'CLASS_DELETED',
        entityType: 'CLASS',
        entityId: id,
      });

      res.status(200).json({
        success: true,
        message: 'Class deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 3. SUBJECTS
  // ==========================================

  async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const query = subjectQuerySchema.parse(req.query);
      const { page, pageSize, search, department_id, status } = query;

      const where: any = {};
      if (search && search.trim()) {
        const s = search.trim();
        where.OR = [
          { name: { contains: s, mode: 'insensitive' } },
          { code: { contains: s, mode: 'insensitive' } },
        ];
      }
      if (department_id) where.department_id = department_id;
      if (status) where.status = status;

      const total = await prisma.subject.count({ where });

      const subjects = await prisma.subject.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: 'asc' },
        include: {
          department: true,
          _count: {
            select: { timetable: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: subjects,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSubjectById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const subject = await prisma.subject.findFirst({
        where: { OR: [{ id }, { code: id.toUpperCase() }] },
        include: {
          department: true,
          _count: {
            select: { timetable: true },
          },
        },
      });

      if (!subject) {
        throw new AppError(`Subject not found: ${id}`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, data: subject });
    } catch (error) {
      next(error);
    }
  }

  async createSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = createSubjectSchema.parse(req.body);

      // Verify department
      const dept = await prisma.department.findUnique({ where: { id: data.department_id } });
      if (!dept) throw new AppError(`Department not found: ${data.department_id}`, 400, 'INVALID_DEPARTMENT');

      // Unique code check
      const duplicate = await prisma.subject.findUnique({ where: { code: data.code } });
      if (duplicate) {
        throw new AppError(`Subject code '${data.code}' already exists.`, 400, 'DUPLICATE_SUBJECT_CODE');
      }

      const created = await prisma.subject.create({
        data: {
          name: data.name,
          code: data.code,
          department_id: data.department_id,
          status: data.status,
        },
        include: { department: true },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'SUBJECT_CREATED',
        entityType: 'SUBJECT',
        entityId: created.id,
        afterValue: { name: created.name, code: created.code },
      });

      res.status(201).json({
        success: true,
        message: 'Subject created successfully.',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = updateSubjectSchema.parse(req.body);

      const existing = await prisma.subject.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(`Subject not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (data.code && data.code !== existing.code) {
        const duplicate = await prisma.subject.findUnique({ where: { code: data.code } });
        if (duplicate && duplicate.id !== id) {
          throw new AppError(`Subject code '${data.code}' already exists.`, 400, 'DUPLICATE_SUBJECT_CODE');
        }
      }

      if (data.department_id && data.department_id !== existing.department_id) {
        const dept = await prisma.department.findUnique({ where: { id: data.department_id } });
        if (!dept) throw new AppError(`Department not found: ${data.department_id}`, 400, 'INVALID_DEPARTMENT');
      }

      const updated = await prisma.subject.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.code && { code: data.code }),
          ...(data.department_id && { department_id: data.department_id }),
          ...(data.status && { status: data.status }),
        },
        include: { department: true },
      });

      await recordAuditLog({
        userId: user.id,
        action: 'SUBJECT_UPDATED',
        entityType: 'SUBJECT',
        entityId: updated.id,
        beforeValue: { code: existing.code, name: existing.name },
        afterValue: { code: updated.code, name: updated.name },
      });

      res.status(200).json({
        success: true,
        message: 'Subject updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteSubject(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const existing = await prisma.subject.findUnique({
        where: { id },
        include: {
          _count: {
            select: { timetable: true, activities: true },
          },
        },
      });

      if (!existing) {
        throw new AppError(`Subject not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (existing._count.timetable + existing._count.activities > 0) {
        await prisma.subject.update({
          where: { id },
          data: { status: 'INACTIVE' },
        });

        await recordAuditLog({
          userId: user.id,
          action: 'SUBJECT_DEACTIVATED',
          entityType: 'SUBJECT',
          entityId: id,
          metadata: { reason: 'Historical timetable records preserved' },
        });

        return res.status(200).json({
          success: true,
          message: 'Subject deactivated to preserve timetable history.',
          deactivated: true,
        });
      }

      await prisma.subject.delete({ where: { id } });

      await recordAuditLog({
        userId: user.id,
        action: 'SUBJECT_DELETED',
        entityType: 'SUBJECT',
        entityId: id,
      });

      res.status(200).json({
        success: true,
        message: 'Subject deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 4. ACADEMIC YEARS
  // ==========================================

  async getAcademicYears(req: Request, res: Response, next: NextFunction) {
    try {
      const query = academicYearQuerySchema.parse(req.query);
      const { page, pageSize, search } = query;

      const where: any = {};
      if (search && search.trim()) {
        where.name = { contains: search.trim(), mode: 'insensitive' };
      }

      const total = await prisma.academicYear.count({ where });

      const academicYears = await prisma.academicYear.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { start_date: 'desc' },
        include: {
          _count: {
            select: { classes: true, timetable: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        data: academicYears,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAcademicYearById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const year = await prisma.academicYear.findUnique({
        where: { id },
        include: {
          _count: {
            select: { classes: true, timetable: true },
          },
        },
      });

      if (!year) {
        throw new AppError(`Academic Year not found: ${id}`, 404, 'NOT_FOUND');
      }

      res.status(200).json({ success: true, data: year });
    } catch (error) {
      next(error);
    }
  }

  async createAcademicYear(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const data = createAcademicYearSchema.parse(req.body);

      // Transactional activation if active is true
      const created = await prisma.$transaction(async (tx) => {
        if (data.active) {
          // Deactivate all existing academic years
          await tx.academicYear.updateMany({
            where: { active: true },
            data: { active: false },
          });
        }

        return tx.academicYear.create({
          data: {
            name: data.name,
            start_date: data.start_date,
            end_date: data.end_date,
            active: data.active,
          },
        });
      });

      await recordAuditLog({
        userId: user.id,
        action: data.active ? 'ACADEMIC_YEAR_ACTIVATED' : 'ACADEMIC_YEAR_CREATED',
        entityType: 'ACADEMIC_YEAR',
        entityId: created.id,
        afterValue: { name: created.name, active: created.active },
      });

      res.status(201).json({
        success: true,
        message: 'Academic Year created successfully.',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAcademicYear(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;
      const data = updateAcademicYearSchema.parse(req.body);

      const existing = await prisma.academicYear.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(`Academic Year not found: ${id}`, 404, 'NOT_FOUND');
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (data.active === true) {
          // Deactivate all others transactionally
          await tx.academicYear.updateMany({
            where: { id: { not: id }, active: true },
            data: { active: false },
          });
        }

        return tx.academicYear.update({
          where: { id },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.start_date && { start_date: data.start_date }),
            ...(data.end_date && { end_date: data.end_date }),
            ...(data.active !== undefined && { active: data.active }),
          },
        });
      });

      await recordAuditLog({
        userId: user.id,
        action: data.active && !existing.active ? 'ACADEMIC_YEAR_ACTIVATED' : 'ACADEMIC_YEAR_UPDATED',
        entityType: 'ACADEMIC_YEAR',
        entityId: updated.id,
        beforeValue: { name: existing.name, active: existing.active },
        afterValue: { name: updated.name, active: updated.active },
      });

      res.status(200).json({
        success: true,
        message: 'Academic Year updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAcademicYear(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const { id } = req.params;

      const existing = await prisma.academicYear.findUnique({
        where: { id },
        include: {
          _count: {
            select: { classes: true, timetable: true },
          },
        },
      });

      if (!existing) {
        throw new AppError(`Academic Year not found: ${id}`, 404, 'NOT_FOUND');
      }

      if (existing._count.classes + existing._count.timetable > 0) {
        throw new AppError(
          `Cannot delete Academic Year with associated classes (${existing._count.classes}) or timetable records (${existing._count.timetable}). Set it to inactive instead.`,
          400,
          'CANNOT_DELETE_ASSOCIATED_RECORDS'
        );
      }

      await prisma.academicYear.delete({ where: { id } });

      await recordAuditLog({
        userId: user.id,
        action: 'ACADEMIC_YEAR_DELETED',
        entityType: 'ACADEMIC_YEAR',
        entityId: id,
      });

      res.status(200).json({
        success: true,
        message: 'Academic Year deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const academicsController = new AcademicsController();
