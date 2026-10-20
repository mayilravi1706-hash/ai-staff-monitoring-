import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { workloadService } from './workload.service';
import { performanceService } from './performance.service';
import { AttendanceStatus, TaskStatus, TaskPriority } from '@prisma/client';

export interface AnalyticsFilter {
  departmentId?: string;
  startDate?: Date;
  endDate?: Date;
  academicYearId?: string;
}

export class AnalyticsService {
  /**
   * ADMIN ANALYTICS: Institutional Overview
   */
  async getAdminOverview(filters: AnalyticsFilter = {}) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const staffWhere: any = { status: 'ACTIVE' };
    if (filters.departmentId) {
      staffWhere.department_id = filters.departmentId;
    }

    const [
      totalStaff,
      todayAttendance,
      todayLeaves,
      todayActivities,
      allTasks,
      openAlerts,
      departments,
    ] = await Promise.all([
      prisma.staff.count({ where: staffWhere }),
      prisma.attendance.findMany({
        where: {
          attendance_date: { gte: todayStart, lte: todayEnd },
          ...(filters.departmentId ? { staff: { department_id: filters.departmentId } } : {}),
        },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          start_date: { lte: todayEnd },
          end_date: { gte: todayStart },
          ...(filters.departmentId ? { staff: { department_id: filters.departmentId } } : {}),
        },
      }),
      prisma.activity.findMany({
        where: {
          start_time: { gte: todayStart, lte: todayEnd },
          ...(filters.departmentId ? { staff: { department_id: filters.departmentId } } : {}),
        },
      }),
      prisma.task.findMany({
        where: {
          ...(filters.departmentId ? { assigned_staff: { department_id: filters.departmentId } } : {}),
        },
      }),
      prisma.operationalAlert.count({
        where: {
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
          ...(filters.departmentId ? { department_id: filters.departmentId } : {}),
        },
      }),
      prisma.department.findMany({
        where: { status: 'ACTIVE' },
        include: {
          _count: {
            select: { staff: true, classes: true, subjects: true },
          },
        },
      }),
    ]);

    let presentStaff = 0;
    let absentStaff = 0;
    let halfDayStaff = 0;

    for (const att of todayAttendance) {
      if (att.status === AttendanceStatus.PRESENT) presentStaff++;
      else if (att.status === AttendanceStatus.ABSENT) absentStaff++;
      else if (att.status === AttendanceStatus.HALF_DAY) halfDayStaff++;
    }

    // Active teaching right now
    const currentlyTeaching = todayActivities.filter(
      (a) => a.activity_status === 'TEACHING' && (!a.actual_end_time || new Date(a.actual_end_time) > now)
    ).length;

    // Tasks breakdown
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;

    for (const t of allTasks) {
      if (t.status === TaskStatus.COMPLETED) completedTasks++;
      else if (t.status === TaskStatus.OVERDUE || new Date(t.due_date).getTime() < now.getTime()) overdueTasks++;
      else if (t.status === TaskStatus.IN_PROGRESS) inProgressTasks++;
      else pendingTasks++;
    }

    // Teaching class coverage today
    const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
    const jsDay = now.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const scheduledTimetableToday = await prisma.timetable.findMany({
      where: {
        day_of_week: dayOfWeek,
        status: 'SCHEDULED',
        ...(activeYear ? { academic_year_id: activeYear.id } : {}),
        ...(filters.departmentId ? { class: { department_id: filters.departmentId } } : {}),
      },
    });

    const scheduledClassesToday = scheduledTimetableToday.length;
    const completedClassesToday = todayActivities.filter((a) => a.activity_status === 'TEACHING').length;
    const classCoveragePercentage =
      scheduledClassesToday > 0
        ? Math.min(100, Math.round((completedClassesToday / scheduledClassesToday) * 100 * 10) / 10)
        : null;

    return {
      totalStaff,
      presentStaff,
      absentStaff,
      halfDayStaff,
      staffOnApprovedLeave: todayLeaves,
      currentlyTeaching,
      scheduledClassesToday,
      completedClassesToday,
      classCoveragePercentage,
      tasks: {
        total: allTasks.length,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      },
      openOperationalAlerts: openAlerts,
      departmentsSummary: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        staffCount: d._count.staff,
        classCount: d._count.classes,
        subjectCount: d._count.subjects,
      })),
      timestamp: now.toISOString(),
    };
  }

  /**
   * ADMIN ANALYTICS: Workload
   */
  async getAdminWorkloadAnalytics(filters: AnalyticsFilter = {}) {
    const metrics = await prisma.workloadMetric.findMany({
      where: {
        ...(filters.departmentId ? { staff: { department_id: filters.departmentId } } : {}),
      },
      include: {
        staff: {
          select: { id: true, staff_id: true, full_name: true, department_id: true, department: true },
        },
      },
      orderBy: { period_start: 'desc' },
      take: 100,
    });

    // Grouping by status
    const statusDistribution: Record<string, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      CONCENTRATED: 0,
      INSUFFICIENT_DATA: 0,
    };

    let totalScore = 0;
    let scoreCount = 0;
    let totalTeachingHours = 0;
    let totalActiveTasks = 0;
    let totalOverdueTasks = 0;
    let totalAdminActivities = 0;

    for (const m of metrics) {
      const st = m.workload_status || 'NORMAL';
      statusDistribution[st] = (statusDistribution[st] || 0) + 1;

      if (m.workload_score !== null && m.workload_score > 0) {
        totalScore += m.workload_score;
        scoreCount++;
      }
      totalTeachingHours += m.teaching_hours || 0;
      totalActiveTasks += m.active_task_count || 0;
      totalOverdueTasks += m.overdue_task_count || 0;
      totalAdminActivities += m.administrative_activity_count || 0;
    }

    const averageWorkloadScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : null;

    // Aggregate by department
    const departmentWorkload: Record<string, { name: string; totalScore: number; count: number }> = {};
    for (const m of metrics) {
      if (m.staff?.department) {
        const dId = m.staff.department.id;
        if (!departmentWorkload[dId]) {
          departmentWorkload[dId] = {
            name: m.staff.department.name,
            totalScore: 0,
            count: 0,
          };
        }
        if (m.workload_score) {
          departmentWorkload[dId].totalScore += m.workload_score;
          departmentWorkload[dId].count++;
        }
      }
    }

    const departmentSummary = Object.entries(departmentWorkload).map(([id, d]) => ({
      departmentId: id,
      departmentName: d.name,
      averageScore: d.count > 0 ? Math.round((d.totalScore / d.count) * 10) / 10 : 0,
      staffEvaluated: d.count,
    }));

    return {
      totalEvaluated: metrics.length,
      averageWorkloadScore,
      statusDistribution,
      aggregateTotals: {
        totalTeachingHours: Math.round(totalTeachingHours * 10) / 10,
        totalActiveTasks,
        totalOverdueTasks,
        totalAdminActivities,
      },
      departmentSummary,
      recentMetrics: metrics.slice(0, 30).map((m) => ({
        id: m.id,
        staffId: m.staff_id,
        staffName: m.staff.full_name,
        departmentName: m.staff.department?.name,
        teachingHours: m.teaching_hours,
        activeTasks: m.active_task_count,
        overdueTasks: m.overdue_task_count,
        workloadScore: m.workload_score,
        workloadStatus: m.workload_status,
        workloadTrend: m.workload_trend,
        periodStart: m.period_start,
      })),
    };
  }

  /**
   * ADMIN ANALYTICS: Performance
   */
  async getAdminPerformanceAnalytics(filters: AnalyticsFilter = {}) {
    const records = await prisma.performance.findMany({
      where: {
        ...(filters.departmentId ? { staff: { department_id: filters.departmentId } } : {}),
      },
      include: {
        staff: {
          select: { id: true, staff_id: true, full_name: true, department: true },
        },
      },
      orderBy: { period_start: 'desc' },
      take: 100,
    });

    let totalOverall = 0;
    let totalAttendance = 0;
    let totalTasks = 0;
    let totalOnTime = 0;
    let totalClasses = 0;
    let validCount = 0;

    const scoreRanges: Record<string, number> = {
      '90-100%': 0,
      '75-89%': 0,
      '60-74%': 0,
      '<60%': 0,
      'Insufficient Data': 0,
    };

    for (const r of records) {
      if (r.overall_score !== null) {
        totalOverall += r.overall_score;
        if (r.attendance_score !== null) totalAttendance += r.attendance_score;
        if (r.task_completion_score !== null) totalTasks += r.task_completion_score;
        if (r.on_time_completion_score !== null) totalOnTime += r.on_time_completion_score;
        if (r.class_completion_score !== null) totalClasses += r.class_completion_score;
        validCount++;

        if (r.overall_score >= 90) scoreRanges['90-100%']++;
        else if (r.overall_score >= 75) scoreRanges['75-89%']++;
        else if (r.overall_score >= 60) scoreRanges['60-74%']++;
        else scoreRanges['<60%']++;
      } else {
        scoreRanges['Insufficient Data']++;
      }
    }

    const averageScores =
      validCount > 0
        ? {
            overall: Math.round((totalOverall / validCount) * 10) / 10,
            attendance: Math.round((totalAttendance / validCount) * 10) / 10,
            taskCompletion: Math.round((totalTasks / validCount) * 10) / 10,
            onTimeCompletion: Math.round((totalOnTime / validCount) * 10) / 10,
            classCompletion: Math.round((totalClasses / validCount) * 10) / 10,
          }
        : null;

    const weights = await performanceService.getPerformanceWeights();

    return {
      totalEvaluated: records.length,
      averageScores,
      scoreDistribution: scoreRanges,
      configuredWeights: weights,
      recentRecords: records.slice(0, 30).map((r) => ({
        id: r.id,
        staffId: r.staff_id,
        staffName: r.staff.full_name,
        departmentName: r.staff.department?.name,
        overallScore: r.overall_score,
        attendanceScore: r.attendance_score,
        taskCompletionScore: r.task_completion_score,
        onTimeCompletionScore: r.on_time_completion_score,
        classCompletionScore: r.class_completion_score,
        operationalActivityScore: r.operational_activity_score,
        dataCompleteness: r.data_completeness,
        periodStart: r.period_start,
      })),
    };
  }

  /**
   * ADMIN ANALYTICS: Attendance Trends
   */
  async getAdminAttendanceAnalytics(filters: AnalyticsFilter = {}) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const records = await prisma.attendance.findMany({
      where: {
        attendance_date: { gte: thirtyDaysAgo },
        ...(filters.departmentId ? { staff: { department_id: filters.departmentId } } : {}),
      },
      orderBy: { attendance_date: 'asc' },
    });

    const dateMap: Record<string, { present: number; absent: number; halfDay: number; leave: number }> = {};

    for (const r of records) {
      const dateKey = r.attendance_date.toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { present: 0, absent: 0, halfDay: 0, leave: 0 };
      }
      if (r.status === AttendanceStatus.PRESENT) dateMap[dateKey].present++;
      else if (r.status === AttendanceStatus.ABSENT) dateMap[dateKey].absent++;
      else if (r.status === AttendanceStatus.HALF_DAY) dateMap[dateKey].halfDay++;
      else if (r.status === AttendanceStatus.LEAVE) dateMap[dateKey].leave++;
    }

    const timeline = Object.entries(dateMap).map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.present + counts.absent + counts.halfDay + counts.leave,
      attendanceRate:
        counts.present + counts.absent + counts.halfDay > 0
          ? Math.round(
              ((counts.present + counts.halfDay * 0.5) /
                (counts.present + counts.absent + counts.halfDay)) *
                100
            )
          : 100,
    }));

    return {
      periodDays: 30,
      totalRecords: records.length,
      timeline,
    };
  }

  /**
   * ADMIN ANALYTICS: Tasks Breakdown
   */
  async getAdminTasksAnalytics(filters: AnalyticsFilter = {}) {
    const tasks = await prisma.task.findMany({
      where: {
        ...(filters.departmentId ? { assigned_staff: { department_id: filters.departmentId } } : {}),
      },
      include: {
        assigned_staff: { select: { id: true, full_name: true, department: true } },
      },
    });

    const byStatus: Record<string, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      OVERDUE: 0,
    };

    const byPriority: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };

    const now = Date.now();
    for (const t of tasks) {
      const isCompleted = t.status === TaskStatus.COMPLETED;
      const isOverdue = t.status === TaskStatus.OVERDUE || (!isCompleted && new Date(t.due_date).getTime() < now);

      if (isCompleted) byStatus.COMPLETED++;
      else if (isOverdue) byStatus.OVERDUE++;
      else if (t.status === TaskStatus.IN_PROGRESS) byStatus.IN_PROGRESS++;
      else byStatus.PENDING++;

      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    }

    const completionRate =
      tasks.length > 0 ? Math.round((byStatus.COMPLETED / tasks.length) * 100 * 10) / 10 : 0;

    return {
      totalTasks: tasks.length,
      completionRate,
      byStatus,
      byPriority,
    };
  }

  // ==========================================
  // STAFF-SCOPED ANALYTICS (SELF ONLY)
  // ==========================================

  /**
   * STAFF ANALYTICS: Overview
   */
  async getStaffOverview(staffId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [
      staff,
      workload,
      performance,
      todayAttendance,
      todayActivities,
      tasks,
      activeAlerts,
    ] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: staffId },
        include: { department: true },
      }),
      workloadService.calculateStaffWorkload(staffId),
      performanceService.calculateStaffPerformance(staffId),
      prisma.attendance.findFirst({
        where: {
          staff_id: staffId,
          attendance_date: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.activity.findMany({
        where: {
          staff_id: staffId,
          start_time: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.task.findMany({
        where: { assigned_staff_id: staffId },
      }),
      prisma.operationalAlert.findMany({
        where: {
          staff_id: staffId,
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
        take: 5,
        orderBy: { detected_at: 'desc' },
      }),
    ]);

    if (!staff) {
      throw new Error('Staff record not found');
    }

    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;

    for (const t of tasks) {
      if (t.status === TaskStatus.COMPLETED) completedTasks++;
      else if (t.status === TaskStatus.OVERDUE || new Date(t.due_date).getTime() < now.getTime()) overdueTasks++;
      else if (t.status === TaskStatus.IN_PROGRESS) inProgressTasks++;
      else pendingTasks++;
    }

    return {
      staff: {
        id: staff.id,
        staffId: staff.staff_id,
        fullName: staff.full_name,
        designation: staff.designation,
        departmentName: staff.department?.name,
      },
      todayAttendance: todayAttendance ? todayAttendance.status : 'NOT_MARKED',
      todayActivitiesCount: todayActivities.length,
      tasksSummary: {
        total: tasks.length,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      },
      currentWorkload: workload,
      currentPerformance: performance,
      activeOperationalAlerts: activeAlerts,
      timestamp: now.toISOString(),
    };
  }

  /**
   * STAFF ANALYTICS: Workload
   */
  async getStaffWorkload(staffId: string) {
    const [current, history] = await Promise.all([
      workloadService.calculateStaffWorkload(staffId),
      workloadService.getStaffWorkloadHistory(staffId, 12),
    ]);

    return {
      current,
      history,
    };
  }

  /**
   * STAFF ANALYTICS: Performance
   */
  async getStaffPerformance(staffId: string) {
    const [current, history, weights] = await Promise.all([
      performanceService.calculateStaffPerformance(staffId),
      performanceService.getStaffPerformanceHistory(staffId, 12),
      performanceService.getPerformanceWeights(),
    ]);

    return {
      current,
      history,
      weights,
    };
  }

  /**
   * STAFF ANALYTICS: Attendance
   */
  async getStaffAttendance(staffId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const records = await prisma.attendance.findMany({
      where: {
        staff_id: staffId,
        attendance_date: { gte: thirtyDaysAgo },
      },
      orderBy: { attendance_date: 'desc' },
    });

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;

    for (const r of records) {
      if (r.status === AttendanceStatus.PRESENT) present++;
      else if (r.status === AttendanceStatus.ABSENT) absent++;
      else if (r.status === AttendanceStatus.HALF_DAY) halfDay++;
      else if (r.status === AttendanceStatus.LEAVE) leave++;
    }

    const totalDays = records.length;
    const rate = totalDays > 0 ? Math.round(((present + halfDay * 0.5) / totalDays) * 100 * 10) / 10 : 100;

    return {
      rate,
      totalDays,
      present,
      absent,
      halfDay,
      leave,
      records,
    };
  }

  /**
   * STAFF ANALYTICS: Tasks
   */
  async getStaffTasks(staffId: string) {
    const tasks = await prisma.task.findMany({
      where: { assigned_staff_id: staffId },
      orderBy: [{ due_date: 'asc' }],
    });

    const now = Date.now();
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    for (const t of tasks) {
      const isCompleted = t.status === TaskStatus.COMPLETED;
      const isOverdue = t.status === TaskStatus.OVERDUE || (!isCompleted && new Date(t.due_date).getTime() < now);

      if (isCompleted) completed++;
      else if (isOverdue) overdue++;
      else if (t.status === TaskStatus.IN_PROGRESS) inProgress++;
      else pending++;
    }

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed,
      overdue,
      tasks,
    };
  }
}

export const analyticsService = new AnalyticsService();
