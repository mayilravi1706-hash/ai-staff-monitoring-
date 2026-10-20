import React, { useState, useEffect } from 'react';
import {
  Award,
  CalendarCheck,
  CheckSquare,
  Clock,
  BookOpen,
  Activity,
  Info,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { UnifiedAppLayout } from '../../layouts/UnifiedAppLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { analyticsApi, PerformanceWeights } from '../../services/analytics.service';
import { useToast } from '../../components/common/Toast';

export const StaffPerformancePage: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ current: any; history: any[]; weights: PerformanceWeights } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await analyticsApi.getStaffPerformance();
      setData(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to load performance metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-400';
    if (score >= 85) return 'text-emerald-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <UnifiedAppLayout
      breadcrumbs={[
        { label: 'Workspace', href: '/staff/dashboard' },
        { label: 'Performance Metrics' },
      ]}
      searchPlaceholder="Filter performance..."
    >
      <div className="space-y-6">
        <PageHeader
          title="Performance Analytics & History"
          subtitle="Deterministic multi-factor performance evaluation computed from attendance, task completion, schedule adherence, and operational activities."
          icon={Award}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Zero-Ranking Ethical Policy
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

        {/* Zero-Ranking Ethical Policy Notice */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-2xs">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold text-blue-950">Deterministic Evaluation Policy: </span>
            All metrics represent objective factual measurements calculated directly from database records. The platform does not generate competitive staff rankings, comparative leaderboards, or speculative career assessments.
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-xs text-slate-500">Computing deterministic performance scores from PostgreSQL database...</div>
          </div>
        ) : !data || !data.current ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-2xs">
            <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Insufficient Performance Data</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Not enough attendance, task completion, or schedule records exist in the database for the current period.
            </p>
          </div>
        ) : (
          <>
            {/* Overall Score Banner */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Overall Weighted Performance Score
                </div>
                <div className="flex items-baseline justify-center md:justify-start gap-3">
                  <span className={`text-4xl font-black ${getScoreColor(data.current.overallScore)}`}>
                    {data.current.overallScore !== null ? `${data.current.overallScore}%` : 'INSUFFICIENT DATA'}
                  </span>
                  {data.current.overallScore !== null && (
                    <span className="text-xs text-slate-500 font-medium">Weighted Composite</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 max-w-xl mt-1 leading-relaxed">{data.current.explanation}</p>
              </div>

              <div className="flex flex-col items-center md:items-end gap-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200/80 shrink-0">
                <span className="text-xs text-slate-500 font-medium">Data Completeness</span>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full border ${
                    data.current.dataCompleteness === 'COMPLETE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : data.current.dataCompleteness === 'PARTIAL'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {data.current.dataCompleteness}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Engine: {data.current.calculationVersion}
                </span>
              </div>
            </div>

            {/* Component Cards (5 Measurable Factors) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                label="Attendance"
                value={data.current.attendanceScore !== null ? `${data.current.attendanceScore}%` : '—'}
                icon={CalendarCheck}
                color="blue"
                badge={`Weight ${data.weights?.attendanceWeight}%`}
                subtext={`${data.current.componentDetails?.attendance?.presentDays ?? 0} present / ${data.current.componentDetails?.attendance?.evaluatedDays ?? 0} days`}
              />

              <StatCard
                label="Task Completion"
                value={data.current.taskCompletionScore !== null ? `${data.current.taskCompletionScore}%` : '—'}
                icon={CheckSquare}
                color="indigo"
                badge={`Weight ${data.weights?.taskCompletionWeight}%`}
                subtext={`${data.current.componentDetails?.tasks?.completed ?? 0} / ${data.current.componentDetails?.tasks?.totalAssigned ?? 0} completed`}
              />

              <StatCard
                label="On-Time Delivery"
                value={data.current.onTimeCompletionScore !== null ? `${data.current.onTimeCompletionScore}%` : '—'}
                icon={Clock}
                color="emerald"
                badge={`Weight ${data.weights?.onTimeCompletionWeight}%`}
                subtext={`${data.current.componentDetails?.tasks?.onTimeCompleted ?? 0} on-time`}
              />

              <StatCard
                label="Class Coverage"
                value={data.current.classCompletionScore !== null ? `${data.current.classCompletionScore}%` : '—'}
                icon={BookOpen}
                color="amber"
                badge={`Weight ${data.weights?.classCompletionWeight}%`}
                subtext={`${data.current.componentDetails?.classes?.completedTeachingSessions ?? 0} sessions`}
              />

              <StatCard
                label="Operations"
                value={data.current.operationalActivityScore !== null ? `${data.current.operationalActivityScore}%` : '—'}
                icon={Activity}
                color="purple"
                badge={`Weight ${data.weights?.operationalActivityWeight}%`}
                subtext={`${(data.current.componentDetails?.operationalActivities?.adminCount || 0) +
                  (data.current.componentDetails?.operationalActivities?.meetingCount || 0) +
                  (data.current.componentDetails?.operationalActivities?.prepCount || 0)} activities`}
              />
            </div>

            {/* Performance History Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Historical Performance Snapshots</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {data.history.length} snapshots
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 font-semibold text-slate-600 border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Overall Score</th>
                      <th className="px-4 py-3">Attendance</th>
                      <th className="px-4 py-3">Tasks</th>
                      <th className="px-4 py-3">On-Time</th>
                      <th className="px-4 py-3">Classes</th>
                      <th className="px-4 py-3">Completeness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.history.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No historical performance records recorded.
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
                          <td className="px-4 py-3.5 font-bold font-mono text-blue-700">
                            {h.overall_score !== null ? `${h.overall_score}%` : '—'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.attendance_score !== null ? `${h.attendance_score}%` : '—'}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.task_completion_score !== null ? `${h.task_completion_score}%` : '—'}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.on_time_completion_score !== null ? `${h.on_time_completion_score}%` : '—'}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-700">{h.class_completion_score !== null ? `${h.class_completion_score}%` : '—'}</td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {h.data_completeness || 'COMPLETE'}
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

export default StaffPerformancePage;
