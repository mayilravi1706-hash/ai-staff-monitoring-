import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { operationalAlertService } from './operationalAlert.service';
import { timeToMinutes } from '../modules/timetable/timetable.validation';

export type WorkloadStatus = 'LOW' | 'NORMAL' | 'HIGH' | 'CONCENTRATED' | 'INSUFFICIENT_DATA';

export interface WorkloadCalculationResult {
  staffId: string;
  staffName: string;
  departmentId?: string;
  departmentName?: string;
  periodStart: Date;
  periodEnd: Date;
  teachingHours: number;
  scheduledClassCount: number;
  completedClassCount: number;
  classCoveragePercentage: number | null;
  activeTaskCount: number;
  pendingTaskCount: number;
  inProgressTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  highPriorityTaskCount: number;
  urgentTaskCount: number;
  upcomingDeadlineCount: number;
  administrativeActivityCount: number;
  meetingActivityCount: number;
  prepActivityCount: number;
  leaveDays: number;
  deadlinePressure: number;
  workloadScore: number;
  workloadStatus: WorkloadStatus;
  workloadTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
  contributingFactors: {
    teachingHoursContribution: number;
    taskVolumeContribution: number;
    overdueTaskContribution: number;
    deadlinePressureContribution: number;
    administrativeContribution: number;
    leaveImpactDescription: string;
  };
  explanation: string;
  calculatedAt: Date;
}

export class WorkloadService {
  /**
   * Recalculates and updates workload metrics for a staff member (alias for calculateStaffWorkload)
   */
  async recalculateWorkload(staffIdentifier: string, tx?: any): Promise<WorkloadCalculationResult | null> {
    return this.calculateStaffWorkload(staffIdentifier, undefined, undefined, tx);
  }

