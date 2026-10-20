import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { ruleEngineService } from './ruleEngine.service';
import { tasksService } from './tasks.service';
import { workloadService } from './workload.service';
import { performanceService } from './performance.service';

export interface ScheduledJobDefinition {
  name: string;
  description: string;
  intervalMs: number;
  runner: () => Promise<{ recordsProcessed?: number; alertsGenerated?: number; metadata?: any }>;
}

export interface JobRuntimeState {
  name: string;
  description: string;
  intervalMs: number;
  isRunning: boolean;
  lastRunAt: Date | null;
  lastDurationMs: number | null;
  lastStatus: 'IDLE' | 'SUCCESS' | 'FAILED' | 'RUNNING';
  lastError: string | null;
  totalRuns: number;
  totalAlertsGenerated: number;
}

export class JobSchedulerService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private jobs: Map<string, ScheduledJobDefinition> = new Map();
  private runtimeState: Map<string, JobRuntimeState> = new Map();
  private isStarted = false;

  constructor() {
    this.registerJobs();
  }

  private registerJobs() {
    // 1. CLASS_MONITORING: Periodic check of active classes & grace periods
    this.registerJob({
      name: 'CLASS_MONITORING',
      description: 'Evaluates currently scheduled classes against recorded teaching activities using server time.',
      intervalMs: 60 * 1000, // Every 1 minute
      runner: async () => {
        const evalRes = await ruleEngineService.evaluateClassMonitoring();
        return {
          recordsProcessed: evalRes.evaluatedCount,
          alertsGenerated: evalRes.alertsGenerated,
          metadata: { details: evalRes.details },
        };
      },
    });

    // 2. TASK_MAINTENANCE: Synchronizes overdue task statuses
    this.registerJob({
      name: 'TASK_MAINTENANCE',
      description: 'Synchronizes overdue tasks deterministically based on server time and due dates.',
      intervalMs: 2 * 60 * 1000, // Every 2 minutes
      runner: async () => {
        const count = await tasksService.syncOverdueTasks();
        return {
          recordsProcessed: count,
          alertsGenerated: 0,
        };
      },
    });

    // 3. TASK_RISK_ANALYSIS: Evaluates deterministic task risks and high-priority deadline proximity
    this.registerJob({
      name: 'TASK_RISK_ANALYSIS',
      description: 'Evaluates deterministic task risk rules (urgent overdue, approaching deadlines).',
      intervalMs: 5 * 60 * 1000, // Every 5 minutes
      runner: async () => {
        const evalRes = await ruleEngineService.evaluateTaskRisks();
        return {
          recordsProcessed: evalRes.evaluatedCount,
          alertsGenerated: evalRes.alertsGenerated,
          metadata: { details: evalRes.details },
        };
      },
    });

    // 4. ATTENDANCE_ANALYSIS: Evaluates attendance patterns with strict data sufficiency
    this.registerJob({
      name: 'ATTENDANCE_ANALYSIS',
      description: 'Evaluates attendance patterns with minimum data sufficiency thresholds.',
      intervalMs: 10 * 60 * 1000, // Every 10 minutes
      runner: async () => {
        const evalRes = await ruleEngineService.evaluateAttendancePatterns();
        return {
          recordsProcessed: evalRes.evaluatedCount,
          alertsGenerated: evalRes.alertsGenerated,
          metadata: { details: evalRes.details },
        };
      },
    });

    // 5. TIMETABLE_CONFLICT_ANALYSIS: Detects schedule clashes and invalid bounds
    this.registerJob({
      name: 'TIMETABLE_CONFLICT_ANALYSIS',
      description: 'Detects staff overlaps, class overlaps, and invalid time bounds in active schedules.',
      intervalMs: 10 * 60 * 1000, // Every 10 minutes
      runner: async () => {
        const res = await ruleEngineService.evaluateTimetableConflicts();
        return {
          recordsProcessed: res.evaluation.evaluatedCount,
          alertsGenerated: res.evaluation.alertsGenerated,
          metadata: { conflictCount: res.conflicts.length },
        };
      },
    });

    // 6. WORKLOAD_ANALYSIS: Evaluates teaching workload, task volume, deadline pressure, and status
    this.registerJob({
      name: 'WORKLOAD_ANALYSIS',
      description: 'Calculates deterministic workload metrics, deadline pressure, and evaluates workload concentration signals.',
      intervalMs: 10 * 60 * 1000, // Every 10 minutes
      runner: async () => {
        const res = await workloadService.recalculateAllStaffWorkload();
        const evalRes = await ruleEngineService.evaluateWorkloadConcentration();
        return {
          recordsProcessed: res.processed,
          alertsGenerated: res.alerts + evalRes.alertsGenerated,
          metadata: { details: evalRes.details },
        };
      },
    });

    // 7. PERFORMANCE_CALCULATION: Calculates deterministic weighted performance metrics
    this.registerJob({
      name: 'PERFORMANCE_CALCULATION',
      description: 'Calculates deterministic multi-factor performance metrics across attendance, tasks, classes, and operations.',
      intervalMs: 15 * 60 * 1000, // Every 15 minutes
      runner: async () => {
        const res = await performanceService.recalculateAllStaffPerformance();
        return {
          recordsProcessed: res.processed,
          alertsGenerated: 0,
        };
      },
    });

    // 8. NOTIFICATION_MAINTENANCE: Cleans up old unneeded notification logs
    this.registerJob({
      name: 'NOTIFICATION_MAINTENANCE',
      description: 'Performs maintenance on notifications and operational signal logs.',
      intervalMs: 15 * 60 * 1000, // Every 15 minutes
      runner: async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deleted = await prisma.notification.deleteMany({
          where: {
            read_at: { lt: thirtyDaysAgo },
          },
        });
        return {
          recordsProcessed: deleted.count,
          alertsGenerated: 0,
        };
      },
    });
  }

  public registerJob(def: ScheduledJobDefinition) {
    this.jobs.set(def.name, def);
    this.runtimeState.set(def.name, {
      name: def.name,
      description: def.description,
      intervalMs: def.intervalMs,
      isRunning: false,
      lastRunAt: null,
      lastDurationMs: null,
      lastStatus: 'IDLE',
      lastError: null,
      totalRuns: 0,
      totalAlertsGenerated: 0,
    });
  }

  /**
   * Returns whether the background scheduler is running.
   */
  public isSchedulerStarted(): boolean {
    return this.isStarted;
  }

  /**
   * Starts all scheduled jobs.
   */
  public startScheduler() {
    if (this.isStarted) return;
    this.isStarted = true;

    logger.info('Starting Centralized Scheduled Job Scheduler...', 'SCHEDULER');

    for (const [name, job] of this.jobs.entries()) {
      // Execute initial run shortly after startup (staggered by 5s per job)
      const initialDelay = 5000 + Math.random() * 5000;
      setTimeout(() => {
        this.runJob(name).catch((err) => {
          logger.error(`Initial execution of job ${name} failed`, err, 'JOB_ERROR');
        });
      }, initialDelay);

      // Set recurring timer
      const timer = setInterval(() => {
        this.runJob(name).catch((err) => {
          logger.error(`Scheduled execution of job ${name} failed`, err, 'JOB_ERROR');
        });
      }, job.intervalMs);

      this.timers.set(name, timer);
    }

    logger.info(`Scheduler running with ${this.jobs.size} registered jobs.`, 'SCHEDULER_READY');
  }

  /**
   * Stops all scheduled jobs cleanly.
   */
  public stopScheduler() {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.isStarted = false;
    logger.info('Scheduled Job Scheduler stopped cleanly.', 'SCHEDULER_STOPPED');
  }

  /**
   * Executes a specific job safely with error isolation and DB persistence.
   */
  public async runJob(
    name: string,
    triggeredBy = 'SCHEDULER'
  ): Promise<{ success: boolean; durationMs: number; error?: string; runRecord?: any }> {
    const job = this.jobs.get(name);
    const state = this.runtimeState.get(name);

    if (!job || !state) {
      throw new Error(`Job "${name}" is not registered in scheduler.`);
    }

    if (state.isRunning) {
      logger.warn(`Job "${name}" is already running, skipping overlapping execution.`, 'SCHEDULER_SKIP');
      return { success: false, durationMs: 0, error: 'Job already running' };
    }

    state.isRunning = true;
    state.lastStatus = 'RUNNING';
    const startTime = Date.now();

    // Create ScheduledJobRun entry in DB
    let runRecord: any = null;
    try {
      runRecord = await prisma.scheduledJobRun.create({
        data: {
          job_name: name,
          status: 'RUNNING',
          started_at: new Date(),
          metadata: JSON.stringify({ triggeredBy }),
        },
      });
    } catch {
      // Non-fatal if logging run record fails initially
    }

    try {
      logger.debug(`[JOB_START] ${name} (Triggered by: ${triggeredBy})`);
      const result = await job.runner();
      const durationMs = Date.now() - startTime;

      state.isRunning = false;
      state.lastRunAt = new Date();
      state.lastDurationMs = durationMs;
      state.lastStatus = 'SUCCESS';
      state.lastError = null;
      state.totalRuns++;
      if (result.alertsGenerated) {
        state.totalAlertsGenerated += result.alertsGenerated;
      }

      // Update DB record
      if (runRecord) {
        await prisma.scheduledJobRun.update({
          where: { id: runRecord.id },
          data: {
            status: 'SUCCESS',
            completed_at: new Date(),
            duration_ms: durationMs,
            records_processed: result.recordsProcessed || 0,
            alerts_generated: result.alertsGenerated || 0,
            metadata: result.metadata ? JSON.stringify(result.metadata) : null,
          },
        });
      }

      logger.debug(`[JOB_SUCCESS] ${name} completed in ${durationMs}ms`);
      return { success: true, durationMs, runRecord };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = (error as Error).message || 'Unknown execution failure';

      state.isRunning = false;
      state.lastRunAt = new Date();
      state.lastDurationMs = durationMs;
      state.lastStatus = 'FAILED';
      state.lastError = errorMessage;
      state.totalRuns++;

      if (runRecord) {
        try {
          await prisma.scheduledJobRun.update({
            where: { id: runRecord.id },
            data: {
              status: 'FAILED',
              completed_at: new Date(),
              duration_ms: durationMs,
              error_message: errorMessage,
            },
          });
        } catch {
          // Ignore secondary DB error
        }
      }

      logger.error(`[JOB_FAILED] ${name} failed after ${durationMs}ms: ${errorMessage}`, error, 'JOB_ERROR');
      return { success: false, durationMs, error: errorMessage };
    }
  }

  /**
   * Retrieves runtime status for all registered jobs.
   */
  public getJobStatuses(): JobRuntimeState[] {
    return Array.from(this.runtimeState.values());
  }

  /**
   * Retrieves recent execution history from the database.
   */
  public async getJobHistory(limit = 50, jobName?: string) {
    const where: any = {};
    if (jobName) {
      where.job_name = jobName;
    }

    return await prisma.scheduledJobRun.findMany({
      where,
      take: limit,
      orderBy: { started_at: 'desc' },
    });
  }
}

export const jobScheduler = new JobSchedulerService();
