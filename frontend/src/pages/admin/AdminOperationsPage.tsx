import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Calendar,
  Layers,
  Eye,
  Check,
  X,
  Search,
  Zap,
  Info,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { operationsService } from '../../services/operations.service';
import { useToast } from '../../components/common/Toast';
import {
  OperationalAlertEntity,
  OperationalAlertSummary,
  OperationalAlertType,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  ScheduledJobRuntimeState,
  ScheduledJobRunEntity,
  OperationalConfig,
  TimetableConflictItem,
} from '../../types/operations';

export const AdminOperationsPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'alerts' | 'jobs' | 'conflicts' | 'config'>('alerts');
  const [loading, setLoading] = useState(true);

  // Alerts State
  const [alerts, setAlerts] = useState<OperationalAlertEntity[]>([]);
  const [alertSummary, setAlertSummary] = useState<OperationalAlertSummary | null>(null);
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlertForEvidence, setSelectedAlertForEvidence] = useState<OperationalAlertEntity | null>(null);

  // Action Modals State
  const [actionModal, setActionModal] = useState<{
    type: 'ACKNOWLEDGE' | 'RESOLVE' | 'DISMISS';
    alert: OperationalAlertEntity;
    text: string;
  } | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Scheduled Jobs State
  const [jobs, setJobs] = useState<ScheduledJobRuntimeState[]>([]);
  const [jobHistory, setJobHistory] = useState<ScheduledJobRunEntity[]>([]);
  const [serverTime, setServerTime] = useState<string>('');
  const [runningJobName, setRunningJobName] = useState<string | null>(null);

  // Conflicts State
  const [conflicts, setConflicts] = useState<TimetableConflictItem[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);

  // Config State
  const [config, setConfig] = useState<OperationalConfig>({
    classMonitoringGracePeriodMinutes: 10,
    taskDueSoonThresholdHours: 24,
    attendanceAnalysisPeriodDays: 30,
    attendanceMinDataDays: 10,
    attendanceExceptionThreshold: 4,
    workloadMaxWeeklyHours: 24,
    workloadMaxClassesPerDay: 5,
    notificationCooldownMinutes: 60,
  });
  const [configSaving, setConfigSaving] = useState(false);

  // Load Data
  const loadAlertsData = useCallback(async () => {
    try {
      const [alertsRes, summaryRes] = await Promise.all([
        operationsService.getOperationalAlerts({
          alertType: (alertTypeFilter as OperationalAlertType) || undefined,
          severity: (severityFilter as OperationalAlertSeverity) || undefined,
          status: (statusFilter as OperationalAlertStatus) || undefined,
          search: searchQuery || undefined,
          pageSize: 50,
        }),
        operationsService.getOperationalAlertSummary(),
      ]);
      setAlerts(alertsRes.alerts || []);
      setAlertSummary(summaryRes);
    } catch (err: any) {
      showToast(err.message || 'Failed to load operational alerts', 'error');
    }
  }, [alertTypeFilter, severityFilter, statusFilter, searchQuery, showToast]);

  const loadJobsData = useCallback(async () => {
    try {
      const [jobsRes, historyRes] = await Promise.all([
        operationsService.getScheduledJobs(),
        operationsService.getJobHistory({ limit: 25 }),
      ]);
      setJobs(jobsRes.jobs || []);
      setServerTime(jobsRes.serverTime || '');
      setJobHistory(historyRes || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load scheduled jobs', 'error');
    }
  }, [showToast]);

  const loadConflictsData = useCallback(async () => {
    setConflictsLoading(true);
    try {
      const res = await operationsService.getTimetableConflicts();
      setConflicts(res.conflicts || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load timetable conflicts', 'error');
    } finally {
      setConflictsLoading(false);
    }
  }, [showToast]);

  const loadConfigData = useCallback(async () => {
    try {
      const res = await operationsService.getOperationalConfigs();
      if (res) {
        setConfig(res);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load operational configuration', 'error');
    }
  }, [showToast]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAlertsData(), loadJobsData(), loadConflictsData(), loadConfigData()]);
    setLoading(false);
  }, [loadAlertsData, loadJobsData, loadConflictsData, loadConfigData]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Trigger Scheduled Job Manually
  const handleTriggerJob = async (jobName: string) => {
    setRunningJobName(jobName);
    try {
      const result = await operationsService.triggerJobRun(jobName);
      showToast(
        `Job ${jobName} triggered successfully: ${result.success ? 'Completed' : 'Failed'} (${result.durationMs}ms)`,
        'success'
      );
      await loadJobsData();
      await loadAlertsData();
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger job execution', 'error');
    } finally {
      setRunningJobName(null);
    }
  };

  // Alert Action Execution
  const handleExecuteAlertAction = async () => {
    if (!actionModal) return;
    setActionSubmitting(true);
    try {
      if (actionModal.type === 'ACKNOWLEDGE') {
        await operationsService.acknowledgeOperationalAlert(actionModal.alert.id, actionModal.text || undefined);
        showToast('Alert acknowledged successfully', 'success');
      } else if (actionModal.type === 'RESOLVE') {
        if (!actionModal.text.trim()) {
          showToast('Resolution notes are required to resolve an alert', 'error');
          setActionSubmitting(false);
          return;
        }
        await operationsService.resolveOperationalAlert(actionModal.alert.id, actionModal.text);
        showToast('Alert resolved successfully', 'success');
      } else if (actionModal.type === 'DISMISS') {
        if (!actionModal.text.trim()) {
          showToast('Dismissal reason is required', 'error');
          setActionSubmitting(false);
          return;
        }
        await operationsService.dismissOperationalAlert(actionModal.alert.id, actionModal.text);
        showToast('Alert dismissed', 'info');
      }
      setActionModal(null);
      await loadAlertsData();
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Save Configuration Handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    try {
      const updated = await operationsService.updateOperationalConfigs(config);
      setConfig(updated);
      showToast('Operational thresholds updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save configuration', 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const getSeverityBadgeClass = (severity: OperationalAlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'LOW':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getStatusBadgeClass = (status: OperationalAlertStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'ACKNOWLEDGED':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'DISMISSED':
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Operations & Coverage' },
        { label: 'Operations & Alerts' },
      ]}
      searchPlaceholder="Filter operational alerts..."
    >
      <div className="space-y-6">
        <PageHeader
          title="Operational Intelligence & Scheduled Jobs"
          subtitle="Real-time deterministic monitoring, rule engine evaluations, conflict detection, and background jobs."
          icon={Activity}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Deterministic Rule Engine
            </span>
          }
          actions={
            <button
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Refresh Matrix</span>
            </button>
          }
        />

        {/* Operational Intelligence Notice */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-2xs">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold text-blue-950">Deterministic Operational Signal Policy: </span>
            Missing attendance or unrecorded classroom signals represent operational monitoring indicators evaluated
            strictly against server time and configured rules. They do not constitute evidence of absence, misconduct, or
            disciplinary fault.
          </div>
        </div>

        {/* High-level Summary Metrics Cards */}
        {alertSummary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StatCard
              label="Active Alerts"
              value={alertSummary.totalActive}
              icon={ShieldAlert}
              color="rose"
              subtext={`Open: ${alertSummary.open}`}
            />
            <StatCard
              label="Critical / High"
              value={(alertSummary.bySeverity.CRITICAL || 0) + (alertSummary.bySeverity.HIGH || 0)}
              icon={AlertTriangle}
              color="amber"
              subtext="Immediate review"
            />
            <StatCard
              label="Class Signals"
              value={alertSummary.byType.CLASS_ACTIVITY_NOT_RECORDED || 0}
              icon={Clock}
              color="blue"
              subtext="Unrecorded sessions"
            />
            <StatCard
              label="Task Risks"
              value={(alertSummary.byType.TASK_OVERDUE || 0) + (alertSummary.byType.TASK_HIGH_RISK || 0)}
              icon={Activity}
              color="purple"
              subtext="Overdue & due soon"
            />
            <StatCard
              label="Conflicts"
              value={alertSummary.byType.TIMETABLE_CONFLICT || 0}
              icon={Calendar}
              color="indigo"
              subtext="Clashes detected"
            />
            <StatCard
              label="Resolved"
              value={alertSummary.resolved}
              icon={CheckCircle2}
              color="emerald"
              subtext="Cleared by admin"
            />
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-2 bg-white p-1.5 rounded-2xl border shadow-2xs overflow-x-auto">
          {[
            { id: 'alerts', label: 'Operational Alerts', icon: ShieldAlert, badge: alertSummary && alertSummary.totalActive > 0 ? alertSummary.totalActive : undefined },
            { id: 'jobs', label: 'Scheduled Jobs Registry', icon: Zap, badge: jobs.length },
            { id: 'conflicts', label: 'Timetable Conflicts', icon: Calendar, badge: conflicts.length > 0 ? conflicts.length : undefined },
            { id: 'config', label: 'Rule Thresholds & Settings', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OPERATIONAL ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search alerts by title, message, or rule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open Only</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>

              <select
                value={alertTypeFilter}
                onChange={(e) => setAlertTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Alert Types</option>
                <option value="CLASS_ACTIVITY_NOT_RECORDED">Class Activity Not Recorded</option>
                <option value="TASK_OVERDUE">Task Overdue</option>
                <option value="TASK_HIGH_RISK">Task High Risk</option>
                <option value="ATTENDANCE_PATTERN">Attendance Pattern</option>
                <option value="TIMETABLE_CONFLICT">Timetable Conflict</option>
                <option value="WORKLOAD_CONCENTRATION">Workload Concentration</option>
                <option value="NOTIFICATION_FAILURE">Notification Failure</option>
                <option value="SYSTEM_OPERATIONAL">System Operational</option>
              </select>
            </div>

            {/* Alerts Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">Severity & Type</th>
                      <th className="py-3 px-4">Alert Title & Factual Signal</th>
                      <th className="py-3 px-4">Entity Reference</th>
                      <th className="py-3 px-4">Detected</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                          <div>No operational alerts found matching current filters.</div>
                        </td>
                      </tr>
                    ) : (
                      alerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${getSeverityBadgeClass(
                                  alert.severity
                                )}`}
                              >
                                {alert.severity}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {alert.alert_type}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top max-w-md">
                            <div className="font-semibold text-slate-900">{alert.title}</div>
                            <div className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                              {alert.message}
                            </div>
                            <div className="text-[10px] font-mono text-blue-600 mt-1 flex items-center space-x-1">
                              <span>Rule:</span>
                              <span className="bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {alert.rule_identifier}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap text-xs">
                            {alert.staff && (
                              <div className="text-slate-900 font-semibold">
                                {alert.staff.full_name} ({alert.staff.staff_id})
                              </div>
                            )}
                            {alert.department && (
                              <div className="text-slate-500 text-[11px]">{alert.department.name}</div>
                            )}
                            {alert.timetable && (
                              <div className="text-slate-500 text-[10px] mt-0.5">
                                {alert.timetable.class?.name} • {alert.timetable.subject?.name} (
                                {alert.timetable.start_time}-{alert.timetable.end_time})
                              </div>
                            )}
                            {alert.task && (
                              <div className="text-slate-500 text-[10px] mt-0.5">
                                Task: {alert.task.title}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap text-xs text-slate-600">
                            <div>{new Date(alert.detected_at).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(alert.detected_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${getStatusBadgeClass(
                                alert.status
                              )}`}
                            >
                              {alert.status}
                            </span>
                            {alert.resolution_notes && (
                              <div className="text-[10px] text-slate-500 mt-1 max-w-xs truncate" title={alert.resolution_notes}>
                                Note: {alert.resolution_notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap text-right text-xs">
                            <div className="flex items-center justify-end space-x-1.5">
                              {alert.evidence && (
                                <button
                                  onClick={() => setSelectedAlertForEvidence(alert)}
                                  title="Inspect Evidence"
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}

                              {alert.status === 'OPEN' && (
                                <button
                                  onClick={() =>
                                    setActionModal({ type: 'ACKNOWLEDGE', alert, text: '' })
                                  }
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                                >
                                  Acknowledge
                                </button>
                              )}

                              {(alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED') && (
                                <>
                                  <button
                                    onClick={() =>
                                      setActionModal({ type: 'RESOLVE', alert, text: '' })
                                    }
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    Resolve
                                  </button>
                                  <button
                                    onClick={() =>
                                      setActionModal({ type: 'DISMISS', alert, text: '' })
                                    }
                                    className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULED JOBS REGISTRY */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Centralized Server-Side Scheduler</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  All 7 operational background jobs run server-side independently from browser lifecycle.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                Server Time: <span className="text-blue-600 font-bold">{serverTime ? new Date(serverTime).toLocaleTimeString() : 'Syncing...'}</span>
              </div>
            </div>

            {/* Jobs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <div
                  key={job.name}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 font-mono">{job.name}</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {job.description}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          job.lastStatus === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : job.lastStatus === 'RUNNING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                            : job.lastStatus === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {job.lastStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                      <div>
                        <div className="text-[10px] text-slate-400">Interval</div>
                        <div className="font-semibold text-slate-800 mt-0.5">
                          {job.intervalMs / 1000}s ({Math.round(job.intervalMs / 60000)}m)
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Last Duration</div>
                        <div className="font-semibold text-slate-800 mt-0.5">
                          {job.lastDurationMs !== null ? `${job.lastDurationMs}ms` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Total Runs</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{job.totalRuns}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Alerts Raised</div>
                        <div className="font-semibold text-slate-800 mt-0.5">
                          {job.totalAlertsGenerated}
                        </div>
                      </div>
                    </div>

                    {job.lastError && (
                      <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 truncate" title={job.lastError}>
                        Error: {job.lastError}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {job.lastRunAt
                        ? `Last: ${new Date(job.lastRunAt).toLocaleTimeString()}`
                        : 'Not executed yet'}
                    </span>

                    <button
                      onClick={() => handleTriggerJob(job.name)}
                      disabled={job.isRunning || runningJobName === job.name}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <Play className={`w-3 h-3 ${runningJobName === job.name ? 'animate-spin' : ''}`} />
                      <span>{runningJobName === job.name ? 'Running...' : 'Run Now'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Job Execution History */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Recent Job Execution History</h3>
                <span className="text-xs text-slate-500">Last 25 runs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 font-semibold text-slate-600 border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-2.5">Job Name</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Started At</th>
                      <th className="px-4 py-2.5">Duration</th>
                      <th className="px-4 py-2.5">Records</th>
                      <th className="px-4 py-2.5">Alerts</th>
                      <th className="px-4 py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                          No recent execution records found.
                        </td>
                      </tr>
                    ) : (
                      jobHistory.map((run) => (
                        <tr key={run.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-2.5 font-mono font-medium text-slate-900">
                            {run.job_name}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                run.status === 'SUCCESS'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : run.status === 'RUNNING'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">
                            {new Date(run.started_at).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">
                            {run.duration_ms !== null ? `${run.duration_ms}ms` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 font-mono">{run.records_processed ?? 0}</td>
                          <td className="px-4 py-2.5 text-slate-700 font-mono">{run.alerts_generated ?? 0}</td>
                          <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate">
                            {run.error_message || run.metadata || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TIMETABLE CONFLICTS */}
        {activeTab === 'conflicts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Deterministic Timetable Conflict Detector</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluates staff session overlaps, class session overlaps, and invalid time boundaries across the active timetable.
                </p>
              </div>
              <button
                onClick={loadConflictsData}
                disabled={conflictsLoading}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${conflictsLoading ? 'animate-spin' : ''}`} />
                <span>Re-evaluate Conflicts</span>
              </button>
            </div>

            {conflicts.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900">No Timetable Conflicts Detected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  All active timetable entries satisfy single-staff assignment, single-class allocation, and valid time boundary rules.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {conflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-amber-200/90 rounded-2xl p-5 space-y-4 shadow-2xs"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{conflict.description}</h3>
                          <span className="text-[10px] font-mono text-amber-700">
                            Rule: {conflict.ruleIdentifier}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {conflict.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Session A
                        </div>
                        <div className="text-xs font-bold text-slate-900">{conflict.entryA.className}</div>
                        <div className="text-xs text-slate-600 mt-1">
                          Staff: <span className="font-semibold text-slate-800">{conflict.entryA.staffName}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Subject: <span className="font-semibold text-slate-800">{conflict.entryA.subjectName}</span>
                        </div>
                        <div className="text-[11px] font-mono text-blue-700 mt-2">
                          Day {conflict.entryA.dayOfWeek} • {conflict.entryA.startTime} - {conflict.entryA.endTime}
                          {conflict.entryA.room && ` (Room: ${conflict.entryA.room})`}
                        </div>
                      </div>

                      {conflict.entryB && (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Session B
                          </div>
                          <div className="text-xs font-bold text-slate-900">{conflict.entryB.className}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            Staff: <span className="font-semibold text-slate-800">{conflict.entryB.staffName}</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Subject: <span className="font-semibold text-slate-800">{conflict.entryB.subjectName}</span>
                          </div>
                          <div className="text-[11px] font-mono text-blue-700 mt-2">
                            Day {conflict.entryB.dayOfWeek} • {conflict.entryB.startTime} - {conflict.entryB.endTime}
                            {conflict.entryB.room && ` (Room: ${conflict.entryB.room})`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: OPERATIONAL CONFIGURATION */}
        {activeTab === 'config' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3 mb-6">
              <h2 className="text-sm font-bold text-slate-900">Centralized Operational Configuration</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize operational thresholds and rule parameters without hardcoded constants. All changes are logged to the audit trail.
              </p>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Class Monitoring Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={config.classMonitoringGracePeriodMinutes}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        classMonitoringGracePeriodMinutes: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Elapsed minutes past scheduled class start before evaluating unrecorded activity signal.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Task "Due Soon" Threshold (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={config.taskDueSoonThresholdHours}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        taskDueSoonThresholdHours: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hours prior to task due date for high-priority task risk warnings.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Attendance Analysis Window (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={config.attendanceAnalysisPeriodDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        attendanceAnalysisPeriodDays: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Rolling lookback period used for attendance pattern analysis.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Attendance Minimum Data Sufficiency (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={config.attendanceMinDataDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        attendanceMinDataDays: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Minimum recorded working days required before pattern alerts can trigger.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Attendance Exception Alert Threshold (Count)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.attendanceExceptionThreshold}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        attendanceExceptionThreshold: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Total absent/half-day exceptions within the period to generate an operational review signal.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Maximum Weekly Teaching Workload (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    value={config.workloadMaxWeeklyHours}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        workloadMaxWeeklyHours: parseFloat(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Scheduled teaching hours limit per staff member before flagging workload concentration.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Maximum Daily Scheduled Classes (Count)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={config.workloadMaxClassesPerDay}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        workloadMaxClassesPerDay: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Maximum scheduled slots for a single teacher on any working day.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Notification Cooldown Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={config.notificationCooldownMinutes}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        notificationCooldownMinutes: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cooldown interval to prevent duplicate broadcast notifications for the same operational event.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 transition-colors disabled:opacity-50"
                >
                  <Check className={`w-3.5 h-3.5 ${configSaving ? 'animate-spin' : ''}`} />
                  <span>{configSaving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Evidence Inspector Modal */}
        {selectedAlertForEvidence && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Deterministic Evidence & Rule Metadata
                  </h3>
                  <p className="text-xs text-blue-600 font-mono mt-0.5">
                    {selectedAlertForEvidence.rule_identifier}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAlertForEvidence(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="text-xs text-slate-800 font-semibold">
                  {selectedAlertForEvidence.title}
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 overflow-x-auto">
                  <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap">
                    {typeof selectedAlertForEvidence.evidence === 'string'
                      ? JSON.stringify(JSON.parse(selectedAlertForEvidence.evidence), null, 2)
                      : JSON.stringify(selectedAlertForEvidence.evidence, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedAlertForEvidence(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Modal (Acknowledge / Resolve / Dismiss) */}
        {actionModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  {actionModal.type === 'ACKNOWLEDGE'
                    ? 'Acknowledge Alert'
                    : actionModal.type === 'RESOLVE'
                    ? 'Resolve Alert'
                    : 'Dismiss Alert'}
                </h3>
                <button
                  onClick={() => setActionModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600">{actionModal.alert.title}</p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {actionModal.type === 'ACKNOWLEDGE'
                    ? 'Acknowledgment Remarks (Optional)'
                    : actionModal.type === 'RESOLVE'
                    ? 'Resolution Notes (Required)'
                    : 'Dismissal Reason (Required)'}
                </label>
                <textarea
                  rows={3}
                  value={actionModal.text}
                  onChange={(e) => setActionModal({ ...actionModal, text: e.target.value })}
                  placeholder={
                    actionModal.type === 'RESOLVE'
                      ? 'Describe how this operational condition was verified or resolved...'
                      : actionModal.type === 'DISMISS'
                      ? 'Provide administrative reason for dismissing this alert...'
                      : 'Optional notes...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setActionModal(null)}
                  disabled={actionSubmitting}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteAlertAction}
                  disabled={actionSubmitting}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-colors text-white ${
                    actionModal.type === 'RESOLVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : actionModal.type === 'DISMISS'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  }`}
                >
                  {actionSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOperationsPage;
