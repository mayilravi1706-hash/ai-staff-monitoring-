import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { operationsService } from '../../services/operations.service';
import { analyticsApi, StaffOverviewAnalytics } from '../../services/analytics.service';
import { UnifiedAppLayout } from '../../layouts/UnifiedAppLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge, getStatusBadgeVariant } from '../../components/common/Badge';
import {
  ActivityEntity,
  ActivityStatus,
  AttendanceEntity,
  AttendanceStatus,
  ClassMonitoringAlertEntity,
  CurrentActivityResponse,
} from '../../types/operations';
import {
  GraduationCap,
  Building2,
  CheckCircle2,
  Clock,
  BookOpen,
  Users,
  Briefcase,
  Coffee,
  CalendarX,
  FileText,
  AlertTriangle,
  Play,
  StopCircle,
  CalendarCheck,
  ArrowRight,
  RefreshCw,
  Info,
  Award,
  Sparkles,
  MapPin,
  Calendar,
  X,
} from 'lucide-react';

const ACTIVITY_OPTIONS: Array<{
  status: ActivityStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'emerald' | 'blue' | 'indigo' | 'purple' | 'cyan' | 'amber' | 'rose';
}> = [
  {
    status: 'TEACHING',
    label: 'Teaching',
    description: 'Lecture, lab, or tutorial instruction',
    icon: BookOpen,
    color: 'emerald',
  },
  {
    status: 'MEETING',
    label: 'Meeting',
    description: 'Departmental, committee, or counseling',
    icon: Users,
    color: 'blue',
  },
  {
    status: 'PREPARING_CLASS',
    label: 'Preparing Class',
    description: 'Lesson planning, notes prep, grading',
    icon: FileText,
    color: 'indigo',
  },
  {
    status: 'ADMINISTRATIVE_WORK',
    label: 'Administrative',
    description: 'Documentation, accreditation, exam duties',
    icon: Briefcase,
    color: 'purple',
  },
  {
    status: 'AVAILABLE',
    label: 'Available',
    description: 'In faculty chamber, office hours, research',
    icon: CheckCircle2,
    color: 'cyan',
  },
  {
    status: 'BREAK',
    label: 'Break',
    description: 'Recess or lunch interval',
    icon: Coffee,
    color: 'amber',
  },
  {
    status: 'LEAVE',
    label: 'Leave',
    description: 'Official leave, duty-leave, or medical',
    icon: CalendarX,
    color: 'rose',
  },
];

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityData, setActivityData] = useState<CurrentActivityResponse | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceEntity[]>([]);
  const [alerts, setAlerts] = useState<ClassMonitoringAlertEntity[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityEntity[]>([]);
  const [overviewStats, setOverviewStats] = useState<StaffOverviewAnalytics | null>(null);

  // Update Work Form state
  const [selectedStatus, setSelectedStatus] = useState<ActivityStatus>('TEACHING');
  const [workNotes, setWorkNotes] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [submittingWork, setSubmittingWork] = useState(false);
  const [endingActivity, setEndingActivity] = useState(false);

  // Attendance Form state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('PRESENT');
  const [attendanceRemarks, setAttendanceRemarks] = useState('');
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      const [currentActRes, attRes, alertRes, actListRes, overRes] = await Promise.all([
        operationsService.getCurrentActivity(),
        operationsService.getAttendance({ pageSize: 10 }),
        operationsService.getMonitoringAlerts({ status: 'ACTIVE' }),
        operationsService.getActivities({ pageSize: 5 }),
        analyticsApi.getStaffOverview().catch(() => null),
      ]);

      setActivityData(currentActRes);
      setAttendanceRecords(attRes.records || []);
      setAlerts(alertRes.alerts || []);
      setRecentActivities(actListRes.activities || []);
      if (overRes) setOverviewStats(overRes);
    } catch (err: any) {
      showError(err.message || 'Failed to load operational staff data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  // Submit Update Current Work
  const handleUpdateCurrentWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWork(true);

    try {
      const payload: any = {
        activity_status: selectedStatus,
        notes: workNotes.trim() || undefined,
        duration_minutes: durationMinutes,
      };

      // If status is TEACHING and expected class exists, link to it
      if (selectedStatus === 'TEACHING' && activityData?.expectedClass) {
        payload.timetable_id = activityData.expectedClass.timetableId;
        payload.class_id = activityData.expectedClass.classId;
        payload.subject_id = activityData.expectedClass.subjectId;
        payload.room = activityData.expectedClass.room || null;
      }

      await operationsService.logActivity(payload);
      showSuccess(`Current work status updated to ${selectedStatus.replace(/_/g, ' ')}`);
      setWorkNotes('');
      await loadAllData();
    } catch (err: any) {
      showError(err.message || 'Failed to update current activity');
    } finally {
      setSubmittingWork(false);
    }
  };

  // End active activity
  const handleEndActivity = async (activityId: string) => {
    setEndingActivity(true);
    try {
      await operationsService.updateActivity(activityId, {
        actual_end_time: new Date().toISOString(),
      });
      showSuccess('Active work session concluded.');
      await loadAllData();
    } catch (err: any) {
      showError(err.message || 'Failed to end activity');
    } finally {
      setEndingActivity(false);
    }
  };

  // Mark Today's Attendance
  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAttendance(true);

    try {
      await operationsService.markAttendance({
        status: attendanceStatus,
        remarks: attendanceRemarks.trim() || undefined,
      });
      showSuccess(`Attendance successfully recorded as ${attendanceStatus}.`);
      setShowAttendanceModal(false);
      setAttendanceRemarks('');
      await loadAllData();
    } catch (err: any) {
      showError(err.message || 'Failed to mark attendance');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  // Acknowledge Alert
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await operationsService.updateMonitoringAlert(alertId, 'ACKNOWLEDGED');
      showSuccess('Operational monitoring alert acknowledged.');
      await loadAllData();
    } catch (err: any) {
      showError(err.message || 'Failed to update alert');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceRecords.find((rec) =>
    rec.attendance_date.startsWith(todayStr)
  );

  return (
    <UnifiedAppLayout
      breadcrumbs={[
        { label: 'Home', href: '/staff/dashboard' },
        { label: 'Faculty Workspace' },
      ]}
    >
      {/* Page Header */}
      <PageHeader
        title={`Faculty Workspace: ${user?.fullName || 'Faculty Member'}`}
        subtitle={`Staff ID: ${user?.staffId || 'STF'} • Department: ${user?.department?.name || 'Academic Faculty'}`}
        icon={GraduationCap}
        badge={
          <Badge variant={todayAttendance ? 'emerald' : 'amber'} dot>
            {todayAttendance ? `Attendance: ${todayAttendance.status}` : 'Attendance: Not Recorded Today'}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200/90 hover:bg-slate-50 shadow-2xs transition-colors"
              title="Refresh Real-time Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {!todayAttendance && (
              <button
                type="button"
                onClick={() => setShowAttendanceModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors flex items-center gap-1.5"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Record Attendance</span>
              </button>
            )}

            <Link
              to="/staff/ai-assistant"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Assistant</span>
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        {/* OPERATIONAL MONITORING ALERTS BANNER */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {alert.title}
                      </span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-200/80 text-amber-800">
                        MONITORING SIGNAL
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {alert.message}
                    </p>
                    <div className="mt-2 text-[11px] text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded inline-flex items-center gap-1.5">
                      <Info className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>
                        This is an operational monitoring signal based on timetable records and does not establish staff absence.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStatus('TEACHING');
                      handleAcknowledgeAlert(alert.id);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-xs"
                  >
                    Record Teaching Activity
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CURRENT EXPECTED CLASS HERO CARD */}
        <div className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 border border-blue-100 text-blue-700">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Server Time Authority: {activityData?.serverTime.timeStr || '--:--'} • {activityData?.serverTime.dayName || 'Today'}
                </span>
              </div>

              {activityData?.expectedClass ? (
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>Scheduled Lecture In Session</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    {activityData.expectedClass.className} — {activityData.expectedClass.subjectName}
                  </h2>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                      Code: {activityData.expectedClass.subjectCode}
                    </span>
                    <span>•</span>
                    <span className="text-slate-700 font-medium">
                      Scheduled: {activityData.expectedClass.startTime} – {activityData.expectedClass.endTime}
                    </span>
                    {activityData.expectedClass.room && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                          Room: {activityData.expectedClass.room}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    No Scheduled Lecture in This Time Window
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    You have no scheduled class in the institutional timetable for the current hour. You can log preparation, meetings, or research.
                  </p>
                </div>
              )}
            </div>

            {/* Active Activity State Widget */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 lg:w-72 shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-medium">Current Status</span>
                {activityData?.activity ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    IN PROGRESS
                  </span>
                ) : (
                  <span className="text-slate-400">Idle / Not Logged</span>
                )}
              </div>

              {activityData?.activity ? (
                <div>
                  <div className="text-base font-bold text-slate-900 capitalize">
                    {activityData.activity.activity_status.replace(/_/g, ' ').toLowerCase()}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Started at: {new Date(activityData.activity.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEndActivity(activityData.activity!.id)}
                    disabled={endingActivity}
                    className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Conclude Current Work</span>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-slate-500">
                    Select an activity below to record your current task or class.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LOG ACTIVITY WORKFLOW */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Log Current Activity & Duty
              </h3>
              <p className="text-xs text-slate-500">
                Update what you are currently engaged in (Teaching, Preparation, Meeting, Administrative, etc.)
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateCurrentWork} className="space-y-5">
            {/* Activity Category Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {ACTIVITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedStatus === opt.status;
                return (
                  <button
                    key={opt.status}
                    type="button"
                    onClick={() => setSelectedStatus(opt.status)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Notes and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Work Description / Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="e.g. Conducted Unit 3 Knowledge Engineering Lab, or Department Council meeting..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Session Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 transition-all"
                >
                  <option value={45}>45 Minutes (Single Period)</option>
                  <option value={55}>55 Minutes (Full Period)</option>
                  <option value={60}>60 Minutes (Standard Hour)</option>
                  <option value={110}>110 Minutes (Double Period / Lab)</option>
                  <option value={120}>2 Hours (Workshop / Lab)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={submittingWork}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {submittingWork ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>Log Current Work Session</span>
              </button>
            </div>
          </form>
        </div>

        {/* TODAY'S CLASS SCHEDULE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Today's Timetable Schedule & Coverage
              </h3>
              <p className="text-xs text-slate-500">
                Scheduled periods for today from institutional timetable records.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {activityData?.todaySchedule.length || 0} Slots Today
            </span>
          </div>

          <div className="overflow-x-auto">
            {activityData?.todaySchedule && activityData.todaySchedule.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Period / Time</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Class & Section</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Coverage Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityData.todaySchedule.map((slot, idx) => {
                    const subjectDisplay = slot.subject ? `${slot.subject.name} (${slot.subject.code})` : 'Subject';
                    const classDisplay = slot.class ? (slot.class.section ? `${slot.class.name} - Sec ${slot.class.section}` : slot.class.name) : 'Class';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                          {slot.startTime} – {slot.endTime}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {subjectDisplay}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {classDisplay}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {slot.room || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={getStatusBadgeVariant(slot.coverage)} dot>
                            {slot.coverage.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {slot.coverage !== 'COVERED' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStatus('TEACHING');
                                setWorkNotes(`Conducting ${slot.subject?.name || 'Lecture'} for ${slot.class?.name || 'Class'}`);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              Record Lecture
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Recorded</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No classes scheduled for today. Enjoy your research, preparation, or scheduled office hours.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECORD ATTENDANCE MODAL */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Today's Attendance</h3>
                  <p className="text-[11px] text-slate-500">Date: {todayStr}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMarkAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PRESENT', 'ON_LEAVE', 'ABSENT'] as AttendanceStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setAttendanceStatus(status)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        attendanceStatus === status
                          ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={attendanceRemarks}
                  onChange={(e) => setAttendanceRemarks(e.target.value)}
                  placeholder="e.g. On-duty faculty inspection, or present on campus..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAttendance}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
                >
                  {submittingAttendance ? 'Saving...' : 'Confirm Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </UnifiedAppLayout>
  );
};
