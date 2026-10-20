import { prisma } from '../config/database';
import { timeToMinutes } from '../modules/timetable/timetable.validation';

export interface ExpectedClassInfo {
  hasCurrentClass: boolean;
  currentClass: {
    timetableId: string;
    classId: string;
    className: string;
    section?: string | null;
    departmentId?: string;
    departmentName?: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    status: 'EXPECTED';
    timeStatus: 'CURRENT' | 'UPCOMING' | 'COMPLETED' | 'NO_CLASS';
  } | null;
  upcomingClass: {
    timetableId: string;
    classId: string;
    className: string;
    section?: string | null;
    departmentName?: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    startTime: string;
    endTime: string;
    room?: string | null;
    timeStatus: 'UPCOMING';
  } | null;
  todaySchedule: Array<{
    timetableId: string;
    class: {
      id: string;
      name: string;
      section?: string | null;
    };
    subject: {
      id: string;
      name: string;
      code: string;
    };
    room?: string | null;
    startTime: string;
    endTime: string;
    timeStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    coverage: 'COVERED' | 'NOT_RECORDED' | 'NOT_SCHEDULED';
    recordedActivity?: {
      id: string;
      status: string;
      startTime: string;
      endTime?: string | null;
      description?: string | null;
    } | null;
  }>;
  serverTime: {
    iso: string;
    timeStr: string;
    dayOfWeek: number;
    dayName: string;
    dateStr: string;
  };
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export class ClassMonitoringService {
  /**
   * Helper to get start and end of day in UTC for consistent date matching
   */
  getDayRange(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Returns current day_of_week as 1=Monday, ..., 7=Sunday
   */
  getSystemDayOfWeek(date = new Date()): number {
    const jsDay = date.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    return jsDay === 0 ? 7 : jsDay;
  }

  /**
   * Retrieves the configured class monitoring grace period (in minutes).
   * Defaults to 5 minutes if not configured.
   */
  async getGracePeriodMinutes(): Promise<number> {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES' },
      });
      if (setting && setting.value) {
        const parsed = parseInt(setting.value, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    } catch {
      // Default to 10 minutes on error
    }
    return 10;
  }

  /**
   * Updates the configured grace period minutes.
   */
  async setGracePeriodMinutes(minutes: number, updatedByUserId?: string): Promise<number> {
    await prisma.setting.upsert({
      where: { key: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES' },
      update: {
        value: String(minutes),
        updated_by: updatedByUserId || null,
      },
      create: {
        key: 'CLASS_MONITORING_GRACE_PERIOD_MINUTES',
        value: String(minutes),
        data_type: 'NUMBER',
        updated_by: updatedByUserId || null,
      },
    });
    return minutes;
  }

  /**
   * SECTION 1 & 2: TIMETABLE -> EXPECTED CLASS & CURRENT CLASS STATUS ENGINE
   * Deterministically calculates expected, current, upcoming, and today's schedule for a staff member using SERVER time.
   */
  async getCurrentExpectedClass(staffId: string, referenceDate = new Date()): Promise<ExpectedClassInfo> {
    const dayOfWeek = this.getSystemDayOfWeek(referenceDate);
    const dayName = DAY_NAMES[referenceDate.getDay()];
    const currentHours = referenceDate.getHours();
    const currentMinutes = referenceDate.getMinutes();
    const nowMinutes = currentHours * 60 + currentMinutes;
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

    const { start: todayStart, end: todayEnd } = this.getDayRange(referenceDate);

    // 1. Fetch active academic year
    const activeYear = await prisma.academicYear.findFirst({
      where: { active: true },
    });

    if (!activeYear) {
      return {
        hasCurrentClass: false,
        currentClass: null,
        upcomingClass: null,
        todaySchedule: [],
        serverTime: {
          iso: referenceDate.toISOString(),
          timeStr: currentTimeStr,
          dayOfWeek,
          dayName,
          dateStr: referenceDate.toISOString().split('T')[0],
        },
      };
    }

    // 2. Fetch today's scheduled timetable slots for this staff member
    const timetableEntries = await prisma.timetable.findMany({
      where: {
        staff_id: staffId,
        academic_year_id: activeYear.id,
        day_of_week: dayOfWeek,
        status: 'SCHEDULED',
      },
      orderBy: { start_time: 'asc' },
      include: {
        class: {
          include: { department: true },
        },
        subject: true,
        staff: true,
      },
    });

    // 3. Fetch today's activities for this staff member to determine coverage
    const todayActivities = await prisma.activity.findMany({
      where: {
        staff_id: staffId,
        start_time: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      orderBy: { start_time: 'desc' },
    });

    let currentClassItem: ExpectedClassInfo['currentClass'] = null;
    let upcomingClassItem: ExpectedClassInfo['upcomingClass'] = null;

    const todaySchedule: ExpectedClassInfo['todaySchedule'] = [];

    for (const entry of timetableEntries) {
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);

      let timeStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED' = 'UPCOMING';
      if (nowMinutes >= startMin && nowMinutes <= endMin) {
        timeStatus = 'CURRENT';
      } else if (nowMinutes > endMin) {
        timeStatus = 'COMPLETED';
      } else {
        timeStatus = 'UPCOMING';
      }

      // Check matching teaching activity
      const matchingActivity = todayActivities.find((act) => {
        if (act.activity_status !== 'TEACHING') return false;
        if (act.timetable_id && act.timetable_id === entry.id) return true;
        if (act.class_id === entry.class_id && act.subject_id === entry.subject_id) {
          return true;
        }
        return false;
      });

      // SECTION 10: Class Coverage calculation
      // COVERED: appropriate teaching activity recorded
      // NOT_RECORDED: class time has arrived or passed, but no teaching activity recorded
      // NOT_SCHEDULED: upcoming or outside operational window
      let coverage: 'COVERED' | 'NOT_RECORDED' | 'NOT_SCHEDULED' = 'NOT_SCHEDULED';

      if (matchingActivity) {
        coverage = 'COVERED';
      } else if (timeStatus === 'COMPLETED' || timeStatus === 'CURRENT') {
        coverage = 'NOT_RECORDED';
      } else {
        coverage = 'NOT_SCHEDULED';
      }

      const scheduleEntry = {
        timetableId: entry.id,
        class: {
          id: entry.class.id,
          name: entry.class.name,
          section: entry.class.section,
        },
        subject: {
          id: entry.subject.id,
          name: entry.subject.name,
          code: entry.subject.code,
        },
        room: entry.room,
        startTime: entry.start_time,
        endTime: entry.end_time,
        timeStatus,
        coverage,
        recordedActivity: matchingActivity
          ? {
              id: matchingActivity.id,
              status: matchingActivity.activity_status,
              startTime: matchingActivity.start_time.toISOString(),
              endTime: matchingActivity.actual_end_time?.toISOString() || null,
              description: matchingActivity.description,
            }
          : null,
      };

      todaySchedule.push(scheduleEntry);

      if (timeStatus === 'CURRENT' && !currentClassItem) {
        currentClassItem = {
          timetableId: entry.id,
          classId: entry.class.id,
          className: entry.class.name,
          section: entry.class.section,
          departmentId: entry.class.department_id,
          departmentName: entry.class.department?.name,
          subjectId: entry.subject.id,
          subjectName: entry.subject.name,
          subjectCode: entry.subject.code,
          startTime: entry.start_time,
          endTime: entry.end_time,
          room: entry.room,
          status: 'EXPECTED',
          timeStatus: 'CURRENT',
        };
      }

      if (timeStatus === 'UPCOMING' && !upcomingClassItem) {
        upcomingClassItem = {
          timetableId: entry.id,
          classId: entry.class.id,
          className: entry.class.name,
          section: entry.class.section,
          departmentName: entry.class.department?.name,
          subjectId: entry.subject.id,
          subjectName: entry.subject.name,
          subjectCode: entry.subject.code,
          startTime: entry.start_time,
          endTime: entry.end_time,
          room: entry.room,
          timeStatus: 'UPCOMING',
        };
      }
    }

    return {
      hasCurrentClass: currentClassItem !== null,
      currentClass: currentClassItem,
      upcomingClass: upcomingClassItem,
      todaySchedule,
      serverTime: {
        iso: referenceDate.toISOString(),
        timeStr: currentTimeStr,
        dayOfWeek,
        dayName,
        dateStr: referenceDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * SECTION 11, 12, 13: OPERATIONAL MONITORING SIGNALS ENGINE
   * Evaluates active class sessions and generates operational monitoring signals if grace period has passed
   * without a recorded teaching activity.
   *
   * IMPORTANT:
   * System MUST NOT state: "Staff is absent", "Teacher absent", or "Unattended class".
   * System MUST state: "Scheduled class activity has not been recorded."
   * Description: "This is an operational monitoring signal and does not establish unattended class or staff absence."
   * Duplicate Alert Prevention: Exactly 1 alert per timetable slot per date.
   */
  async evaluateOperationalMonitoringSignals(targetStaffId?: string, referenceDate = new Date()) {
    const dayOfWeek = this.getSystemDayOfWeek(referenceDate);
    const currentHours = referenceDate.getHours();
    const currentMinutes = referenceDate.getMinutes();
    const nowMinutes = currentHours * 60 + currentMinutes;

    const { start: todayStart, end: todayEnd } = this.getDayRange(referenceDate);
    const gracePeriodMinutes = await this.getGracePeriodMinutes();

    const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
    if (!activeYear) return [];

    const whereClause: any = {
      academic_year_id: activeYear.id,
      day_of_week: dayOfWeek,
      status: 'SCHEDULED',
    };

    if (targetStaffId) {
      whereClause.staff_id = targetStaffId;
    }

    const scheduledEntries = await prisma.timetable.findMany({
      where: whereClause,
      include: {
        staff: true,
        class: true,
        subject: true,
      },
    });

    const generatedAlerts: any[] = [];

    for (const entry of scheduledEntries) {
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);

      // Check if current time is within or past the grace period for this class
      // At least (startMin + gracePeriodMinutes) must have elapsed
      const thresholdMinutes = startMin + gracePeriodMinutes;

      if (nowMinutes >= thresholdMinutes && nowMinutes <= endMin + 30) {
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
          // Staff has legitimate approved leave; do not treat as unrecorded monitoring alert
          continue;
        }

        // 2. Check if a teaching activity exists for this slot today
        const existingActivity = await prisma.activity.findFirst({
          where: {
            staff_id: entry.staff_id,
            activity_status: 'TEACHING',
            start_time: {
              gte: todayStart,
              lte: todayEnd,
            },
            OR: [
              { timetable_id: entry.id },
              {
                AND: [{ class_id: entry.class_id }, { subject_id: entry.subject_id }],
              },
            ],
          },
        });

        if (!existingActivity) {
          // SECTION 13: DUPLICATE ALERT PREVENTION
          // Check if an alert already exists for this timetable entry and date
          const existingAlert = await prisma.classMonitoringAlert.findFirst({
            where: {
              timetable_id: entry.id,
              alert_date: todayStart,
            },
          });

          if (!existingAlert) {
            // Create operational monitoring signal
            const createdAlert = await prisma.classMonitoringAlert.create({
              data: {
                staff_id: entry.staff_id,
                timetable_id: entry.id,
                class_id: entry.class_id,
                subject_id: entry.subject_id,
                alert_date: todayStart,
                expected_start_time: entry.start_time,
                expected_end_time: entry.end_time,
                rule_name: 'UNRECORDED_CLASS_ACTIVITY',
                title: 'Scheduled class activity has not been recorded.',
                message: `Scheduled class activity has not been recorded for ${entry.class.name} (${entry.subject.name}) scheduled between ${entry.start_time} and ${entry.end_time}. This is an operational monitoring signal and does not establish unattended class or staff absence.`,
                status: 'ACTIVE',
              },
              include: {
                staff: {
                  select: {
                    id: true,
                    staff_id: true,
                    full_name: true,
                    designation: true,
                  },
                },
                class: true,
                subject: true,
              },
            });
            generatedAlerts.push(createdAlert);
          } else {
            generatedAlerts.push(existingAlert);
          }
        } else {
          // If teaching activity exists and alert was previously ACTIVE, resolve it automatically
          const existingAlert = await prisma.classMonitoringAlert.findFirst({
            where: {
              timetable_id: entry.id,
              alert_date: todayStart,
              status: 'ACTIVE',
            },
          });
          if (existingAlert) {
            await prisma.classMonitoringAlert.update({
              where: { id: existingAlert.id },
              data: {
                status: 'RESOLVED',
                resolved_at: new Date(),
              },
            });
          }
        }
      }
    }

    return generatedAlerts;
  }

  /**
   * Retrieves operational monitoring alerts with filtering and IDOR protection.
   */
  async getMonitoringAlerts(filters: {
    staffId?: string;
    status?: string;
    date?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = {};

    if (filters.staffId) {
      where.staff_id = filters.staffId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.date) {
      const { start, end } = this.getDayRange(filters.date);
      where.alert_date = { gte: start, lte: end };
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;

    const total = await prisma.classMonitoringAlert.count({ where });
    const alerts = await prisma.classMonitoringAlert.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      include: {
        staff: {
          select: {
            id: true,
            staff_id: true,
            full_name: true,
            designation: true,
            email: true,
          },
        },
        class: true,
        subject: true,
        timetable: true,
      },
    });

    return {
      alerts,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Institutional class coverage overview for a given date.
   */
  async getInstitutionalCoverage(referenceDate = new Date(), departmentId?: string) {
    const dayOfWeek = this.getSystemDayOfWeek(referenceDate);
    const { start: todayStart, end: todayEnd } = this.getDayRange(referenceDate);

    const activeYear = await prisma.academicYear.findFirst({ where: { active: true } });
    if (!activeYear) return { schedule: [], summary: { total: 0, covered: 0, notRecorded: 0, upcoming: 0 } };

    const timetableWhere: any = {
      academic_year_id: activeYear.id,
      day_of_week: dayOfWeek,
      status: 'SCHEDULED',
    };

    if (departmentId) {
      timetableWhere.class = { department_id: departmentId };
    }

    const timetableEntries = await prisma.timetable.findMany({
      where: timetableWhere,
      include: {
        staff: {
          select: {
            id: true,
            staff_id: true,
            full_name: true,
            designation: true,
          },
        },
        class: {
          include: { department: true },
        },
        subject: true,
      },
      orderBy: [{ start_time: 'asc' }],
    });

    const activities = await prisma.activity.findMany({
      where: {
        activity_status: 'TEACHING',
        start_time: { gte: todayStart, lte: todayEnd },
      },
    });

    const currentHours = referenceDate.getHours();
    const currentMinutes = referenceDate.getMinutes();
    const nowMinutes = currentHours * 60 + currentMinutes;

    let coveredCount = 0;
    let notRecordedCount = 0;
    let upcomingCount = 0;

    const schedule = timetableEntries.map((entry) => {
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);

      let timeStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED' = 'UPCOMING';
      if (nowMinutes >= startMin && nowMinutes <= endMin) {
        timeStatus = 'CURRENT';
      } else if (nowMinutes > endMin) {
        timeStatus = 'COMPLETED';
      }

      const matchingActivity = activities.find(
        (a) =>
          a.staff_id === entry.staff_id &&
          (a.timetable_id === entry.id ||
            (a.class_id === entry.class_id && a.subject_id === entry.subject_id))
      );

      let coverage: 'COVERED' | 'NOT_RECORDED' | 'NOT_SCHEDULED' = 'NOT_SCHEDULED';

      if (matchingActivity) {
        coverage = 'COVERED';
        coveredCount++;
      } else if (timeStatus === 'COMPLETED' || timeStatus === 'CURRENT') {
        coverage = 'NOT_RECORDED';
        notRecordedCount++;
      } else {
        coverage = 'NOT_SCHEDULED';
        upcomingCount++;
      }

      return {
        timetableId: entry.id,
        staff: entry.staff,
        class: entry.class,
        subject: entry.subject,
        startTime: entry.start_time,
        endTime: entry.end_time,
        room: entry.room,
        timeStatus,
        coverage,
        recordedActivityId: matchingActivity ? matchingActivity.id : null,
      };
    });

    return {
      date: referenceDate.toISOString().split('T')[0],
      dayOfWeek,
      totalSlots: timetableEntries.length,
      summary: {
        total: timetableEntries.length,
        covered: coveredCount,
        notRecorded: notRecordedCount,
        upcoming: upcomingCount,
      },
      schedule,
    };
  }
}

export const classMonitoringService = new ClassMonitoringService();
