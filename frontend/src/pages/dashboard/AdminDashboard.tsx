import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterDataService } from '../../services/masterData.service';
import { operationsService } from '../../services/operations.service';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  Shield,
  Activity,
  Calendar,
  Users,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  CalendarCheck,
  BarChart3,
  Building2,
  ShieldAlert,
  Settings,
  RefreshCw,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    staffCount: 0,
    departmentsCount: 0,
    classesCount: 0,
    subjectsCount: 0,
    activeYear: 'Loading...',
    timetableSlots: 0,
    coveredClasses: 0,
    activeAlerts: 0,
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = () => {
    setLoading(true);
    // Load live counts and monitoring telemetry from database
    Promise.all([
      masterDataService.getStaffList({ pageSize: 1 }).catch(() => ({ meta: { total: 0 } })),
      masterDataService.getDepartments().catch(() => ({ departments: [] })),
      masterDataService.getClasses().catch(() => ({ classes: [] })),
      masterDataService.getSubjects().catch(() => ({ subjects: [] })),
      masterDataService.getAcademicYears().catch(() => ({ academicYears: [] })),
      masterDataService.getTimetable().catch(() => ({ timetable: [] })),
      operationsService.getClassCoverage().catch(() => ({ summary: { covered: 0 } })),
      operationsService.getMonitoringAlerts({ status: 'ACTIVE' }).catch(() => ({ alerts: [] })),
    ])
      .then(([staffRes, deptRes, classRes, subRes, yearRes, ttRes, covRes, alertRes]) => {
        const activeYearObj = yearRes.academicYears?.find((y: any) => y.active);
        setStats({
          staffCount: staffRes.meta?.total || 0,
          departmentsCount: deptRes.departments?.length || 0,
          classesCount: classRes.classes?.length || 0,
          subjectsCount: subRes.subjects?.length || 0,
          activeYear: activeYearObj ? activeYearObj.name : 'None',
          timetableSlots: ttRes.timetable?.length || 0,
          coveredClasses: covRes.summary?.covered || 0,
          activeAlerts: alertRes.alerts?.length || 0,
        });
        setAlerts(alertRes.alerts || []);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const coveragePercentage = stats.timetableSlots > 0
    ? Math.min(100, Math.round((stats.coveredClasses / stats.timetableSlots) * 100))
    : 0;

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Home', href: '/admin/dashboard' },
        { label: 'Operations Overview' },
      ]}
    >
      {/* Top Welcome Page Header */}
      <PageHeader
        title={`Welcome back, ${user?.fullName || 'Administrator'}`}
        subtitle="Real-time operational monitoring, class coverage tracking, automated PDF timetable management, and institutional intelligence."
        icon={Shield}
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            System Online • Active
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 transition-colors shadow-2xs"
              title="Refresh Data"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <Link
              to="/admin/ai-copilot"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Copilot</span>
            </Link>
            <Link
              to="/admin/timetable"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Timetable & PDF Import</span>
            </Link>
          </div>
        }
      />

      {/* Top-Level KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Faculty"
          value={stats.staffCount}
          icon={Users}
          color="blue"
          subtext="Institutional Staff"
          onClick={() => navigate('/admin/staff')}
        />
        <StatCard
          label="Timetable Slots"
          value={stats.timetableSlots}
          icon={Calendar}
          color="indigo"
          subtext="Scheduled Class Periods"
          onClick={() => navigate('/admin/timetable')}
        />
        <StatCard
          label="Class Coverage"
          value={stats.coveredClasses}
          icon={Activity}
          color="emerald"
          subtext="Recorded Classes"
          badge="Live"
          onClick={() => navigate('/admin/coverage')}
        />
        <StatCard
          label="Monitoring Signals"
          value={stats.activeAlerts}
          icon={AlertTriangle}
          color={stats.activeAlerts > 0 ? 'amber' : 'slate'}
          subtext="Active Operational Alerts"
          onClick={() => navigate('/admin/operations')}
        />
      </div>

      {/* Concise Operational Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Live Schedule & Coverage Status Panel */}
        <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Live Schedule & Class Coverage</h3>
                  <p className="text-xs text-slate-500">Real-time timetable execution tracking</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Telemetry Active
              </span>
            </div>

            {/* Coverage Progress Bar */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-slate-600">Coverage Fulfillment</span>
                <span className="font-bold text-slate-900">{coveragePercentage}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, coveragePercentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                <span>{stats.coveredClasses} recorded classes</span>
                <span>{stats.timetableSlots} scheduled periods</span>
              </div>
            </div>

            {/* Quick Metrics Row */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Academic Cycle</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">{stats.activeYear}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200/80">
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Faculty Roster</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">{stats.staffCount} Faculty Allocated</div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Automated timetable grid extraction & sync</span>
            <Link
              to="/admin/coverage"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 group"
            >
              <span>View Live Coverage</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Operational Signals & System Health Panel */}
        <div className="p-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                  stats.activeAlerts > 0
                    ? 'bg-amber-50 text-amber-600 border-amber-200/80'
                    : 'bg-blue-50 text-blue-600 border-blue-200/80'
                }`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Operational Signals & Rule Engine</h3>
                  <p className="text-xs text-slate-500">Deterministic checks and schedule verification</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                stats.activeAlerts > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {stats.activeAlerts > 0 ? `${stats.activeAlerts} Signal(s)` : 'All Nominal'}
              </span>
            </div>

            {/* Alert Status Banner */}
            {stats.activeAlerts > 0 ? (
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 mb-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-amber-900">
                      {stats.activeAlerts} Active Operational Signal{stats.activeAlerts > 1 ? 's' : ''} Detected
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      Timetable activity or schedule grace period signals require operational review in the Alert Center.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 mb-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-emerald-900">
                      All Operational Signals Nominal
                    </div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      Deterministic verification running every 5 minutes. No schedule violations or attendance discrepancies found.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rule Engine Status */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600 font-medium">Scheduled Rule Evaluator</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active • 5m Cron
              </span>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Conflict detection & grace tracking</span>
            <Link
              to="/admin/operations"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 group"
            >
              <span>Manage Signals & Jobs</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Operational Shortcuts Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <span>Quick Operational Navigation</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/staff"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Staff 360°</span>
            </Link>
            <Link
              to="/admin/attendance"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Attendance Ledger</span>
            </Link>
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Analytics & Workload</span>
            </Link>
            <Link
              to="/admin/audit-logs"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              <span>Audit Trail</span>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
