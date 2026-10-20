import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createAuditLog } from '../modules/audit/audit.service';
import { AttendanceStatus } from '@prisma/client';

export interface PerformanceWeights {
  attendanceWeight: number;
  taskCompletionWeight: number;
  onTimeCompletionWeight: number;
  classCompletionWeight: number;
  operationalActivityWeight: number;
}

export const DEFAULT_PERFORMANCE_WEIGHTS: PerformanceWeights = {
  attendanceWeight: 20,
  taskCompletionWeight: 25,
  onTimeCompletionWeight: 20,
  classCompletionWeight: 25,
  operationalActivityWeight: 10,
};

const WEIGHT_KEY_MAPPING: Record<keyof PerformanceWeights, string> = {
  attendanceWeight: 'PERFORMANCE_WEIGHT_ATTENDANCE',
  taskCompletionWeight: 'PERFORMANCE_WEIGHT_TASK_COMPLETION',
  onTimeCompletionWeight: 'PERFORMANCE_WEIGHT_ON_TIME_COMPLETION',
  classCompletionWeight: 'PERFORMANCE_WEIGHT_CLASS_COMPLETION',
  operationalActivityWeight: 'PERFORMANCE_WEIGHT_OPERATIONAL_ACTIVITY',
};

export interface PerformanceCalculationResult {
  staffId: string;
  staffName: string;
  departmentId?: string;
  departmentName?: string;
  periodStart: Date;
  periodEnd: Date;
  attendanceScore: number | null;
  taskCompletionScore: number | null;
  onTimeCompletionScore: number | null;
  classCompletionScore: number | null;
  operationalActivityScore: number | null;
  overallScore: number | null;
  dataCompleteness: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA';
  calculationVersion: string;
  componentDetails: {
    attendance: { presentDays: number; halfDays: number; evaluatedDays: number; leaveDays: number };
    tasks: { totalAssigned: number; completed: number; overdue: number; onTimeCompleted: number };
    classes: { totalScheduledSlots: number; completedTeachingSessions: number };
    operationalActivities: { adminCount: number; meetingCount: number; prepCount: number };
    weightsApplied: PerformanceWeights;
  };
  explanation: string;
  calculatedAt: Date;
}

export class PerformanceService {
  /**
   * Retrieves configured performance weights with fallback defaults.
   */
  async getPerformanceWeights(): Promise<PerformanceWeights> {
    try {
      const keys = Object.values(WEIGHT_KEY_MAPPING);
      const settings = await prisma.setting.findMany({
        where: { key: { in: keys } },
      });

      const map = new Map(settings.map((s) => [s.key, Number(s.value)]));
      const weights: PerformanceWeights = { ...DEFAULT_PERFORMANCE_WEIGHTS };

      for (const [prop, key] of Object.entries(WEIGHT_KEY_MAPPING) as [keyof PerformanceWeights, string][]) {
        const val = map.get(key);
        if (val !== undefined && !isNaN(val) && val >= 0) {
          weights[prop] = val;
        }
      }

      const total =
        weights.attendanceWeight +
        weights.taskCompletionWeight +
        weights.onTimeCompletionWeight +
        weights.classCompletionWeight +
        weights.operationalActivityWeight;

      if (Math.round(total) === 100) {
        return weights;
      }
    } catch (error) {
      logger.warn('Failed to load performance weights from settings, using defaults', 'PERF_CONFIG_WARNING');
    }
    return { ...DEFAULT_PERFORMANCE_WEIGHTS };
  }

