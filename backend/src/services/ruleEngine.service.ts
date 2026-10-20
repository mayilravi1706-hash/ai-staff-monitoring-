import { TaskStatus, TaskPriority, AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { configService } from './config.service';
import { operationalAlertService, CreateOperationalAlertInput } from './operationalAlert.service';
import { notificationService } from './notification.service';
import { timeToMinutes } from '../modules/timetable/timetable.validation';

export interface RuleEvaluationResult {
  ruleName: string;
  evaluatedCount: number;
  alertsGenerated: number;
  details: string[];
}

export interface TimetableConflictItem {
  type: 'STAFF_OVERLAP' | 'CLASS_OVERLAP' | 'INVALID_TIME' | 'DUPLICATE_ENTRY';
  ruleIdentifier: string;
  severity: 'HIGH' | 'CRITICAL';
  description: string;
  entryA: {
    id: string;
    staffName: string;
    className: string;
    subjectName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
  };
  entryB?: {
    id: string;
    staffName: string;
    className: string;
    subjectName: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
  };
}

export class RuleEngineService {
  /**
   * SECTION 4: Deterministic Class Monitoring Rule
   */
  async evaluateClassMonitoring(
    referenceDate = new Date(),
    targetStaffId?: string
  ): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleName: 'RULE_CLASS_MONITORING',
      evaluatedCount: 0,
      alertsGenerated: 0,
      details: [],
    };

    try {
      const gracePeriodMinutes = await configService.getConfigValue('classMonitoringGracePeriodMinutes', 10);
      const jsDay = referenceDate.getDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;
      const currentHours = referenceDate.getHours();
      const currentMinutes = referenceDate.getMinutes();
      const nowMinutes = currentHours * 60 + currentMinutes;

      const todayStart = new Date(referenceDate);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(referenceDate);
      todayEnd.setHours(23, 59, 59, 999);
      const dateStr = referenceDate.toISOString().split('T')[0];

      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      if (!activeYear) {
        result.details.push('No active academic year found for class monitoring.');
        return result;
      }

      const whereCondition: any = {
        academic_year_id: activeYear.id,
        day_of_week: dayOfWeek,
        status: 'SCHEDULED',
      };
      if (targetStaffId) {
        whereCondition.staff_id = targetStaffId;
      }

      const scheduledEntries = await prisma.timetable.findMany({
        where: whereCondition,
        include: {
          staff: {
            include: { department: true },
          },
          class: true,
          subject: true,
        },
      });

      result.evaluatedCount = scheduledEntries.length;

      for (const entry of scheduledEntries) {
        const startMin = timeToMinutes(entry.start_time);
        const endMin = timeToMinutes(entry.end_time);
        const thresholdMinutes = startMin + gracePeriodMinutes;

        // FEATURE 4: Send staff class start reminder notification once at class start
        if (nowMinutes >= startMin && nowMinutes <= endMin + 15) {
          const reminderDedupKey = `REMINDER_${entry.id}`;
          const existingReminder = await prisma.notification.findFirst({
            where: {
              recipient_user_id: entry.staff.user_id,
              type: 'CLASS_REMINDER',
              related_entity: 'TIMETABLE',
              related_entity_id: entry.id,
              created_at: { gte: todayStart, lte: todayEnd },
            },
          });

          if (!existingReminder && entry.staff.user_id) {
            await notificationService.createNotification({
              recipientUserId: entry.staff.user_id,
              type: 'CLASS_REMINDER',
              title: 'Class Reminder',
              message: `Scheduled class: ${entry.subject.code} - ${entry.class.name} starts now. Please update your current activity.`,
              relatedEntity: 'TIMETABLE',
              relatedEntityId: entry.id,
            });

            await prisma.auditLog.create({
              data: {
                user_id: entry.staff.user_id,
                action: 'CLASS_REMINDER_GENERATED',
                entity_type: 'TIMETABLE',
                entity_id: entry.id,
                after_value: JSON.stringify({
                  staffId: entry.staff_id,
                  class: entry.class.name,
                  subject: entry.subject.code,
                  startTime: entry.start_time,
                  endTime: entry.end_time,
                }),
              },
            });
          }
        }

        // FEATURE 5 & 6: 10-Minute Grace Period evaluation
        if (nowMinutes >= thresholdMinutes && nowMinutes <= endMin + 60) {
          // 1. Check if staff is on approved leave today
          const hasApprovedLeave = await prisma.leaveRequest.findFirst({
            where: {
              staff_id: entry.staff_id,
              status: 'APPROVED',
              start_date: { lte: todayEnd },
              end_date: { gte: todayStart },
            },
          });

          if (hasApprovedLeave) {
            continue;
          }

          // 2. Check valid recorded activity (Teaching, Meeting, Preparing Class, Administrative Work, Available, Break, Leave)
          const validRecordedActivity = await prisma.activity.findFirst({
            where: {
              staff_id: entry.staff_id,
              start_time: { gte: todayStart, lte: todayEnd },
              OR: [
                { timetable_id: entry.id },
                {
                  AND: [{ class_id: entry.class_id }, { subject_id: entry.subject_id }],
                },
              ],
            },
          });

          const dedupKey = `CLASS_UNRECORDED:${entry.id}:${dateStr}`;

          if (!validRecordedActivity) {
            const isPastEnd = nowMinutes > endMin;
            const severity = isPastEnd ? 'HIGH' : 'MEDIUM';

            const alertInput: CreateOperationalAlertInput = {
              alertType: 'CLASS_ACTIVITY_NOT_RECORDED',
              severity,
              dedupKey,
              ruleIdentifier: 'RULE_CLASS_ACTIVITY_UNRECORDED_GRACE',
              title: 'Scheduled class activity has not been recorded.',
              message: `Scheduled class activity has not been recorded for ${entry.class.name} — ${entry.subject.code}, scheduled at ${entry.start_time} with the assigned staff member. This is an operational monitoring signal based on the absence of a recorded activity update. It does not establish physical absence or unattended class.`,
              staffId: entry.staff_id,
              departmentId: entry.class.department_id || entry.staff.department_id,
              timetableId: entry.id,
              evidence: {
                timetableId: entry.id,
                className: entry.class.name,
                subjectName: entry.subject.name,
                subjectCode: entry.subject.code,
                staffName: entry.staff.full_name,
                staffId: entry.staff.staff_id,
                startTime: entry.start_time,
                endTime: entry.end_time,
                serverEvaluationTime: referenceDate.toISOString(),
                gracePeriodMinutes,
                approvedLeaveFound: false,
                recordedActivityFound: false,
                statement:
                  'This is an operational monitoring signal based on the absence of a recorded activity update. It does not establish physical absence or unattended class.',
              },
              notifyAdmins: true,
            };

            const alertRes = await operationalAlertService.upsertAlert(alertInput);
            if (alertRes && alertRes.created) {
              result.alertsGenerated++;

              // Also create/update ClassMonitoringAlert
              await prisma.classMonitoringAlert.upsert({
                where: {
                  timetable_id_alert_date: {
                    timetable_id: entry.id,
                    alert_date: todayStart,
                  },
                },
                update: {
                  status: 'ACTIVE',
                  message: alertInput.message,
                },
                create: {
                  staff_id: entry.staff_id,
                  timetable_id: entry.id,
                  class_id: entry.class_id,
                  subject_id: entry.subject_id,
                  alert_date: todayStart,
                  expected_start_time: entry.start_time,
                  expected_end_time: entry.end_time,
                  rule_name: 'UNRECORDED_CLASS_ACTIVITY',
                  title: 'Scheduled class activity has not been recorded.',
                  message: alertInput.message,
                  status: 'ACTIVE',
                },
              });

              // Send admin notification
              await notificationService.notifyAdmins({
                type: 'CLASS_ACTIVITY_NOT_RECORDED',
                title: `Scheduled class activity has not been recorded for ${entry.staff.full_name}.`,
                message: `Scheduled class activity has not been recorded for ${entry.staff.full_name}. Staff: ${entry.staff.full_name}, Class: ${entry.class.name}, Subject: ${entry.subject.code}, Scheduled time: ${entry.start_time} - ${entry.end_time}. The scheduled class activity has not been recorded within the configured ${gracePeriodMinutes}-minute monitoring window. This is an operational monitoring signal and does not establish staff absence or unattended class.`,
                relatedEntity: 'TIMETABLE',
                relatedEntityId: entry.id,
              });

              await prisma.auditLog.create({
                data: {
                  user_id: null,
                  action: 'OPERATIONAL_ALERT_GENERATED',
                  entity_type: 'OPERATIONAL_ALERT',
                  entity_id: entry.id,
                  after_value: JSON.stringify({
                    timetableId: entry.id,
                    staffId: entry.staff_id,
                    class: entry.class.name,
                    subject: entry.subject.code,
                    rule: 'RULE_CLASS_ACTIVITY_UNRECORDED_GRACE',
                  }),
                },
              });
            }
          } else {
            // Activity is present, resolve any open alert for this session
            await operationalAlertService.resolveByDedupKey(
              dedupKey,
              `Valid activity recorded: ${validRecordedActivity.activity_status} at ${validRecordedActivity.start_time.toISOString()}`
            );

            // Also resolve in class_monitoring_alerts
            await prisma.classMonitoringAlert.updateMany({
              where: {
                timetable_id: entry.id,
                alert_date: todayStart,
                status: 'ACTIVE',
              },
              data: {
                status: 'RESOLVED',
                resolved_at: new Date(),
              },
            });

            await prisma.auditLog.create({
              data: {
                user_id: null,
                action: 'ALERT_RESOLVED',
                entity_type: 'OPERATIONAL_ALERT',
                entity_id: entry.id,
                after_value: JSON.stringify({
                  dedupKey,
                  resolvedActivityStatus: validRecordedActivity.activity_status,
                }),
              },
            });
          }
        }
      }
    } catch (error) {
      logger.error('Class monitoring rule evaluation failed', error, 'RULE_ENGINE_ERROR');
      result.details.push(`Error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * SECTION 9: Deterministic Task Risk Analysis Rule
   */
  async evaluateTaskRisks(referenceDate = new Date()): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleName: 'RULE_TASK_RISK_ANALYSIS',
      evaluatedCount: 0,
      alertsGenerated: 0,
      details: [],
    };

    try {
      const dueSoonHours = await configService.getConfigValue('taskDueSoonThresholdHours', 24);
      const now = referenceDate.getTime();
      const dueSoonThresholdTime = now + dueSoonHours * 60 * 60 * 1000;
      const dateStr = referenceDate.toISOString().split('T')[0];

      // 1. Sync overdue tasks status in database deterministically
      await prisma.task.updateMany({
        where: {
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          due_date: { lt: referenceDate },
        },
        data: {
          status: TaskStatus.OVERDUE,
        },
      });

      // 2. Fetch all active/overdue tasks
      const activeTasks = await prisma.task.findMany({
        where: {
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] },
        },
        include: {
          assigned_staff: {
            include: { department: true },
          },
        },
      });

      result.evaluatedCount = activeTasks.length;

      for (const task of activeTasks) {
        const dueTime = new Date(task.due_date).getTime();
        const isOverdue = now > dueTime;
        const isDueSoon = !isOverdue && dueTime <= dueSoonThresholdTime;

        // Rule A: URGENT + OVERDUE -> CRITICAL Operational Risk
        if (isOverdue && task.priority === TaskPriority.URGENT) {
          const dedupKey = `TASK_RISK:${task.id}:RULE_TASK_OVERDUE_URGENT:${dateStr}`;
          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'TASK_OVERDUE',
            severity: 'CRITICAL',
            dedupKey,
            ruleIdentifier: 'RULE_TASK_OVERDUE_URGENT',
            title: `[RULE-BASED TASK RISK] Urgent task overdue: "${task.title}"`,
            message: `Urgent task "${task.title}" assigned to ${task.assigned_staff.full_name} is overdue since ${task.due_date.toISOString().split('T')[0]}. Priority: URGENT. Current status: OVERDUE.`,
            staffId: task.assigned_staff_id,
            departmentId: task.assigned_staff.department_id,
            taskId: task.id,
            evidence: {
              taskId: task.id,
              title: task.title,
              priority: task.priority,
              status: task.status,
              dueDate: task.due_date.toISOString(),
              assignedStaff: task.assigned_staff.full_name,
              evaluatedAt: referenceDate.toISOString(),
              riskClassification: 'CRITICAL_OPERATIONAL_RISK',
            },
            notifyAdmins: true,
          });
          if (alertRes && alertRes.created) result.alertsGenerated++;
        }
        // Rule B: HIGH/MEDIUM + OVERDUE -> HIGH Operational Risk
        else if (isOverdue) {
          const severity = task.priority === TaskPriority.HIGH ? 'HIGH' : 'MEDIUM';
          const dedupKey = `TASK_RISK:${task.id}:RULE_TASK_OVERDUE:${dateStr}`;
          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'TASK_OVERDUE',
            severity,
            dedupKey,
            ruleIdentifier: 'RULE_TASK_OVERDUE',
            title: `[RULE-BASED TASK RISK] Task overdue: "${task.title}"`,
            message: `Task "${task.title}" assigned to ${task.assigned_staff.full_name} is overdue. Due date was ${task.due_date.toISOString().split('T')[0]}. Priority: ${task.priority}.`,
            staffId: task.assigned_staff_id,
            departmentId: task.assigned_staff.department_id,
            taskId: task.id,
            evidence: {
              taskId: task.id,
              title: task.title,
              priority: task.priority,
              status: task.status,
              dueDate: task.due_date.toISOString(),
              assignedStaff: task.assigned_staff.full_name,
              riskClassification: 'OVERDUE_OPERATIONAL_RISK',
            },
            notifyAdmins: severity === 'HIGH',
          });
          if (alertRes && alertRes.created) result.alertsGenerated++;
        }
        // Rule C: HIGH/URGENT priority + DUE SOON (< configured threshold) -> MEDIUM/HIGH Operational Risk
        else if (isDueSoon && (task.priority === TaskPriority.URGENT || task.priority === TaskPriority.HIGH)) {
          const hoursLeft = Math.max(0, Math.round((dueTime - now) / (1000 * 60 * 60)));
          const severity = task.priority === TaskPriority.URGENT ? 'HIGH' : 'MEDIUM';
          const dedupKey = `TASK_RISK:${task.id}:RULE_TASK_DUE_SOON:${dateStr}`;

          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'TASK_HIGH_RISK',
            severity,
            dedupKey,
            ruleIdentifier: 'RULE_TASK_DUE_SOON_HIGH_PRIORITY',
            title: `[RULE-BASED TASK RISK] High-priority task due in ${hoursLeft} hours: "${task.title}"`,
            message: `Task "${task.title}" (${task.priority} priority) is approaching its deadline in approximately ${hoursLeft} hours with status ${task.status}.`,
            staffId: task.assigned_staff_id,
            departmentId: task.assigned_staff.department_id,
            taskId: task.id,
            evidence: {
              taskId: task.id,
              title: task.title,
              priority: task.priority,
              status: task.status,
              dueDate: task.due_date.toISOString(),
              hoursRemaining: hoursLeft,
              assignedStaff: task.assigned_staff.full_name,
            },
            notifyAdmins: false,
          });
          if (alertRes && alertRes.created) result.alertsGenerated++;
        }
      }
    } catch (error) {
      logger.error('Task risk rule evaluation failed', error, 'RULE_ENGINE_ERROR');
      result.details.push(`Error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * SECTION 10 & 11: Deterministic Attendance Pattern Analysis Rule
   * Evaluates attendance records with strict Data Sufficiency checks and neutral language.
   */
  async evaluateAttendancePatterns(referenceDate = new Date()): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleName: 'RULE_ATTENDANCE_PATTERN_ANALYSIS',
      evaluatedCount: 0,
      alertsGenerated: 0,
      details: [],
    };

    try {
      const periodDays = await configService.getConfigValue('attendanceAnalysisPeriodDays', 30);
      const minDataDays = await configService.getConfigValue('attendanceMinDataDays', 10);
      const exceptionThreshold = await configService.getConfigValue('attendanceExceptionThreshold', 4);

      const periodEnd = new Date(referenceDate);
      periodEnd.setHours(23, 59, 59, 999);

      const periodStart = new Date(referenceDate);
      periodStart.setDate(periodStart.getDate() - periodDays);
      periodStart.setHours(0, 0, 0, 0);

      const periodStartStr = periodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      // Fetch all active staff
      const staffList = await prisma.staff.findMany({
        where: { status: 'ACTIVE' },
        include: { department: true },
      });

      result.evaluatedCount = staffList.length;

      for (const staff of staffList) {
        // Fetch all attendance records in period
        const attendanceRecords = await prisma.attendance.findMany({
          where: {
            staff_id: staff.id,
            attendance_date: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
        });

        // SECTION 11: DATA SUFFICIENCY CHECK
        if (attendanceRecords.length < minDataDays) {
          // Insufficient data: Do NOT generate pattern alert. Record informational note.
          continue;
        }

        const absentRecords = attendanceRecords.filter((r) => r.status === AttendanceStatus.ABSENT);
        const halfDayRecords = attendanceRecords.filter((r) => r.status === AttendanceStatus.HALF_DAY);
        const exceptionCount = absentRecords.length + halfDayRecords.length;

        if (exceptionCount >= exceptionThreshold) {
          const dedupKey = `ATTENDANCE_PATTERN:${staff.id}:${periodStartStr}:${periodEndStr}`;
          const severity = exceptionCount >= exceptionThreshold * 2 ? 'HIGH' : 'MEDIUM';

          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'ATTENDANCE_PATTERN',
            severity,
            dedupKey,
            ruleIdentifier: 'RULE_ATTENDANCE_EXCEPTION_CONCENTRATION',
            title: 'Attendance pattern requires review.',
            message: `Attendance pattern requires review for ${staff.full_name}. ${exceptionCount} attendance exception records (${absentRecords.length} absent, ${halfDayRecords.length} half-day) were recorded in the past ${periodDays} days.`,
            staffId: staff.id,
            departmentId: staff.department_id,
            evidence: {
              staffId: staff.id,
              staffName: staff.full_name,
              analysisPeriodDays: periodDays,
              periodStartDate: periodStartStr,
              periodEndDate: periodEndStr,
              totalRecordsEvaluated: attendanceRecords.length,
              absentRecordCount: absentRecords.length,
              halfDayRecordCount: halfDayRecords.length,
              totalExceptionCount: exceptionCount,
              thresholdApplied: exceptionThreshold,
              dataSufficiencyMet: true,
              statement:
                'This operational review signal is generated deterministically and does not constitute disciplinary judgment or misconduct inference.',
            },
            notifyAdmins: severity === 'HIGH',
          });

          if (alertRes && alertRes.created) {
            result.alertsGenerated++;
          }
        }
      }
    } catch (error) {
      logger.error('Attendance pattern evaluation failed', error, 'RULE_ENGINE_ERROR');
      result.details.push(`Error: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * SECTION 12: Deterministic Timetable Conflict Analysis Rule
   * Detects staff overlaps, class overlaps, and invalid time bounds across active timetable records.
   */
  async evaluateTimetableConflicts(): Promise<{
    evaluation: RuleEvaluationResult;
    conflicts: TimetableConflictItem[];
  }> {
    const result: RuleEvaluationResult = {
      ruleName: 'RULE_TIMETABLE_CONFLICT_ANALYSIS',
      evaluatedCount: 0,
      alertsGenerated: 0,
      details: [],
    };
    const detectedConflicts: TimetableConflictItem[] = [];

    try {
      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      if (!activeYear) {
        result.details.push('No active academic year found for timetable conflict check.');
        return { evaluation: result, conflicts: [] };
      }

      const timetableEntries = await prisma.timetable.findMany({
        where: {
          academic_year_id: activeYear.id,
          status: 'SCHEDULED',
        },
        include: {
          staff: true,
          class: true,
          subject: true,
        },
      });

      result.evaluatedCount = timetableEntries.length;

      // Check 1: Invalid time bounds (start >= end)
      for (const entry of timetableEntries) {
        const startMin = timeToMinutes(entry.start_time);
        const endMin = timeToMinutes(entry.end_time);

        if (startMin >= endMin) {
          const dedupKey = `TIMETABLE_CONFLICT:INVALID_TIME:${entry.id}`;
          const conflictItem: TimetableConflictItem = {
            type: 'INVALID_TIME',
            ruleIdentifier: 'RULE_TIMETABLE_INVALID_TIME_BOUNDS',
            severity: 'HIGH',
            description: `Invalid schedule time bounds: Start time ${entry.start_time} is after or equal to end time ${entry.end_time} for class ${entry.class.name}.`,
            entryA: {
              id: entry.id,
              staffName: entry.staff.full_name,
              className: entry.class.name,
              subjectName: entry.subject.name,
              dayOfWeek: entry.day_of_week,
              startTime: entry.start_time,
              endTime: entry.end_time,
              room: entry.room,
            },
          };
          detectedConflicts.push(conflictItem);

          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'TIMETABLE_CONFLICT',
            severity: 'HIGH',
            dedupKey,
            ruleIdentifier: 'RULE_TIMETABLE_INVALID_TIME_BOUNDS',
            title: 'Timetable schedule conflict: Invalid time bounds',
            message: conflictItem.description,
            staffId: entry.staff_id,
            departmentId: entry.class.department_id,
            timetableId: entry.id,
            evidence: conflictItem as any,
            notifyAdmins: true,
          });
          if (alertRes && alertRes.created) result.alertsGenerated++;
        }
      }

      // Check 2 & 3: Staff overlaps & Class overlaps
      for (let i = 0; i < timetableEntries.length; i++) {
        for (let j = i + 1; j < timetableEntries.length; j++) {
          const a = timetableEntries[i];
          const b = timetableEntries[j];

          // Must be same day of week to overlap
          if (a.day_of_week !== b.day_of_week) continue;

          const aStart = timeToMinutes(a.start_time);
          const aEnd = timeToMinutes(a.end_time);
          const bStart = timeToMinutes(b.start_time);
          const bEnd = timeToMinutes(b.end_time);

          // Check overlap: max(aStart, bStart) < min(aEnd, bEnd)
          const overlaps = Math.max(aStart, bStart) < Math.min(aEnd, bEnd);

          if (overlaps) {
            // Check Staff Overlap
            if (a.staff_id === b.staff_id) {
              const [id1, id2] = [a.id, b.id].sort();
              const dedupKey = `TIMETABLE_CONFLICT:STAFF_OVERLAP:${id1}:${id2}`;

              const conflictItem: TimetableConflictItem = {
                type: 'STAFF_OVERLAP',
                ruleIdentifier: 'RULE_TIMETABLE_STAFF_OVERLAP',
                severity: 'HIGH',
                description: `Staff scheduling conflict: ${a.staff.full_name} is assigned to overlapping sessions on Day ${a.day_of_week}: ${a.class.name} (${a.start_time}-${a.end_time}) and ${b.class.name} (${b.start_time}-${b.end_time}).`,
                entryA: {
                  id: a.id,
                  staffName: a.staff.full_name,
                  className: a.class.name,
                  subjectName: a.subject.name,
                  dayOfWeek: a.day_of_week,
                  startTime: a.start_time,
                  endTime: a.end_time,
                  room: a.room,
                },
                entryB: {
                  id: b.id,
                  staffName: b.staff.full_name,
                  className: b.class.name,
                  subjectName: b.subject.name,
                  dayOfWeek: b.day_of_week,
                  startTime: b.start_time,
                  endTime: b.end_time,
                  room: b.room,
                },
              };
              detectedConflicts.push(conflictItem);

              const alertRes = await operationalAlertService.upsertAlert({
                alertType: 'TIMETABLE_CONFLICT',
                severity: 'HIGH',
                dedupKey,
                ruleIdentifier: 'RULE_TIMETABLE_STAFF_OVERLAP',
                title: 'Timetable conflict: Staff scheduled in overlapping sessions',
                message: conflictItem.description,
                staffId: a.staff_id,
                departmentId: a.staff.department_id,
                timetableId: a.id,
                evidence: conflictItem as any,
                notifyAdmins: true,
              });
              if (alertRes && alertRes.created) result.alertsGenerated++;
            }

            // Check Class Overlap
            if (a.class_id === b.class_id) {
              const [id1, id2] = [a.id, b.id].sort();
              const dedupKey = `TIMETABLE_CONFLICT:CLASS_OVERLAP:${id1}:${id2}`;

              const conflictItem: TimetableConflictItem = {
                type: 'CLASS_OVERLAP',
                ruleIdentifier: 'RULE_TIMETABLE_CLASS_OVERLAP',
                severity: 'HIGH',
                description: `Class scheduling conflict: Class ${a.class.name} is assigned to simultaneous sessions on Day ${a.day_of_week}: ${a.subject.name} with ${a.staff.full_name} (${a.start_time}-${a.end_time}) and ${b.subject.name} with ${b.staff.full_name} (${b.start_time}-${b.end_time}).`,
                entryA: {
                  id: a.id,
                  staffName: a.staff.full_name,
                  className: a.class.name,
                  subjectName: a.subject.name,
                  dayOfWeek: a.day_of_week,
                  startTime: a.start_time,
                  endTime: a.end_time,
                  room: a.room,
                },
                entryB: {
                  id: b.id,
                  staffName: b.staff.full_name,
                  className: b.class.name,
                  subjectName: b.subject.name,
                  dayOfWeek: b.day_of_week,
                  startTime: b.start_time,
                  endTime: b.end_time,
                  room: b.room,
                },
              };
              detectedConflicts.push(conflictItem);

              const alertRes = await operationalAlertService.upsertAlert({
                alertType: 'TIMETABLE_CONFLICT',
                severity: 'HIGH',
                dedupKey,
                ruleIdentifier: 'RULE_TIMETABLE_CLASS_OVERLAP',
                title: 'Timetable conflict: Class scheduled in simultaneous sessions',
                message: conflictItem.description,
                departmentId: a.class.department_id,
                timetableId: a.id,
                evidence: conflictItem as any,
                notifyAdmins: true,
              });
              if (alertRes && alertRes.created) result.alertsGenerated++;
            }
          }
        }
      }
    } catch (error) {
      logger.error('Timetable conflict evaluation failed', error, 'RULE_ENGINE_ERROR');
      result.details.push(`Error: ${(error as Error).message}`);
    }

    return { evaluation: result, conflicts: detectedConflicts };
  }

  /**
   * SECTION 13: Deterministic Workload Concentration Rule
   */
  async evaluateWorkloadConcentration(referenceDate = new Date()): Promise<RuleEvaluationResult> {
    const result: RuleEvaluationResult = {
      ruleName: 'RULE_WORKLOAD_CONCENTRATION_ANALYSIS',
      evaluatedCount: 0,
      alertsGenerated: 0,
      details: [],
    };

    try {
      const maxWeeklyHours = await configService.getConfigValue('workloadMaxWeeklyHours', 24);
      const maxDailyClasses = await configService.getConfigValue('workloadMaxClassesPerDay', 5);

      const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
      if (!activeYear) return result;

      const staffMembers = await prisma.staff.findMany({
        where: { status: 'ACTIVE' },
        include: {
          department: true,
          timetable: {
            where: {
              academic_year_id: activeYear.id,
              status: 'SCHEDULED',
            },
          },
        },
      });

      result.evaluatedCount = staffMembers.length;
      const yearWeek = `${referenceDate.getFullYear()}-W${Math.ceil(referenceDate.getDate() / 7)}`;

      for (const staff of staffMembers) {
        let weeklyMinutes = 0;
        const classesByDay: Record<number, number> = {};

        for (const slot of staff.timetable) {
          const startMin = timeToMinutes(slot.start_time);
          const endMin = timeToMinutes(slot.end_time);
          const duration = Math.max(0, endMin - startMin);
          weeklyMinutes += duration;

          classesByDay[slot.day_of_week] = (classesByDay[slot.day_of_week] || 0) + 1;
        }

        const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
        const maxClassesOnAnyDay = Math.max(0, ...Object.values(classesByDay));

        // Rule: Weekly teaching hours exceed configured threshold
        if (weeklyHours > maxWeeklyHours) {
          const dedupKey = `WORKLOAD_CONCENTRATION:${staff.id}:RULE_WORKLOAD_WEEKLY_HOURS:${yearWeek}`;
          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'WORKLOAD_CONCENTRATION',
            severity: 'MEDIUM',
            dedupKey,
            ruleIdentifier: 'RULE_WORKLOAD_WEEKLY_HOURS_EXCEEDED',
            title: 'High teaching workload concentration detected',
            message: `Staff member ${staff.full_name} is scheduled for ${weeklyHours} weekly teaching hours, exceeding the operational threshold of ${maxWeeklyHours} hours.`,
            staffId: staff.id,
            departmentId: staff.department_id,
            evidence: {
              staffId: staff.id,
              staffName: staff.full_name,
              scheduledWeeklyHours: weeklyHours,
              configuredThresholdHours: maxWeeklyHours,
              totalSlots: staff.timetable.length,
              evaluationPeriod: yearWeek,
            },
            notifyAdmins: false,
          });
          if (alertRes && alertRes.created) result.alertsGenerated++;
        }

        // Rule: Daily class density exceeds threshold
        if (maxClassesOnAnyDay > maxDailyClasses) {
          const dedupKey = `WORKLOAD_CONCENTRATION:${staff.id}:RULE_WORKLOAD_DAILY_DENSITY:${yearWeek}`;
          const alertRes = await operationalAlertService.upsertAlert({
            alertType: 'WORKLOAD_CONCENTRATION',
            severity: 'LOW',
            dedupKey,
            ruleIdentifier: 'RULE_WORKLOAD_DAILY_DENSITY_HIGH',
            title: 'High daily class schedule density detected',
            message: `Staff member ${staff.full_name} is scheduled for ${maxClassesOnAnyDay} classes on a single day, exceeding the threshold of ${maxDailyClasses} classes.`,
            staffId: staff.id,
            departmentId: staff.department_id,
            evidence: {
              staffId: staff.id,
              staffName: staff.full_name,
              maxClassesOnSingleDay: maxClassesOnAnyDay,
              configuredDailyThreshold: maxDailyClasses,
              classesByDay,
            },
            notifyAdmins: false,
          });
          if (alertRes && alertRes.created) result.alertsGenerated++;
        }
      }
    } catch (error) {
      logger.error('Workload concentration evaluation failed', error, 'RULE_ENGINE_ERROR');
      result.details.push(`Error: ${(error as Error).message}`);
    }

    return result;
  }
}

export const ruleEngineService = new RuleEngineService();
