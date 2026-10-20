import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { masterDataService } from '../../services/masterData.service';
import { StaffEntity, Department, TimetableEntity } from '../../types/masterData';
import { useToast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  Users,
  Building2,
  Mail,
  Briefcase,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  X,
  AlertCircle,
  Calendar,
  Trash2,
  ShieldAlert,
} from 'lucide-react';

export const AdminStaffDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [staff, setStaff] = useState<StaffEntity | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntity[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    department_id: '',
    designation: '',
    role: 'STAFF',
    qualification: '',
    phone: '',
    experience: 0,
    emergency_contact: '',
    address: '',
    status: 'ACTIVE',
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchStaffDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await masterDataService.getStaffById(id);
      setStaff(data);
      setEditFormData({
        full_name: data.full_name,
        department_id: data.department_id,
        designation: data.designation,
        role: data.role,
        qualification: data.qualification || '',
        phone: data.phone || '',
        experience: data.experience || 0,
        emergency_contact: data.emergency_contact || '',
        address: data.address || '',
        status: data.status,
      });

      // Fetch timetable
      const ttRes = await masterDataService.getTimetable({ staffId: id });
      setTimetable(ttRes.timetable || []);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to fetch staff details'), 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  const fetchDepartments = async () => {
    try {
      const data = await masterDataService.getDepartments();
      setDepartments(data.departments || []);
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchStaffDetails();
    fetchDepartments();
  }, [fetchStaffDetails]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    try {
      setSubmitting(true);
      await masterDataService.updateStaff(staff.id, editFormData);
      showToast('Staff profile updated successfully', 'success');
      setIsEditModalOpen(false);
      fetchStaffDetails();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to update profile'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!staff) return;
    const newStatus = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await masterDataService.updateStaff(staff.id, { status: newStatus });
      showToast(
        newStatus === 'ACTIVE' ? 'Staff profile reactivated' : 'Staff profile deactivated',
        'success'
      );
      fetchStaffDetails();
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to update status'), 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!staff || deleteSubmitting) return;
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);
      const res = await masterDataService.deleteStaff(staff.id);
      const successMsg = res.message || 'Staff record processed successfully.';
      showToast(successMsg, 'success');
      setIsDeleteModalOpen(false);
      navigate('/admin/staff');
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, 'Failed to process staff deletion');
      setDeleteError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout breadcrumbs={[{ label: 'Staff Management', href: '/admin/staff' }, { label: 'Loading...' }]}>
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-slate-500 text-xs font-medium">Loading staff member dossier...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!staff) {
    return (
      <AdminLayout breadcrumbs={[{ label: 'Staff Management', href: '/admin/staff' }, { label: 'Not Found' }]}>
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Staff Member Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">The requested staff record could not be retrieved from PostgreSQL.</p>
          <Link
            to="/admin/staff"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Staff Directory</span>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const daysMap = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Staff 360°', href: '/admin/staff' },
        { label: staff.full_name },
      ]}
    >
      <div className="space-y-6">
        {/* Top Profile Header */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xs">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xl shadow-2xs">
              {staff.full_name[0].toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{staff.full_name}</h1>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  {staff.staff_id}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    staff.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {staff.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {staff.role}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <span className="font-medium text-slate-700">{staff.designation}</span>
                <span className="text-slate-300">•</span>
                <span className="text-blue-600 font-medium">{staff.department?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={handleToggleStatus}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs ${
                staff.status === 'ACTIVE'
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {staff.status === 'ACTIVE' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
              <span>{staff.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</span>
            </button>

            <button
              onClick={() => {
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              disabled={deleteSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-semibold border border-rose-200 shadow-2xs transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Staff</span>
            </button>
          </div>
        </div>

        {/* Information Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact & Personal Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Mail className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Contact & Personal Details</h2>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-slate-500 font-medium">Institutional Email</dt>
                <dd className="font-mono text-slate-900 font-semibold mt-1">{staff.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Phone Number</dt>
                <dd className="text-slate-900 font-medium mt-1">{staff.phone || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Emergency Contact</dt>
                <dd className="text-slate-900 font-medium mt-1">{staff.emergency_contact || 'None specified'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Residential Address</dt>
                <dd className="text-slate-900 font-medium mt-1">{staff.address || 'Not provided'}</dd>
              </div>
            </dl>
          </div>

          {/* Academic & Professional Card */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Academic & Professional Background</h2>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-slate-500 font-medium">Department</dt>
                <dd className="text-slate-900 mt-1 font-semibold">
                  {staff.department?.name} ({staff.department?.code})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Designation</dt>
                <dd className="text-slate-900 font-medium mt-1">{staff.designation}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Academic Qualifications</dt>
                <dd className="text-slate-900 font-medium mt-1">{staff.qualification || 'M.Tech / Ph.D.'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Total Experience</dt>
                <dd className="text-slate-900 font-medium mt-1">{staff.experience || 0} Years</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Joining Date</dt>
                <dd className="text-slate-900 font-medium mt-1">
                  {new Date(staff.joining_date).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Last User Login</dt>
                <dd className="text-slate-900 font-medium mt-1">
                  {staff.user?.last_login_at
                    ? new Date(staff.user.last_login_at).toLocaleString()
                    : 'Never logged in'}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Scheduled Timetable Sessions */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Scheduled Timetable Sessions</h2>
            </div>
            <Link
              to="/admin/timetable"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              Manage Timetables →
            </Link>
          </div>

          {timetable.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No timetable slots currently assigned to this faculty member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Day of Week</th>
                    <th className="px-5 py-3">Time Slot</th>
                    <th className="px-5 py-3">Subject</th>
                    <th className="px-5 py-3">Class</th>
                    <th className="px-5 py-3">Room</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timetable.map((slot) => (
                    <tr key={slot.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {daysMap[slot.day_of_week] || `Day ${slot.day_of_week}`}
                      </td>
                      <td className="px-5 py-3 font-mono text-blue-600 font-semibold">
                        {slot.start_time} - {slot.end_time}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-900">{slot.subject?.name}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {slot.subject?.code}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{slot.class?.name}</td>
                      <td className="px-5 py-3 text-slate-600">{slot.room || 'General Hall'}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {slot.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Profile Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl p-6 my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Edit Staff Record: {staff.staff_id}</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="mt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editFormData.full_name}
                      onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                    <input
                      type="text"
                      required
                      value={editFormData.designation}
                      onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Department</label>
                    <select
                      value={editFormData.department_id}
                      onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} - {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Role</label>
                    <select
                      value={editFormData.role}
                      onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="HOD">HOD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Years of Experience</label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.experience}
                      onChange={(e) => setEditFormData({ ...editFormData, experience: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Qualifications</label>
                    <input
                      type="text"
                      value={editFormData.qualification}
                      onChange={(e) => setEditFormData({ ...editFormData, qualification: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Emergency Contact</label>
                    <input
                      type="text"
                      value={editFormData.emergency_contact}
                      onChange={(e) => setEditFormData({ ...editFormData, emergency_contact: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Address</label>
                    <input
                      type="text"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center gap-2 shadow-xs"
                  >
                    {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete / Deactivate Confirmation Dialog */}
        {isDeleteModalOpen && staff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900">Confirm Staff Removal</h3>
                </div>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteError(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-slate-900">{staff.full_name}</span> ({staff.staff_id})?
                </p>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <strong>Database Integrity Protection:</strong> If this staff member has historical records (attendance, tasks, timetable, or leaves), the account will be safely deactivated to preserve historical auditing while instantly terminating all active sessions.
                </div>

                {deleteError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{deleteError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-xs"
                >
                  {deleteSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{deleteSubmitting ? 'Processing...' : 'Confirm Removal'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStaffDetailPage;
