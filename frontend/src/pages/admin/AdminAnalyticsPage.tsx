import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Briefcase,
  Award,
  CalendarCheck,
  CheckSquare,
  Building2,
  Sliders,
  RefreshCw,
  Info,
  Layers,
  Check,
  X,
  Clock,
  PieChart,
} from 'lucide-react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  analyticsApi,
  AdminOverviewAnalytics,
  AdminWorkloadAnalytics,
  AdminPerformanceAnalytics,
  AdminAttendanceAnalytics,
  AdminTasksAnalytics,
  PerformanceWeights,
} from '../../services/analytics.service';
import { masterDataService } from '../../services/masterData.service';
import { useToast } from '../../components/common/Toast';

export const AdminAnalyticsPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'workload' | 'performance' | 'attendance' | 'tasks'>('overview');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewAnalytics | null>(null);
  const [workload, setWorkload] = useState<AdminWorkloadAnalytics | null>(null);
  const [performance, setPerformance] = useState<AdminPerformanceAnalytics | null>(null);
  const [attendance, setAttendance] = useState<AdminAttendanceAnalytics | null>(null);
  const [tasks, setTasks] = useState<AdminTasksAnalytics | null>(null);

  // Performance Weights Modal
  const [weightsModalOpen, setWeightsModalOpen] = useState(false);
  const [weightsForm, setWeightsForm] = useState<PerformanceWeights>({
    attendanceWeight: 20,
    taskCompletionWeight: 25,
    onTimeCompletionWeight: 20,
    classCompletionWeight: 25,
    operationalActivityWeight: 10,
  });
  const [savingWeights, setSavingWeights] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const deptFilter = selectedDepartment || undefined;
      const [ov, wl, pf, at, tk] = await Promise.all([
        analyticsApi.getAdminOverview(deptFilter),
        analyticsApi.getAdminWorkload(deptFilter),
        analyticsApi.getAdminPerformance(deptFilter),
        analyticsApi.getAdminAttendance(deptFilter),
        analyticsApi.getAdminTasks(deptFilter),
      ]);

      setOverview(ov);
      setWorkload(wl);
      setPerformance(pf);
      setAttendance(at);
      setTasks(tk);

      if (pf && pf.configuredWeights) {
        setWeightsForm(pf.configuredWeights);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load institutional analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDepartment, showToast]);

  const loadDepartments = async () => {
    try {
      const depts = await masterDataService.getDepartments();
      setDepartments(depts.departments || []);
    } catch {
      // Fallback silently if master data fails
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum =
      Number(weightsForm.attendanceWeight) +
      Number(weightsForm.taskCompletionWeight) +
      Number(weightsForm.onTimeCompletionWeight) +
      Number(weightsForm.classCompletionWeight) +
      Number(weightsForm.operationalActivityWeight);

    if (sum !== 100) {
      showToast(`Total sum must equal 100%. Current sum is ${sum}%.`, 'error');
      return;
    }

    setSavingWeights(true);
    try {
      await analyticsApi.updatePerformanceWeights(weightsForm);
      showToast('Performance weights updated successfully', 'success');
      setWeightsModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update weights', 'error');
    } finally {
      setSavingWeights(false);
    }
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Operations & Coverage' },
        { label: 'Institutional Analytics' },
      ]}
      searchPlaceholder="Filter institutional analytics..."
    >
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Institutional Analytics & Intelligence"
          subtitle="Real database analytics across institutional workload, performance metrics, attendance trends, and tasks."
          icon={BarChart3}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Live Database Metrics
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setWeightsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shadow-2xs"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-600" />
                <span>Configure Weights</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs shadow-blue-600/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          }
        />

        {/* Deterministic Analytics Notice */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-2xs">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <span className="font-semibold text-blue-950">Deterministic Analytics Standard: </span>
            All metrics reflect aggregate factual totals recorded in PostgreSQL. In compliance with platform standards, no comparative staff leaderboards or best/worst rankings are generated.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-2 bg-white p-1.5 rounded-2xl border shadow-2xs overflow-x-auto">
          {[
            { id: 'overview', label: 'Institutional Overview', icon: Layers },
            { id: 'workload', label: 'Workload Distribution', icon: Briefcase },
            { id: 'performance', label: 'Performance Evaluation', icon: Award },
            { id: 'attendance', label: 'Attendance Trends', icon: CalendarCheck },
            { id: 'tasks', label: 'Task Operations', icon: CheckSquare },
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
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <StatCard
                label="Faculty Roster"
                value={overview.totalStaff}
                icon={Users}
                color="blue"
                subtext="Active staff records"
              />
              <StatCard
                label="Attendance Today"
                value={overview.presentStaff}
                icon={CalendarCheck}
                color="emerald"
                subtext={`${overview.absentStaff} absent • ${overview.halfDayStaff} half`}
              />
              <StatCard
                label="Approved Leave"
                value={overview.staffOnApprovedLeave}
                icon={Clock}
                color="indigo"
                subtext="Authorized absence"
              />
              <StatCard
                label="Teaching Today"
                value={`${overview.completedClassesToday}/${overview.scheduledClassesToday}`}
                icon={TrendingUp}
                color="purple"
                subtext={overview.classCoveragePercentage !== null ? `${overview.classCoveragePercentage}% coverage` : 'No slots'}
              />
              <StatCard
                label="Active Tasks"
                value={overview.tasks.pending + overview.tasks.inProgress}
                icon={CheckSquare}
                color="amber"
                subtext={`${overview.tasks.overdue} overdue`}
              />
              <StatCard
                label="Operational Alerts"
                value={overview.openOperationalAlerts}
                icon={BarChart3}
                color="rose"
                subtext="Open signals"
              />
            </div>

            {/* Department Summary Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Departmental Distribution Summary</h3>
                  <p className="text-xs text-slate-500">Breakdown of staff, scheduled classes, and course subjects by department</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 font-semibold uppercase text-slate-500 border-b border-slate-200/80 text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Staff Count</th>
                      <th className="px-4 py-3">Classes</th>
                      <th className="px-4 py-3">Subjects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.departmentsSummary.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{d.name}</td>
                        <td className="px-4 py-3 font-mono text-blue-600 font-medium">{d.code}</td>
                        <td className="px-4 py-3">{d.staffCount}</td>
                        <td className="px-4 py-3">{d.classCount}</td>
                        <td className="px-4 py-3">{d.subjectCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WORKLOAD */}
        {activeTab === 'workload' && workload && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="Average Workload Score"
                value={workload.averageWorkloadScore !== null ? `${workload.averageWorkloadScore}/100` : '—'}
                icon={Briefcase}
                color="blue"
                subtext={`Across ${workload.totalEvaluated} faculty members`}
              />
              <StatCard
                label="Total Teaching Hours"
                value={`${workload.aggregateTotals.totalTeachingHours} hrs`}
                icon={Clock}
                color="indigo"
                subtext="Scheduled contact hours / mo"
              />
              <StatCard
                label="Total Active Tasks"
                value={workload.aggregateTotals.totalActiveTasks}
                icon={CheckSquare}
                color="amber"
                subtext={`${workload.aggregateTotals.totalOverdueTasks} overdue tasks`}
              />
              <StatCard
                label="Operational Activity"
                value={workload.aggregateTotals.totalAdminActivities}
                icon={Layers}
                color="purple"
                subtext="Admin, meeting & prep sessions"
              />
            </div>

            {/* Department Workload Summary */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-slate-200/80 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900">Departmental Workload Averages</h3>
                <p className="text-xs text-slate-500">Aggregate workload metrics by academic department</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 font-semibold uppercase text-slate-500 border-b border-slate-200/80 text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Average Workload Score</th>
                      <th className="px-4 py-3">Faculty Evaluated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workload.departmentSummary.map((d) => (
                      <tr key={d.departmentId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{d.departmentName}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{d.averageScore} / 100</td>
                        <td className="px-4 py-3">{d.staffEvaluated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PERFORMANCE */}
        {activeTab === 'performance' && performance && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <StatCard
                label="Overall Average"
                value={performance.averageScores?.overall !== undefined ? `${performance.averageScores.overall}%` : '—'}
                icon={Award}
                color="blue"
                subtext="Weighted composite"
              />
              <StatCard
                label="Attendance Rate"
                value={performance.averageScores?.attendance !== undefined ? `${performance.averageScores.attendance}%` : '—'}
                icon={CalendarCheck}
                color="emerald"
                subtext={`Weight: ${performance.configuredWeights.attendanceWeight}%`}
              />
              <StatCard
                label="Task Completion"
                value={performance.averageScores?.taskCompletion !== undefined ? `${performance.averageScores.taskCompletion}%` : '—'}
                icon={CheckSquare}
                color="indigo"
                subtext={`Weight: ${performance.configuredWeights.taskCompletionWeight}%`}
              />
              <StatCard
                label="On-Time Rate"
                value={performance.averageScores?.onTimeCompletion !== undefined ? `${performance.averageScores.onTimeCompletion}%` : '—'}
                icon={TrendingUp}
                color="amber"
                subtext={`Weight: ${performance.configuredWeights.onTimeCompletionWeight}%`}
              />
              <StatCard
                label="Class Completion"
                value={performance.averageScores?.classCompletion !== undefined ? `${performance.averageScores.classCompletion}%` : '—'}
                icon={Layers}
                color="purple"
                subtext={`Weight: ${performance.configuredWeights.classCompletionWeight}%`}
              />
            </div>

            {/* Score Range Distribution */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Performance Distribution Breakdown</h3>
              <p className="text-xs text-slate-500 mb-4">Faculty score clusters across configured scoring ranges</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(performance.scoreDistribution).map(([range, count]) => (
                  <div key={range} className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                    <div className="text-xs text-slate-600 font-semibold">{range}</div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{count}</div>
                    <div className="text-[11px] text-slate-500">faculty records</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ATTENDANCE TRENDS */}
        {activeTab === 'attendance' && attendance && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-1">30-Day Institutional Attendance Activity</h3>
              <p className="text-xs text-slate-500 mb-4">Daily faculty presence and exception totals recorded in database.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 font-semibold uppercase text-slate-500 border-b border-slate-200/80 text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Present</th>
                      <th className="px-4 py-2.5">Absent</th>
                      <th className="px-4 py-2.5">Half-Day</th>
                      <th className="px-4 py-2.5">Leave</th>
                      <th className="px-4 py-2.5">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.timeline.map((day) => (
                      <tr key={day.date} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{day.date}</td>
                        <td className="px-4 py-2.5 text-emerald-600 font-semibold">{day.present}</td>
                        <td className="px-4 py-2.5 text-rose-600">{day.absent}</td>
                        <td className="px-4 py-2.5 text-amber-600">{day.halfDay}</td>
                        <td className="px-4 py-2.5 text-blue-600">{day.leave}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{day.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TASKS */}
        {activeTab === 'tasks' && tasks && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Task Status Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(tasks.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50/50">
                      <span className="text-slate-700 font-semibold">{status}</span>
                      <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Task Priority Breakdown</h3>
                <div className="space-y-3">
                  {Object.entries(tasks.byPriority).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50/50">
                      <span className="text-slate-700 font-semibold">{priority}</span>
                      <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Weights Modal */}
        {weightsModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Configure Performance Weights</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customize composite scoring weights. Sum must strictly equal 100%.
                  </p>
                </div>
                <button
                  onClick={() => setWeightsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveWeights} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Attendance Weight (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.attendanceWeight}
                    onChange={(e) =>
                      setWeightsForm({ ...weightsForm, attendanceWeight: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Task Completion Weight (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.taskCompletionWeight}
                    onChange={(e) =>
                      setWeightsForm({ ...weightsForm, taskCompletionWeight: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    On-Time Completion Weight (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.onTimeCompletionWeight}
                    onChange={(e) =>
                      setWeightsForm({ ...weightsForm, onTimeCompletionWeight: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Class Completion Weight (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.classCompletionWeight}
                    onChange={(e) =>
                      setWeightsForm({ ...weightsForm, classCompletionWeight: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Operational Activity Weight (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weightsForm.operationalActivityWeight}
                    onChange={(e) =>
                      setWeightsForm({
                        ...weightsForm,
                        operationalActivityWeight: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div className="text-xs text-slate-600">
                    Total Sum:{' '}
                    <span
                      className={`font-bold ${
                        Number(weightsForm.attendanceWeight) +
                          Number(weightsForm.taskCompletionWeight) +
                          Number(weightsForm.onTimeCompletionWeight) +
                          Number(weightsForm.classCompletionWeight) +
                          Number(weightsForm.operationalActivityWeight) ===
                        100
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {Number(weightsForm.attendanceWeight) +
                        Number(weightsForm.taskCompletionWeight) +
                        Number(weightsForm.onTimeCompletionWeight) +
                        Number(weightsForm.classCompletionWeight) +
                        Number(weightsForm.operationalActivityWeight)}
                      %
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWeightsModalOpen(false)}
                      className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingWeights}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
                    >
                      {savingWeights ? 'Saving...' : 'Save Weights'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAnalyticsPage;
