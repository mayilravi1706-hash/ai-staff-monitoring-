import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { masterDataService } from '../../services/masterData.service';
import { StaffEntity, Department, PaginationMeta } from '../../types/masterData';
import { useToast } from '../../components/common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  Users,
  Plus,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Building2,
  Mail,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  ShieldAlert,
} from 'lucide-react';

export const AdminStaffPage: React.FC = () => {
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState<StaffEntity[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, pageSize: 10, totalPages: 1 });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStaffForAction, setSelectedStaffForAction] = useState<StaffEntity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteActionError, setDeleteActionError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    staff_id: '',
    full_name: '',
    password: '',
    department_id: '',
    designation: '',
    role: 'STAFF',
    qualification: '',
    phone: '',
    joining_date: new Date().toISOString().split('T')[0],
    experience: 0,
    emergency_contact: '',
  });

  const fetchStaff = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const res = await masterDataService.getStaffList({
          search: searchTerm || undefined,
          department_id: selectedDept || undefined,
          status: selectedStatus || undefined,
          role: selectedRole || undefined,
          page: pageToLoad,
          pageSize: 10,
        });
        setStaffList(res.staff);
        setMeta(res.meta);
      } catch (err: unknown) {
        showToast(getErrorMessage(err, 'Failed to retrieve staff directory'), 'error');
      } finally {
        setLoading(false);
      }
    },
    [searchTerm, selectedDept, selectedStatus, selectedRole, showToast]
  );

  const fetchDepartments = async () => {
    try {
      const data = await masterDataService.getDepartments();
      const list = data.departments || [];
      setDepartments(list);
      if (list.length > 0 && !formData.department_id) {
        setFormData((prev) => ({ ...prev, department_id: list[0].id }));
      }
    } catch {
      // Handled silently
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchStaff]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await masterDataService.createStaff(formData);
      showToast('Staff profile and account created successfully', 'success');
      setIsAddModalOpen(false);
      setFormData({
        email: '',
        staff_id: '',
        full_name: '',
        password: '',
        department_id: departments[0]?.id || '',
        designation: '',
        role: 'STAFF',
        qualification: '',
        phone: '',
        joining_date: new Date().toISOString().split('T')[0],
        experience: 0,
        emergency_contact: '',
      });
      fetchStaff(1);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to create staff member'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff: StaffEntity) => {
    const newStatus = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await masterDataService.updateStaff(staff.id, { status: newStatus });
      showToast(
        newStatus === 'ACTIVE'
          ? `Staff ${staff.full_name} reactivated.`
          : `Staff ${staff.full_name} deactivated and active sessions terminated.`,
        'success'
      );
      fetchStaff(meta.page);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to update staff status'), 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedStaffForAction || submitting) return;
    try {
      setSubmitting(true);
      setDeleteActionError(null);
      const res = await masterDataService.deleteStaff(selectedStaffForAction.id);
      const successMessage = res.message || 'Staff record processed successfully.';
      showToast(successMessage, 'success');
      setIsDeleteModalOpen(false);
      setSelectedStaffForAction(null);
      fetchStaff(meta.page);
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, 'Failed to process staff deletion');
      setDeleteActionError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Staff 360°', href: '/admin/staff' },
      ]}
      searchPlaceholder="Search staff by name, email, or ID..."
      onSearch={(q) => setSearchTerm(q)}
    >
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Staff & Faculty Directory"
          subtitle="Manage institutional faculty, department allocations, authentication roles, and account lifecycles."
          icon={Users}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Staff 360° Management
            </span>
          }
          actions={
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          }
        />

        {/* Filter Bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-600 font-semibold block mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, email, or staff code..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-600 font-semibold block mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-semibold block mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-semibold block mb-1">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Roles</option>
              <option value="STAFF">STAFF</option>
              <option value="ADMIN">ADMIN</option>
              <option value="HOD">HOD</option>
            </select>
          </div>
        </div>

        {/* Staff Table */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold border-b border-slate-200/80 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Staff Identifier</th>
                  <th className="px-5 py-3.5">Name & Email</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Designation</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <div>Loading staff directory...</div>
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <div className="text-slate-800 font-semibold">No staff members found matching criteria.</div>
                      <div className="text-slate-500 text-[11px] mt-1">Try adjusting your filters or search keywords.</div>
                    </td>
                  </tr>
                ) : (
                  staffList.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-semibold text-blue-600">
                        {staff.staff_id}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{staff.full_name}</div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{staff.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">
                          {staff.department?.name || 'Unassigned'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {staff.department?.code}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{staff.designation}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            staff.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            staff.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              staff.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          {staff.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/admin/staff/${staff.id}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                            title="View Profile Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => handleToggleStatus(staff)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              staff.status === 'ACTIVE'
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                            title={staff.status === 'ACTIVE' ? 'Deactivate Staff' : 'Reactivate Staff'}
                          >
                            {staff.status === 'ACTIVE' ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedStaffForAction(staff);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                            title="Delete / Deactivate Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{staffList.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{meta.total}</span> staff members
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => fetchStaff(meta.page - 1)}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-colors shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-slate-800 font-semibold shadow-2xs">
                Page {meta.page} of {meta.totalPages || 1}
              </span>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => fetchStaff(meta.page + 1)}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 transition-colors shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Add Staff Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl p-6 my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Register New Staff Member</h3>
                    <p className="text-xs text-slate-500">Creates institutional staff record and linked login account</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Staff ID Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.staff_id}
                      onChange={(e) => setFormData({ ...formData, staff_id: e.target.value.toUpperCase() })}
                      placeholder="e.g. STF-CSE-009"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 uppercase font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                      placeholder="rajesh.sharma@college.demo"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min 8 characters (e.g. Staff@123)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
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
                    <label className="block text-slate-700 font-semibold mb-1">
                      Designation <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      placeholder="e.g. Associate Professor"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">System Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="STAFF">STAFF (Teaching & Academic Ops)</option>
                      <option value="ADMIN">ADMIN (Institutional Administrator)</option>
                      <option value="HOD">HOD (Head of Department)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Joining Date</label>
                    <input
                      type="date"
                      required
                      value={formData.joining_date}
                      onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Years of Experience</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.experience}
                      onChange={(e) => setFormData({ ...formData, experience: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Qualifications</label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      placeholder="e.g. M.Tech, Ph.D. in Computer Science"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Emergency Contact</label>
                    <input
                      type="text"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      placeholder="e.g. Spouse / Parent Name and Number"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
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
                    <span>Create Account</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete / Deactivate Confirmation Dialog */}
        {isDeleteModalOpen && selectedStaffForAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900">Confirm Staff Removal</h3>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedStaffForAction(null);
                    setDeleteActionError(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-700 leading-relaxed">
                  Are you sure you want to remove <span className="font-semibold text-slate-900">{selectedStaffForAction.full_name}</span> ({selectedStaffForAction.staff_id})?
                </p>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <strong>Database Integrity Protection:</strong> If this staff member has historical records (attendance, tasks, timetable, or leaves), the account will be safely deactivated to preserve relational auditing while terminating all active sessions.
                </div>

                {deleteActionError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{deleteActionError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setSelectedStaffForAction(null);
                    setDeleteActionError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-xs"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{submitting ? 'Processing...' : 'Confirm Removal'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStaffPage;
