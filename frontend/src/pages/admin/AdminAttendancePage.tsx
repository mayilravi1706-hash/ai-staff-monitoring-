import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/common/Toast';
import { operationsService } from '../../services/operations.service';
import { masterDataService } from '../../services/masterData.service';
import { StaffEntity } from '../../types/masterData';
import { AttendanceEntity, AttendanceStatus } from '../../types/operations';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  CalendarCheck,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Users,
  CheckCircle2,
  CalendarX,
  AlertCircle,
  X,
  Clock,
} from 'lucide-react';

export const AdminAttendancePage: React.FC = () => {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<AttendanceEntity[]>([]);
  const [staffList, setStaffList] = useState<StaffEntity[]>([]);

  // Filter state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchStaff, setSearchStaff] = useState<string>('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formStaffId, setFormStaffId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<AttendanceStatus>('PRESENT');
  const [formRemarks, setFormRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [attRes, staffRes] = await Promise.all([
        operationsService.getAttendance({
          date: selectedDate || undefined,
          status: selectedStatus || undefined,
          pageSize: 100,
        }),
        masterDataService.getStaffList({ pageSize: 100 }),
      ]);

      setRecords(attRes.records || []);
      setStaffList(staffRes.staff || []);
    } catch (err: any) {
      showError(err.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedStatus, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStaffId) {
      showError('Please select a staff member');
      return;
    }

    setSubmitting(true);
    try {
      await operationsService.markAttendance({
        staff_id: formStaffId,
        attendance_date: formDate,
        status: formStatus,
        remarks: formRemarks.trim() || undefined,
      });

      showSuccess('Attendance record created successfully.');
      setShowModal(false);
      setFormRemarks('');
      await loadData();
    } catch (err: any) {
      showError(err.message || 'Failed to save attendance record');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!searchStaff.trim()) return true;
    const q = searchStaff.toLowerCase();
    return (
      r.staff?.full_name.toLowerCase().includes(q) ||
      r.staff?.staff_id.toLowerCase().includes(q)
    );
  });

  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const leaveCount = records.filter((r) => r.status === 'LEAVE').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Operations & Coverage' },
        { label: 'Attendance Management' },
      ]}
      searchPlaceholder="Search attendance by staff name or ID..."
      onSearch={(q) => setSearchStaff(q)}
    >
      <div className="space-y-6">
        <PageHeader
          title="Attendance Management"
          subtitle="Daily faculty presence logs, leave verification, and daily uniqueness checks"
          icon={CalendarCheck}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Verified Logs
            </span>
          }
          actions={
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (staffList.length > 0 && !formStaffId) {
                    setFormStaffId(staffList[0].id);
                  }
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Attendance</span>
              </button>
            </div>
          }
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Logs"
            value={records.length}
            icon={Users}
            color="blue"
            subtext="Loaded attendance records"
          />
          <StatCard
            label="Present Today"
            value={presentCount}
            icon={CheckCircle2}
            color="emerald"
            badge="On Duty"
          />
          <StatCard
            label="On Approved Leave"
            value={leaveCount}
            icon={CalendarX}
            color="rose"
            badge="Excused"
          />
          <StatCard
            label="Absent / Unmarked"
            value={absentCount}
            icon={AlertCircle}
            color="amber"
            badge="Attention"
          />
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[260px]">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by faculty name or staff ID..."
                value={searchStaff}
                onChange={(e) => setSearchStaff(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
                <option value="HALF_DAY">HALF DAY</option>
                <option value="LEAVE">LEAVE</option>
                <option value="PERMISSION">PERMISSION</option>
              </select>
            </div>

            {(selectedDate || selectedStatus || searchStaff) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate('');
                  setSelectedStatus('');
                  setSearchStaff('');
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance Log Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">Chronological record of faculty member daily entries</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {filteredRecords.length} records
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-xs text-slate-500">Loading attendance data...</p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Attendance Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recorded At</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{rec.staff?.full_name}</div>
                        <div className="font-mono text-[11px] text-blue-600">{rec.staff?.staff_id}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {rec.staff?.department?.name || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {new Date(rec.attendance_date).toISOString().split('T')[0]}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.status === 'LEAVE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : rec.status === 'HALF_DAY'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 italic max-w-xs truncate">
                        {rec.remarks || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No attendance records found</p>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or date range.</p>
            </div>
          )}
        </div>
      </div>

      {/* RECORD ATTENDANCE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Faculty Attendance</h3>
                  <p className="text-[11px] text-slate-500">Daily verification entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Faculty Member <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formStaffId}
                  onChange={(e) => setFormStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select staff profile...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.staff_id}) — {s.department?.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attendance Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Attendance Status <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'PERMISSION'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFormStatus(st)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                        formStatus === st
                          ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. Administrative duties verified"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={500}
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <p>
                  • <strong>Daily Uniqueness:</strong> System ensures only one log per staff member per date.
                </p>
                <p className="mt-1">
                  • <strong>Leave Consistency:</strong> An approved leave prevents conflicting PRESENT status.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs shadow-blue-600/20"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