  /**
   * Updates performance weights with strict validation and audit logging.
   * Total must strictly equal 100%. All values must be non-negative numbers.
   */
  async updatePerformanceWeights(weights: Partial<PerformanceWeights>, userId?: string): Promise<PerformanceWeights> {
    const current = await this.getPerformanceWeights();
    const updated: PerformanceWeights = {
      attendanceWeight: weights.attendanceWeight ?? current.attendanceWeight,
      taskCompletionWeight: weights.taskCompletionWeight ?? current.taskCompletionWeight,
      onTimeCompletionWeight: weights.onTimeCompletionWeight ?? current.onTimeCompletionWeight,
      classCompletionWeight: weights.classCompletionWeight ?? current.classCompletionWeight,
      operationalActivityWeight: weights.operationalActivityWeight ?? current.operationalActivityWeight,
    };

    // Validation
    const vals = Object.values(updated);
    for (const v of vals) {
      if (typeof v !== 'number' || isNaN(v) || v < 0) {
        throw new Error('All performance weights must be non-negative numbers.');
      }
    }

    const total = Math.round(
      updated.attendanceWeight +
        updated.taskCompletionWeight +
        updated.onTimeCompletionWeight +
        updated.classCompletionWeight +
        updated.operationalActivityWeight
    );

    if (total !== 100) {
      throw new Error(`Performance weights must sum exactly to 100%. Current sum: ${total}%.`);
    }

    // Persist to Settings
    for (const [prop, key] of Object.entries(WEIGHT_KEY_MAPPING) as [keyof PerformanceWeights, string][]) {
      await prisma.setting.upsert({
        where: { key },
        update: {
          value: String(updated[prop]),
          updated_by: userId || null,
        },
        create: {
          key,
          value: String(updated[prop]),
          data_type: 'NUMBER',
          updated_by: userId || null,
        },
      });
    }

    // Record in Audit Log
    if (userId) {
      await createAuditLog({
        userId,
        action: 'UPDATE_PERFORMANCE_WEIGHTS',
        entityType: 'SETTING',
        entityId: 'PERFORMANCE_WEIGHTS',
        beforeValue: current,
        afterValue: updated,
      });
    }

    return updated;
  }

