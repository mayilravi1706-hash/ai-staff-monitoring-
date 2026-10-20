import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/common/Toast';
import { operationsService } from '../../services/operations.service';
import { masterDataService } from '../../services/masterData.service';
import { Department } from '../../types/masterData';
import {
  InstitutionalCoverageResponse,
  ClassMonitoringAlertEntity,
} from '../../types/operations';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Building2,
  BookOpen,
  Info,
  Calendar,
  Activity,
  Check,
} from 'lucide-react';

export const AdminClassCoveragePage: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coverageData, setCoverageData] = useState<InstitutionalCoverageResponse | null>(null);
  const [alerts, setAlerts] = useState<ClassMonitoringAlertEntity[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');

  // Grace Period Setting state
  const [gracePeriod, setGracePeriod] = useState<number>(5);
  const [editingGracePeriod, setEditingGracePeriod] = useState<number>(5);
  const [savingGracePeriod, setSavingGracePeriod] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [covRes, alertRes, deptRes, graceRes] = await Promise.all([
        operationsService.getClassCoverage(selectedDept || undefined),
        operationsService.getMonitoringAlerts({ status: 'ACTIVE' }),
        masterDataService.getDepartments(),
        operationsService.getGracePeriod(),
      ]);

      setCoverageData(covRes);
      setAlerts(alertRes.alerts || []);
      setDepartments(deptRes.departments || []);
      setGracePeriod(graceRes.gracePeriodMinutes);
      setEditingGracePeriod(graceRes.gracePeriodMinutes);
    } catch (err: any) {
      showError(err.message || 'Failed to load institutional class coverage data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDept, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveGracePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGracePeriod(true);
    try {
      const res = await operationsService.updateGracePeriod(editingGracePeriod);
      setGracePeriod(res.gracePeriodMinutes);
      showSuccess(`Monitoring grace period updated to ${res.gracePeriodMinutes} minutes.`);
      await loadData();
    } catch (err: any) {
      showError(err.message || 'Failed to update grace period');
    } finally {
      setSavingGracePeriod(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await operationsService.updateMonitoringAlert(alertId, 'RESOLVED');
      showSuccess('Operational monitoring alert resolved.');
      await loadData();
    } catch (err: any) {
      showError(err.message || 'Failed to resolve alert');
    }
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Operations & Coverage' },
        { label: 'Live Class Coverage' },
      ]}
      searchPlaceholder="Filter scheduled classes..."
    >
      <div className="space-y-6">
        <PageHeader
          title="Class Operations & Coverage"
          subtitle="Real-time institutional class tracking, monitoring signals, and grace period settings"
          icon={Activity}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Evaluation
            </span>
          }
          actions={
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Refresh Matrix</span>
            </button>
          }
        />

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Scheduled Slots"
            value={coverageData?.summary.total || 0}
            icon={Clock}
            color="blue"
            subtext="Today's timetable periods"
          />
          <StatCard
            label="Covered Classes"
            value={coverageData?.summary.covered || 0}
            icon={CheckCircle2}
            color="emerald"
            badge="Activity Logged"
          />
          <StatCard
            label="Activity Not Recorded"
            value={coverageData?.summary.notRecorded || 0}
            icon={AlertTriangle}
            color="amber"
            badge="Signals Raised"
          />
          <StatCard
            label="Upcoming Slots"
            value={coverageData?.summary.upcoming || 0}
            icon={Calendar}
            color="indigo"
            subtext="Scheduled later today"
          />
        </div>

        {/* GRACE PERIOD CONFIGURATION CARD */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Settings className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Class Monitoring Grace Period</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                CURRENT: {gracePeriod} MIN
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Configured interval after lecture start before the system flags an unrecorded class monitoring signal. Defaults to 5 minutes.
            </p>
          </div>

          <form onSubmit={handleSaveGracePeriod} className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            <input
              type="number"
              min={0}
              max={60}
              value={editingGracePeriod}
              onChange={(e) => setEditingGracePeriod(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-20 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-500">minutes</span>
            <button
              type="submit"
              disabled={savingGracePeriod || editingGracePeriod === gracePeriod}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {savingGracePeriod ? 'Updating...' : 'Save Period'}
            </button>
          </form>
        </div>

        {/* OPERATIONAL MONITORING SIGNALS PANEL */}
        {alerts.length > 0 && (
          <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-amber-900">
                  Active Monitoring Signals ({alerts.length})
                </h3>
              </div>
              <div className="text-[11px] text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  Signals indicate unrecorded activity and do not establish unattended class or staff absence.
                </span>
              </div>
            </div>

            <div className="divide-y divide-amber-200/50">
              {alerts.map((al) => (
                <div key={al.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {al.staff?.full_name} ({al.staff?.staff_id})
                      </span>
                      <span className="font-mono text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        {al.expected_start_time} – {al.expected_end_time}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium">
                      {al.message}
                    </p>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Signal generated: {new Date(al.created_at).toLocaleTimeString()} • Rule: {al.rule_name}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAcknowledgeAlert(al.id)}
                    className="self-end md:self-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shrink-0 shadow-2xs"
                  >
                    Resolve Signal
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INSTITUTIONAL CLASS COVERAGE TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Institutional Schedule & Coverage Status</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic calculation combining timetable, faculty current activity, and attendance states.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-xs text-slate-500">Loading coverage matrix...</p>
            </div>
          ) : coverageData?.schedule && coverageData.schedule.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Class & Section</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Time Window</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Time Status</th>
                    <th className="py-3 px-4">Class Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coverageData.schedule.map((entry) => (
                    <tr key={entry.timetableId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{entry.staff.full_name}</div>
                        <div className="font-mono text-[11px] text-blue-600">{entry.staff.staff_id}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-medium">{entry.class.name}</div>
                        {entry.class.section && (
                          <div className="text-[11px] text-slate-400">Section {entry.class.section}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{entry.subject.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{entry.subject.code}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {entry.startTime} – {entry.endTime}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {entry.room || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.timeStatus === 'CURRENT'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : entry.timeStatus === 'COMPLETED'
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {entry.timeStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {entry.coverage === 'COVERED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            COVERED
                          </span>
                        ) : entry.coverage === 'NOT_RECORDED' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                            title="Scheduled class activity has not been recorded."
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            NOT RECORDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            NOT SCHEDULED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No scheduled classes for today</p>
              <p className="text-xs text-slate-500 mt-1">Try selecting a different department filter.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
