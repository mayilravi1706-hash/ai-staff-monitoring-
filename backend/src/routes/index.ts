import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import { staffRoutes } from '../modules/staff/staff.routes';
import { attendanceRoutes } from '../modules/attendance/attendance.routes';
import { taskRoutes } from '../modules/tasks/tasks.routes';
import { leaveRoutes } from '../modules/leave/leave.routes';
import { activityRoutes } from '../modules/activity/activity.routes';
import { workloadRoutes } from '../modules/workload/workload.routes';
import { performanceRoutes } from '../modules/performance/performance.routes';
import { timetableRoutes } from '../modules/timetable/timetable.routes';
import { aiAlertRoutes } from '../modules/ai-alerts/ai-alerts.routes';
import { monitoringRoutes } from '../modules/monitoring/monitoring.routes';
import { auditRoutes } from '../modules/audit/audit.routes';
import { notificationRoutes } from '../modules/notifications/notifications.routes';
import { operationsRoutes } from '../modules/operations/operations.routes';
import { analyticsRoutes } from '../modules/analytics/analytics.routes';
import { reportsRoutes } from '../modules/reports/reports.routes';
import { settingsRoutes } from '../modules/settings/settings.routes';
import { aiRoutes } from '../modules/ai/ai.routes';
import {
  departmentRoutes,
  classRoutes,
  subjectRoutes,
  academicYearRoutes,
} from '../modules/academics/academics.routes';

const apiRouter = Router();

// Phase 1 Foundation Routes
apiRouter.use('/health', healthRoutes);

// Phase 2 Authentication Routes
apiRouter.use('/auth', authRoutes);

// Phase 3 RBAC & IDOR Protected Routes
apiRouter.use('/staff', staffRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/classes', classRoutes);
apiRouter.use('/subjects', subjectRoutes);
apiRouter.use('/academic-years', academicYearRoutes);
apiRouter.use('/timetable', timetableRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/tasks', taskRoutes);
apiRouter.use('/leave', leaveRoutes);
apiRouter.use('/leave-requests', leaveRoutes);
apiRouter.use('/activity', activityRoutes);
apiRouter.use('/activities', activityRoutes);
apiRouter.use('/monitoring', monitoringRoutes);
apiRouter.use('/operations', operationsRoutes);
apiRouter.use('/workload', workloadRoutes);
apiRouter.use('/performance', performanceRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/ai-alerts', aiAlertRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/reports', reportsRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/ai', aiRoutes);

export default apiRouter;