  /**
   * Deterministically calculates performance metrics for a staff member from real PostgreSQL database records.
   * Does NOT invent data or rank employees.
   */
  async calculateStaffPerformance(
    staffIdentifier: string,
    periodStart?: Date,
    periodEnd?: Date,
    tx?: any
  ): Promise<PerformanceCalculationResult | null> {
    try {
      const db = tx || prisma;
      const staff = await db.staff.findFirst({
        where: {
          OR: [{ id: staffIdentifier }, { staff_id: staffIdentifier }],
        },
        include: { department: true },
      });

      if (!staff) {
        logger.warn(`Cannot calculate performance: Staff not found (${staffIdentifier})`);
        return null;
      }

      const now = new Date();
      const start = periodStart || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end =
        periodEnd ||
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      const weights = await this.getPerformanceWeights();

      // 1. Attendance Score Calculation
      const attendanceRecords = await db.attendance.findMany({
        where: {
          staff_id: staff.id,
          attendance_date: { gte: start, lte: end },
        },
      });

      const approvedLeaves = await db.leaveRequest.findMany({
        where: {
          staff_id: staff.id,
          status: 'APPROVED',
          start_date: { lte: end },
          end_date: { gte: start },
        },
      });
      const leaveDays = approvedLeaves.reduce((acc: number, l: any) => acc + (l.duration || 0), 0);

      let presentDays = 0;
      let halfDays = 0;
      for (const rec of attendanceRecords) {
        if (rec.status === AttendanceStatus.PRESENT) presentDays++;
        else if (rec.status === AttendanceStatus.HALF_DAY) halfDays++;
      }

      const totalEvaluatedAttendanceDays = attendanceRecords.length;
      let attendanceScore: number | null = null;
      if (totalEvaluatedAttendanceDays >= 3) {
        const effectivePresent = presentDays + halfDays * 0.5;
        attendanceScore = Math.min(100, Math.round((effectivePresent / totalEvaluatedAttendanceDays) * 100 * 10) / 10);
      }

      // 2. Task Completion & On-time Completion Scores
      const tasks = await db.task.findMany({
        where: {
          assigned_staff_id: staff.id,
          assigned_date: { lte: end },
        },
      });

      let completedTasksCount = 0;
      let onTimeCompletedCount = 0;
      let overdueTasksCount = 0;

      for (const t of tasks) {
        if (t.status === 'COMPLETED') {
          completedTasksCount++;
          if (t.completed_at && t.due_date) {
            if (new Date(t.completed_at).getTime() <= new Date(t.due_date).getTime() + 86400000) {
              onTimeCompletedCount++;
            }
          } else {
            onTimeCompletedCount++;
          }
        } else if (t.status === 'OVERDUE' || (t.due_date && new Date(t.due_date).getTime() < now.getTime())) {
          overdueTasksCount++;
        }
      }

      let taskCompletionScore: number | null = null;
      let onTimeCompletionScore: number | null = null;

      if (tasks.length > 0) {
        taskCompletionScore = Math.round((completedTasksCount / tasks.length) * 100 * 10) / 10;
        if (completedTasksCount > 0) {
          onTimeCompletionScore = Math.round((onTimeCompletedCount / completedTasksCount) * 100 * 10) / 10;
        }
      }

      // 3. Class Completion Score (Teaching Activities vs Scheduled Slots)
      const timetableSlots = await db.timetable.findMany({
        where: { staff_id: staff.id, status: 'SCHEDULED' },
      });

      const teachingActivities = await db.activity.findMany({
        where: {
          staff_id: staff.id,
          activity_status: 'TEACHING',
          start_time: { gte: start, lte: end },
        },
      });

      let classCompletionScore: number | null = null;
      const scheduledSlotsMonthApprox = timetableSlots.length * 4;

      if (scheduledSlotsMonthApprox > 0) {
        classCompletionScore = Math.min(
          100,
          Math.round((teachingActivities.length / scheduledSlotsMonthApprox) * 100 * 10) / 10
        );
      }

      // 4. Operational Activity Score (Admin, Prep, Meetings)
      const nonTeachingActivities = await db.activity.findMany({
        where: {
          staff_id: staff.id,
          activity_status: { in: ['ADMINISTRATIVE_WORK', 'MEETING', 'PREPARING_CLASS'] },
          start_time: { gte: start, lte: end },
        },
      });

      let adminCount = 0;
      let meetingCount = 0;
      let prepCount = 0;

      for (const act of nonTeachingActivities) {
        if (act.activity_status === 'ADMINISTRATIVE_WORK') adminCount++;
        if (act.activity_status === 'MEETING') meetingCount++;
        if (act.activity_status === 'PREPARING_CLASS') prepCount++;
      }

      const totalOpActivities = adminCount + meetingCount + prepCount;
      let operationalActivityScore: number | null = null;
      if (totalOpActivities > 0 || timetableSlots.length > 0) {
        // Benchmark of 8 constructive non-teaching operational activity logs per month
        operationalActivityScore = Math.min(100, Math.round((totalOpActivities / 8) * 100 * 10) / 10);
      }

      // 5. Overall Weighted Performance Score & Data Completeness
      const components: { score: number | null; weight: number }[] = [
        { score: attendanceScore, weight: weights.attendanceWeight },
        { score: taskCompletionScore, weight: weights.taskCompletionWeight },
        { score: onTimeCompletionScore, weight: weights.onTimeCompletionWeight },
        { score: classCompletionScore, weight: weights.classCompletionWeight },
        { score: operationalActivityScore, weight: weights.operationalActivityWeight },
      ];

      const availableComponents = components.filter((c) => c.score !== null);
      let dataCompleteness: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
      let overallScore: number | null = null;

      if (availableComponents.length === 5) {
        dataCompleteness = 'COMPLETE';
      } else if (availableComponents.length >= 2) {
        dataCompleteness = 'PARTIAL';
      } else {
        dataCompleteness = 'INSUFFICIENT_DATA';
      }

      if (dataCompleteness !== 'INSUFFICIENT_DATA') {
        const availableWeightSum = availableComponents.reduce((sum, c) => sum + c.weight, 0);
        if (availableWeightSum > 0) {
          const weightedTotal = availableComponents.reduce((sum, c) => sum + (c.score! * c.weight), 0);
          overallScore = Math.round((weightedTotal / availableWeightSum) * 10) / 10;
        }
      }

      const componentDetails = {
        attendance: {
          presentDays,
          halfDays,
          evaluatedDays: totalEvaluatedAttendanceDays,
          leaveDays,
        },
        tasks: {
          totalAssigned: tasks.length,
          completed: completedTasksCount,
          overdue: overdueTasksCount,
          onTimeCompleted: onTimeCompletedCount,
        },
        classes: {
          totalScheduledSlots: scheduledSlotsMonthApprox,
          completedTeachingSessions: teachingActivities.length,
        },
        operationalActivities: {
          adminCount,
          meetingCount,
          prepCount,
        },
        weightsApplied: weights,
      };

      const explanation =
        dataCompleteness === 'INSUFFICIENT_DATA'
          ? 'Insufficient historical attendance, schedule, or task data in database for reliable performance evaluation.'
          : `Deterministic performance evaluation calculated from ${availableComponents.length} measurable metrics (Attendance: ${attendanceScore ?? 'N/A'}%, Tasks: ${taskCompletionScore ?? 'N/A'}%, On-Time: ${onTimeCompletionScore ?? 'N/A'}%, Class Coverage: ${classCompletionScore ?? 'N/A'}%, Operations: ${operationalActivityScore ?? 'N/A'}%).`;

      // 6. Persist in Performance table
      const existingPerf = await db.performance.findFirst({
        where: {
          staff_id: staff.id,
          period_start: {
            gte: new Date(start.getTime() - 86400000),
            lte: new Date(start.getTime() + 86400000),
          },
        },
      });

      const metadataStr = JSON.stringify({
        componentDetails,
        explanation,
        calculatedAt: now.toISOString(),
      });

      if (existingPerf) {
        await db.performance.update({
          where: { id: existingPerf.id },
          data: {
            attendance_score: attendanceScore,
            task_completion_score: taskCompletionScore,
            on_time_completion_score: onTimeCompletionScore,
            class_completion_score: classCompletionScore,
            operational_activity_score: operationalActivityScore,
            overall_score: overallScore,
            data_completeness: dataCompleteness,
            calculation_version: 'v8.0-deterministic',
            metadata: metadataStr,
          },
        });
      } else {
        await db.performance.create({
          data: {
            staff_id: staff.id,
            period_start: start,
            period_end: end,
            attendance_score: attendanceScore,
            task_completion_score: taskCompletionScore,
            on_time_completion_score: onTimeCompletionScore,
            class_completion_score: classCompletionScore,
            operational_activity_score: operationalActivityScore,
            overall_score: overallScore,
            data_completeness: dataCompleteness,
            calculation_version: 'v8.0-deterministic',
            metadata: metadataStr,
          },
        });
      }

      return {
        staffId: staff.id,
        staffName: staff.full_name,
        departmentId: staff.department_id,
        departmentName: staff.department?.name,
        periodStart: start,
        periodEnd: end,
        attendanceScore,
        taskCompletionScore,
        onTimeCompletionScore,
        classCompletionScore,
        operationalActivityScore,
        overallScore,
        dataCompleteness,
        calculationVersion: 'v8.0-deterministic',
        componentDetails,
        explanation,
        calculatedAt: now,
      };
    } catch (error) {
      logger.error('Failed to calculate staff performance', error, 'PERFORMANCE_CALC_ERROR');
      return null;
    }
  }

  /**
   * Recalculates performance for all active staff members.
   */
  async recalculateAllStaffPerformance(): Promise<{ processed: number }> {
    const staffMembers = await prisma.staff.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    let processed = 0;
    for (const staff of staffMembers) {
      const res = await this.calculateStaffPerformance(staff.id);
      if (res) processed++;
    }

    return { processed };
  }

  /**
   * Retrieves performance history for a staff member.
   */
  async getStaffPerformanceHistory(staffId: string, limit = 12) {
    return await prisma.performance.findMany({
      where: { staff_id: staffId },
      take: limit,
      orderBy: { period_start: 'desc' },
    });
  }
}

export const performanceService = new PerformanceService();
