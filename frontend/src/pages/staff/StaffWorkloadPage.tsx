import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { UnifiedAppLayout } from '../../layouts/UnifiedAppLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { analyticsApi } from '../../services/analytics.service';
import { useToast } from '../../components/common/Toast';

export const StaffWorkloadPage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ current: any; history: any[] } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.getStaffWorkload();
      setData(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to load workload data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LOW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'NORMAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CONCENTRATED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'INCREASING') return <TrendingUp className="w-3.5 h-3.5 text-amber-600" />;
    if (trend === 'DECREASING') return <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />;
    return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <UnifiedAppLayout
      breadcrumbs={[
        { label: 'Workspace', href: '/staff/dashboard' },
        { label: 'Workload Analytics' },
      ]}
      searchPlaceholder="Filter workload..."
    >
      <div className="space-y-6">
        <PageHeader
          title="Workload Analytics & Metrics"
          subtitle="Deterministic operational workload evaluation derived from timetable allocations, active tasks, and operational activities."
          icon={Briefcase}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Deterministic Evaluation
            </span>
          }
          actions={
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Refresh Metrics</span>
            </button>
          }
        />

        {/* Policy Notice */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-2xs">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold text-blue-950">Operational Allocation Notice: </span>
            Workload metrics indicate timetable density and institutional task volume. Elevated or concentrated workload statuses represent institutional resource allocations and do not imply performance deficiency or personal fault.
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-xs text-slate-500">Evaluating workload metrics from PostgreSQL database...</div>
          </div>
        ) : !data || !data.current ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs">
            <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Insufficient Workload Data</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No active timetable slots, task assignments, or operational activity records were found for the current period.
            </p>
          </div>
        ) : (
          <>
            {/* Current Workload Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="Workload Score"
                value={`${data.current.workloadScore ?? '—'}/100`}
                icon={Briefcase}
                color="blue"
                badge={data.current.workloadStatus}
                subtext={`Trend: ${data.current.workloadTrend.toLowerCase()}`}
              />

              <StatCard
                label="Teaching Workload"
                value={`${data.current.teachingHours ?? 0} hrs`}
                icon={BookOpen}
                color="indigo"
                subtext={`${data.current.scheduledClassCount ?? 0} scheduled classes`}
              />

              <StatCard
                label="Active Tasks"
                value={data.current.activeTaskCount ?? 0}
                icon={Clock}
                color="amber"
                badge={`${data.current.overdueTaskCount ?? 0} Overdue`}
                subtext={`${data.current.urgentTaskCount ?? 0} urgent priority`}
              />

              <StatCard
                label="Operations & Deadlines"
                value={data.current.upcomingDeadlineCount ?? 0}
                icon={AlertTriangle}
                color="purple"
                badge="Upcoming"
                subtext="Sessions recorded"
              />
            </div>

            {/* Detailed Contributing Factors Breakdown */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Workload Composition Breakdown</h3>
                <p className="text-xs text-slate-500 mt-0.5">{data.current.explanation}</p>
              </div>

              {data.current.contributingFactors && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-600">Teaching Allocation</div>
                    <div className="text-xl font-bold text-blue-700 mt-1">
                      {data.current.contributingFactors.teachingHoursContribution} pts
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Proportional to weekly lecture and lab contact hours.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-600">Task Backlog & Urgency</div>
                    <div className="text-xl font-bold text-amber-700 mt-1">
                      {data.current.contributingFactors.taskVolumeContribution +
                        data.current.contributingFactors.overdueTaskContribution}{' '}
                      pts
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Includes assigned pending tasks, priority weights, and overdue factors.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-600">Operations & Deadlines</div>
                    <div className="text-xl font-bold text-purple-700 mt-1">
                      {data.current.contributingFactors.deadlinePressureContribution +
                        data.current.contributingFactors.administrativeContribution}{' '}
                      pts
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Upcoming 48h deadlines, meetings, and preparation activities.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Historical Workload Timeline */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Historical Workload Metrics</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {data.history.length} snapshots
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 font-semibold text-slate-600 border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Teaching Hours</th>
                      <th className="px-4 py-3">Active Tasks</th>
                      <th className="px-4 py-3">Overdue</th>
                      <th className="px-4 py-3">Operations</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.history.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No historical workload snapshots recorded.
                        </td>
                      </tr>
                    ) : (
                      data.history.map((h, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-slate-900">
                            {new Date(h.period_start).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                            })}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.teaching_hours ?? 0} hrs</td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.active_task_count ?? 0}</td>
                          <td className="px-4 py-3.5 font-mono text-rose-600 font-semibold">{h.overdue_task_count ?? 0}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.administrative_activity_count ?? 0}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 font-mono">{h.workload_score ?? '—'}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadge(
                                h.workload_status || 'NORMAL'
                              )}`}
                            >
                              {h.workload_status || 'NORMAL'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </UnifiedAppLayout>
  );
};

export default StaffWorkloadPage;