  /**
   * Deterministically calculates and saves workload metrics for a staff member based exclusively
   * on authorized PostgreSQL database records.
   */
  async calculateStaffWorkload(
    staffIdentifier: string,
    periodStart?: Date,
    periodEnd?: Date,
    tx?: any
  ): Promise<WorkloadCalculationResult | null> {
    try {
      const db = tx || prisma;
      const staff = await db.staff.findFirst({
        where: {
          OR: [{ id: staffIdentifier }, { staff_id: staffIdentifier }],
        },
        include: { department: true },
      });

      if (!staff) {
        logger.warn(`Cannot calculate workload: Staff not found (${staffIdentifier})`);
        return null;
      }

      const now = new Date();
      // Default period: Current Month (UTC bounds)
      const start = periodStart || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end =
        periodEnd ||
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      const twoDaysAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // 1. Timetable Slots & Teaching Hours
      const activeYear = await db.academicYear.findFirst({ where: { active: true } });
      const timetableSlots = await db.timetable.findMany({
        where: {
          staff_id: staff.id,
          status: 'SCHEDULED',
          ...(activeYear ? { academic_year_id: activeYear.id } : {}),
        },
      });

      let weeklyScheduledMinutes = 0;
      for (const slot of timetableSlots) {
        const sMin = timeToMinutes(slot.start_time);
        const eMin = timeToMinutes(slot.end_time);
        const dur = Math.max(0, eMin - sMin);
        weeklyScheduledMinutes += dur > 0 ? dur : 60;
      }
      const weeklyTeachingHours = Math.round((weeklyScheduledMinutes / 60) * 10) / 10;
      // Monthly teaching hours approx = weekly * 4.2
      const monthlyTeachingHours = Math.round(weeklyTeachingHours * 4.2 * 10) / 10;

      // 2. Class Activities in Period (Completed vs Scheduled)
      const teachingActivities = await db.activity.findMany({
        where: {
          staff_id: staff.id,
          activity_status: 'TEACHING',
          start_time: { gte: start, lte: end },
        },
      });
      const completedClassCount = teachingActivities.length;
      const scheduledClassCount = timetableSlots.length * 4;
      const classCoveragePercentage =
        scheduledClassCount > 0
          ? Math.min(100, Math.round((completedClassCount / scheduledClassCount) * 100 * 10) / 10)
          : null;

      // 3. Tasks in Period
      const tasks = await db.task.findMany({
        where: { assigned_staff_id: staff.id },
      });

      let pendingTaskCount = 0;
      let inProgressTaskCount = 0;
      let completedTaskCount = 0;
      let overdueTaskCount = 0;
      let highPriorityTaskCount = 0;
      let urgentTaskCount = 0;
      let upcomingDeadlineCount = 0;
      let deadlinePressurePoints = 0;

      for (const t of tasks) {
        const isCompleted = t.status === 'COMPLETED';
        const isOverdue = t.status === 'OVERDUE' || (!isCompleted && new Date(t.due_date).getTime() < now.getTime());

        if (isCompleted) {
          completedTaskCount++;
        } else {
          if (t.status === 'PENDING') pendingTaskCount++;
          if (t.status === 'IN_PROGRESS') inProgressTaskCount++;
          if (isOverdue) overdueTaskCount++;

          if (t.priority === 'HIGH') highPriorityTaskCount++;
          if (t.priority === 'URGENT') urgentTaskCount++;

          // Deadline proximity (within next 48h)
          const dueTime = new Date(t.due_date).getTime();
          if (dueTime >= now.getTime() && dueTime <= twoDaysAhead.getTime()) {
            upcomingDeadlineCount++;
            const weight = t.priority === 'URGENT' ? 5 : t.priority === 'HIGH' ? 3 : 1;
            deadlinePressurePoints += weight;
          }
        }
      }

      const activeTaskCount = pendingTaskCount + inProgressTaskCount + overdueTaskCount;

      // 4. Non-teaching Operational Activities
      const activities = await db.activity.findMany({
        where: {
          staff_id: staff.id,
          start_time: { gte: start, lte: end },
        },
      });

      let administrativeActivityCount = 0;
      let meetingActivityCount = 0;
      let prepActivityCount = 0;

      for (const act of activities) {
        if (act.activity_status === 'ADMINISTRATIVE_WORK') administrativeActivityCount++;
        else if (act.activity_status === 'MEETING') meetingActivityCount++;
        else if (act.activity_status === 'PREPARING_CLASS') prepActivityCount++;
      }

      // 5. Approved Leave in Period
      const approvedLeaves = await db.leaveRequest.findMany({
        where: {
          staff_id: staff.id,
          status: 'APPROVED',
          start_date: { lte: end },
          end_date: { gte: start },
        },
      });
      const leaveDays = approvedLeaves.reduce((acc: number, l: any) => acc + (l.duration || 0), 0);

      // 6. Data Sufficiency Check
      const hasAnyData =
        timetableSlots.length > 0 || tasks.length > 0 || activities.length > 0;

      let workloadStatus: WorkloadStatus = 'NORMAL';
      let workloadScore = 50;

      if (!hasAnyData) {
        workloadStatus = 'INSUFFICIENT_DATA';
        workloadScore = 0;
      } else {
        // Deterministic Score Calculation (0 - 100)
        // 1. Teaching Workload: Baseline is 18h/week (35 points max)
        const teachingPts = Math.min(35, Math.round((weeklyTeachingHours / 20) * 35));

        // 2. Active Tasks Workload: (30 points max)
        // pending = 2 pts, in_progress = 3 pts, urgent = 4 pts
        const taskRaw = pendingTaskCount * 2 + inProgressTaskCount * 3 + urgentTaskCount * 4 + highPriorityTaskCount * 2;
        const taskPts = Math.min(30, taskRaw);

        // 3. Overdue Tasks Contribution: (15 points max)
        const overduePts = Math.min(15, overdueTaskCount * 5);

        // 4. Deadline Pressure: (10 points max)
        const deadlinePts = Math.min(10, deadlinePressurePoints * 2);

        // 5. Operational Activities: (10 points max)
        const opActivitiesTotal = administrativeActivityCount + meetingActivityCount + prepActivityCount;
        const opPts = Math.min(10, Math.round(opActivitiesTotal * 1.5));

        const rawTotal = teachingPts + taskPts + overduePts + deadlinePts + opPts;
        workloadScore = Math.min(100, Math.max(5, rawTotal));

        if (workloadScore < 30) {
          workloadStatus = 'LOW';
        } else if (workloadScore <= 70) {
          workloadStatus = 'NORMAL';
        } else if (workloadScore <= 85) {
          workloadStatus = 'HIGH';
        } else {
          workloadStatus = 'CONCENTRATED';
        }
      }

      // Check trend from previous metric record
      const previousMetric = await db.workloadMetric.findFirst({
        where: {
          staff_id: staff.id,
          period_start: { lt: start },
        },
        orderBy: { period_start: 'desc' },
      });

      let workloadTrend: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
      if (previousMetric && previousMetric.workload_score !== null) {
        const diff = workloadScore - previousMetric.workload_score;
        if (diff > 8) workloadTrend = 'INCREASING';
        else if (diff < -8) workloadTrend = 'DECREASING';
      }

      const contributingFactors = {
        teachingHoursContribution: Math.min(35, Math.round((weeklyTeachingHours / 20) * 35)),
        taskVolumeContribution: Math.min(30, pendingTaskCount * 2 + inProgressTaskCount * 3 + urgentTaskCount * 4),
        overdueTaskContribution: Math.min(15, overdueTaskCount * 5),
        deadlinePressureContribution: Math.min(10, deadlinePressurePoints * 2),
        administrativeContribution: Math.min(10, Math.round((administrativeActivityCount + meetingActivityCount + prepActivityCount) * 1.5)),
        leaveImpactDescription:
          leaveDays > 0
            ? `${leaveDays} approved leave days adjusted within the analysis window.`
            : 'No approved leave taken in current period.',
      };

      const explanation =
        workloadStatus === 'INSUFFICIENT_DATA'
          ? 'Insufficient schedule, task, or activity records found for this period.'
          : `Calculated from ${weeklyTeachingHours}h weekly teaching (${timetableSlots.length} slots), ${activeTaskCount} active tasks (${overdueTaskCount} overdue, ${urgentTaskCount} urgent), ${upcomingDeadlineCount} approaching deadlines, and ${administrativeActivityCount + meetingActivityCount + prepActivityCount} operational activity sessions.`;

      // 7. Persist in WorkloadMetric model
      const existingRecord = await db.workloadMetric.findFirst({
        where: {
          staff_id: staff.id,
          period_start: {
            gte: new Date(start.getTime() - 86400000),
            lte: new Date(start.getTime() + 86400000),
          },
        },
      });

      const metadataObj = {
        weeklyTeachingHours,
        contributingFactors,
        explanation,
        calculatedAt: now.toISOString(),
      };

      if (existingRecord) {
        await db.workloadMetric.update({
          where: { id: existingRecord.id },
          data: {
            teaching_hours: monthlyTeachingHours,
            class_count: scheduledClassCount,
            completed_class_count: completedClassCount,
            class_coverage_percentage: classCoveragePercentage,
            active_task_count: activeTaskCount,
            pending_task_count: pendingTaskCount,
            in_progress_task_count: inProgressTaskCount,
            completed_task_count: completedTaskCount,
            overdue_task_count: overdueTaskCount,
            high_priority_task_count: highPriorityTaskCount,
            urgent_task_count: urgentTaskCount,
            upcoming_deadline_count: upcomingDeadlineCount,
            administrative_activity_count: administrativeActivityCount,
            meeting_activity_count: meetingActivityCount,
            prep_activity_count: prepActivityCount,
            leave_days: leaveDays,
            deadline_pressure: deadlinePressurePoints,
            workload_score: workloadScore,
            workload_status: workloadStatus,
            workload_trend: workloadTrend,
            metadata: JSON.stringify(metadataObj),
          },
        });
      } else {
        await db.workloadMetric.create({
          data: {
            staff_id: staff.id,
            period_start: start,
            period_end: end,
            teaching_hours: monthlyTeachingHours,
            class_count: scheduledClassCount,
            completed_class_count: completedClassCount,
            class_coverage_percentage: classCoveragePercentage,
            active_task_count: activeTaskCount,
            pending_task_count: pendingTaskCount,
            in_progress_task_count: inProgressTaskCount,
            completed_task_count: completedTaskCount,
            overdue_task_count: overdueTaskCount,
            high_priority_task_count: highPriorityTaskCount,
            urgent_task_count: urgentTaskCount,
            upcoming_deadline_count: upcomingDeadlineCount,
            administrative_activity_count: administrativeActivityCount,
            meeting_activity_count: meetingActivityCount,
            prep_activity_count: prepActivityCount,
            leave_days: leaveDays,
            deadline_pressure: deadlinePressurePoints,
            workload_score: workloadScore,
            workload_status: workloadStatus,
            workload_trend: workloadTrend,
            metadata: JSON.stringify(metadataObj),
          },
        });
      }

      // 8. Trigger Operational Alert if Workload is Concentrated/High
      if (workloadStatus === 'CONCENTRATED' || (workloadStatus === 'HIGH' && overdueTaskCount > 0)) {
        const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        const dedupKey = `WORKLOAD_CONCENTRATION_SIGNAL:${staff.id}:${yearMonth}`;

        await operationalAlertService.upsertAlert({
          alertType: 'WORKLOAD_CONCENTRATION',
          severity: workloadStatus === 'CONCENTRATED' ? 'HIGH' : 'MEDIUM',
          dedupKey,
          ruleIdentifier: 'RULE_WORKLOAD_CONCENTRATION_SIGNAL',
          title: 'Workload concentration signal detected',
          message: `Workload concentration signal detected based on current teaching, task, deadline, and activity data for ${staff.full_name}.`,
          staffId: staff.id,
          departmentId: staff.department_id,
          evidence: {
            staffName: staff.full_name,
            weeklyTeachingHours,
            activeTaskCount,
            overdueTaskCount,
            urgentTaskCount,
            upcomingDeadlineCount,
            workloadScore,
            workloadStatus,
            statement:
              'This is an operational allocation signal and does not reflect staff performance, conduct, or suitability.',
          },
          notifyAdmins: workloadStatus === 'CONCENTRATED',
        });
      }

      return {
        staffId: staff.id,
        staffName: staff.full_name,
        departmentId: staff.department_id,
        departmentName: staff.department?.name,
        periodStart: start,
        periodEnd: end,
        teachingHours: monthlyTeachingHours,
        scheduledClassCount,
        completedClassCount,
        classCoveragePercentage,
        activeTaskCount,
        pendingTaskCount,
        inProgressTaskCount,
        completedTaskCount,
        overdueTaskCount,
        highPriorityTaskCount,
        urgentTaskCount,
        upcomingDeadlineCount,
        administrativeActivityCount,
        meetingActivityCount,
        prepActivityCount,
        leaveDays,
        deadlinePressure: deadlinePressurePoints,
        workloadScore,
        workloadStatus,
        workloadTrend,
        contributingFactors,
        explanation,
        calculatedAt: now,
      };
    } catch (error) {
      logger.error('Failed to calculate staff workload', error, 'WORKLOAD_CALC_ERROR');
      return null;
    }
  }

  /**
   * Recalculates workload for all active staff members.
   */
  async recalculateAllStaffWorkload(): Promise<{ processed: number; alerts: number }> {
    const staffMembers = await prisma.staff.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    let processed = 0;
    let alerts = 0;

    for (const staff of staffMembers) {
      const res = await this.calculateStaffWorkload(staff.id);
      if (res) {
        processed++;
        if (res.workloadStatus === 'CONCENTRATED') {
          alerts++;
        }
      }
    }

    return { processed, alerts };
  }

  /**
   * Retrieves workload history for a staff member.
   */
  async getStaffWorkloadHistory(staffId: string, limit = 12) {
    return await prisma.workloadMetric.findMany({
      where: { staff_id: staffId },
      take: limit,
      orderBy: { period_start: 'desc' },
    });
  }
}

export const workloadService = new WorkloadService();
