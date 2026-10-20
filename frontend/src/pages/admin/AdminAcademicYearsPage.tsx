import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { masterDataService } from '../../services/masterData.service';
import { AcademicYear } from '../../types/masterData';
import { useToast } from '../../components/common/Toast';
import {
  CalendarDays,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  GraduationCap,
  Clock,
  X,
  AlertCircle,
  Zap,
} from 'lucide-react';

export const AdminAcademicYearsPage: React.FC = () => {
  const { showToast } = useToast();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    active: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchYears = useCallback(async () => {
    try {
      setLoading(true);
      const res = await masterDataService.getAcademicYears({ search });
      setAcademicYears(res.academicYears);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch academic years', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      showToast('End date must be strictly after start date.', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await masterDataService.createAcademicYear(formData);
      showToast(
        formData.active
          ? 'Academic Year created and transactionally set as ACTIVE.'
          : 'Academic Year registered successfully.',
        'success'
      );
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        active: false,
      });
      fetchYears();
    } catch (err: any) {
      showToast(err.message || 'Failed to create academic year', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYear) return;
    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      showToast('End date must be strictly after start date.', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await masterDataService.updateAcademicYear(selectedYear.id, formData);
      showToast('Academic Year updated successfully.', 'success');
      setIsEditModalOpen(false);
      setSelectedYear(null);
      fetchYears();
    } catch (err: any) {
      showToast(err.message || 'Failed to update academic year', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateYear = async (year: AcademicYear) => {
    try {
      await masterDataService.updateAcademicYear(year.id, { active: true });
      showToast(`Academic Year '${year.name}' is now the institutional ACTIVE year.`, 'success');
      fetchYears();
    } catch (err: any) {
      showToast(err.message || 'Failed to activate academic year', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedYear) return;
    try {
      setSubmitting(true);
      await masterDataService.deleteAcademicYear(selectedYear.id);
      showToast('Academic Year removed successfully.', 'success');
      setIsDeleteModalOpen(false);
      setSelectedYear(null);
      fetchYears();
    } catch (err: any) {
      showToast(err.message || 'Cannot delete academic year with associated classes or timetable.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (y: AcademicYear) => {
    setSelectedYear(y);
    setFormData({
      name: y.name,
      start_date: new Date(y.start_date).toISOString().split('T')[0],
      end_date: new Date(y.end_date).toISOString().split('T')[0],
      active: y.active,
    });
    setIsEditModalOpen(true);
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Academic Years' },
      ]}
      searchPlaceholder="Search academic years..."
      onSearch={(q) => setSearch(q)}
    >
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Academic Calendar & Years"
          subtitle="Configure institutional academic sessions, term durations, and transactional active year switching."
          icon={CalendarDays}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Session Master
            </span>
          }
          actions={
            <button
              onClick={() => {
                setFormData({
                  name: '',
                  start_date: new Date().toISOString().split('T')[0],
                  end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  active: false,
                });
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Academic Year</span>
            </button>
          }
        />

        {/* Filter / Search Bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs text-xs">
          <label className="text-slate-600 font-semibold block mb-1">Search Keywords</label>
          <div className="relative max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search academic year name..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Academic Years Table */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold border-b border-slate-200/80 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Academic Session Name</th>
                  <th className="px-5 py-3.5">Start Date</th>
                  <th className="px-5 py-3.5">End Date</th>
                  <th className="px-5 py-3.5">Active Status</th>
                  <th className="px-5 py-3.5">Associated Classes</th>
                  <th className="px-5 py-3.5">Timetable Allocations</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <div>Loading academic sessions...</div>
                    </td>
                  </tr>
                ) : academicYears.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <CalendarDays className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <div className="text-slate-800 font-semibold">No academic years found.</div>
                    </td>
                  </tr>
                ) : (
                  academicYears.map((year) => (
                    <tr key={year.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{year.name}</span>
                          {year.active && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              CURRENT ACTIVE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-600">
                        {new Date(year.start_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-600">
                        {new Date(year.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        {year.active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Inactive</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                          <span>{year._count?.classes || 0} Classes</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{year._count?.timetable || 0} Slots</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!year.active && (
                            <button
                              onClick={() => handleActivateYear(year)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold transition-colors"
                              title="Activate this Academic Year"
                            >
                              <Zap className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Set Active</span>
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(year)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                            title="Edit Session"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedYear(year);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                            title="Delete Session"
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
        </div>

        {/* Add Academic Year Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Create Academic Year</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Academic Year Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. 2026-2027 Academic Year"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Start Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      End Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="active_checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="active_checkbox" className="text-slate-700 cursor-pointer">
                    <span className="font-semibold block text-slate-900">Set as Active Academic Year</span>
                    <span className="text-[11px] text-slate-500">
                      Transactionally deactivates all other academic years and sets this as the institutional default.
                    </span>
                  </label>
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
                    <span>Create Session</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Academic Year Modal */}
        {isEditModalOpen && selectedYear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Edit Academic Year: {selectedYear.name}</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Academic Year Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="active_edit_checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="active_edit_checkbox" className="text-slate-700 cursor-pointer">
                    <span className="font-semibold block text-slate-900">Active Academic Year</span>
                    <span className="text-[11px] text-slate-500">
                      Switching to active will automatically deactivate any other active year.
                    </span>
                  </label>
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

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && selectedYear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Delete Academic Year</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{selectedYear.name}</span>?
              </p>
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Calendar Protection:</strong> If any classes or timetable slots exist for this academic year, deletion is blocked to prevent broken academic history.
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>Confirm Removal</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAcademicYearsPage;
