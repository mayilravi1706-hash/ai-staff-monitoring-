import { Router } from 'express';
import { academicsController } from './academics.controller';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

// 1. Department Routes
export const departmentRoutes = Router();
departmentRoutes.use(requireAuth);
departmentRoutes.get('/', (req, res, next) => academicsController.getDepartments(req, res, next));
departmentRoutes.get('/:id', (req, res, next) => academicsController.getDepartmentById(req, res, next));
departmentRoutes.post('/', requireAdmin, (req, res, next) => academicsController.createDepartment(req, res, next));
departmentRoutes.patch('/:id', requireAdmin, (req, res, next) => academicsController.updateDepartment(req, res, next));
departmentRoutes.put('/:id', requireAdmin, (req, res, next) => academicsController.updateDepartment(req, res, next));
departmentRoutes.delete('/:id', requireAdmin, (req, res, next) => academicsController.deleteDepartment(req, res, next));

// 2. Class Routes
export const classRoutes = Router();
classRoutes.use(requireAuth);
classRoutes.get('/', (req, res, next) => academicsController.getClasses(req, res, next));
classRoutes.get('/:id', (req, res, next) => academicsController.getClassById(req, res, next));
classRoutes.post('/', requireAdmin, (req, res, next) => academicsController.createClass(req, res, next));
classRoutes.patch('/:id', requireAdmin, (req, res, next) => academicsController.updateClass(req, res, next));
classRoutes.put('/:id', requireAdmin, (req, res, next) => academicsController.updateClass(req, res, next));
classRoutes.delete('/:id', requireAdmin, (req, res, next) => academicsController.deleteClass(req, res, next));

// 3. Subject Routes
export const subjectRoutes = Router();
subjectRoutes.use(requireAuth);
subjectRoutes.get('/', (req, res, next) => academicsController.getSubjects(req, res, next));
subjectRoutes.get('/:id', (req, res, next) => academicsController.getSubjectById(req, res, next));
subjectRoutes.post('/', requireAdmin, (req, res, next) => academicsController.createSubject(req, res, next));
subjectRoutes.patch('/:id', requireAdmin, (req, res, next) => academicsController.updateSubject(req, res, next));
subjectRoutes.put('/:id', requireAdmin, (req, res, next) => academicsController.updateSubject(req, res, next));
subjectRoutes.delete('/:id', requireAdmin, (req, res, next) => academicsController.deleteSubject(req, res, next));

// 4. Academic Year Routes
export const academicYearRoutes = Router();
academicYearRoutes.use(requireAuth);
academicYearRoutes.get('/', (req, res, next) => academicsController.getAcademicYears(req, res, next));
academicYearRoutes.get('/:id', (req, res, next) => academicsController.getAcademicYearById(req, res, next));
academicYearRoutes.post('/', requireAdmin, (req, res, next) => academicsController.createAcademicYear(req, res, next));
academicYearRoutes.patch('/:id', requireAdmin, (req, res, next) => academicsController.updateAcademicYear(req, res, next));
academicYearRoutes.put('/:id', requireAdmin, (req, res, next) => academicsController.updateAcademicYear(req, res, next));
academicYearRoutes.delete('/:id', requireAdmin, (req, res, next) => academicsController.deleteAcademicYear(req, res, next));
