import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { masterDataService } from '../../services/masterData.service';
import {
  TimetableEntity,
  StaffEntity,
  ClassEntity,
  SubjectEntity,
  AcademicYear,
  Department,
} from '../../types/masterData';
import { useToast } from '../../components/common/Toast';
import {
  Clock,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  MapPin,
  AlertTriangle,
  X,
  AlertCircle,
  CheckCircle,
  Upload,
  FileText,
  FileUp,
  Loader2,
  Check,
  Info,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

function formatTimeWithAmPm(timeStr: string): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  const match = clean.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i);
  if (!match) return timeStr;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const existingAmPm = match[3];
  if (existingAmPm) {
    return `${hour.toString().padStart(2, '0')}:${minute} ${existingAmPm.toUpperCase()}`;
  }
  const ampm = hour >= 12 ? 'PM' : 'AM';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
}

export const AdminTimetablePage: React.FC = () => {
  const { showToast } = useToast();
  const [timetable, setTimetable] = useState<TimetableEntity[]>([]);
  const [staffList, setStaffList] = useState<StaffEntity[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [subjects, setSubjects] = useState<SubjectEntity[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeDayTab, setActiveDayTab] = useState<number | 'ALL'>('ALL');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimetableEntity | null>(null);

  // PDF Upload Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Unresolved row manual resolution state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [resolveClassId, setResolveClassId] = useState('');
  const [resolveSubjectId, setResolveSubjectId] = useState('');
  const [resolveStaffId, setResolveStaffId] = useState('');

  // Import History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    academic_year_id: '',
    class_id: '',
    subject_id: '',
    staff_id: '',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '10:00',
    room: '',
    status: 'SCHEDULED',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchTimetable = useCallback(async () => {
    try {
      setLoading(true);
      const res = await masterDataService.getTimetable({
        day_of_week: activeDayTab === 'ALL' ? undefined : activeDayTab,
        class_id: selectedClass || undefined,
        staffId: selectedStaff || undefined,
        academic_year_id: selectedYear || undefined,
        department_id: selectedDept || undefined,
      });
      setTimetable(res.timetable);
    } catch (err: any) {
      showToast(err.message || 'Failed to load timetable', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeDayTab, selectedClass, selectedStaff, selectedYear, selectedDept, showToast]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  useEffect(() => {
    Promise.all([
      masterDataService.getStaffList({ pageSize: 100 }),
      masterDataService.getClasses(),
      masterDataService.getSubjects(),
      masterDataService.getAcademicYears(),
      masterDataService.getDepartments(),
    ]).then(([staffRes, classRes, subRes, yearRes, deptRes]) => {
      setStaffList(staffRes.staff);
      setClasses(classRes.classes);
      setSubjects(subRes.subjects);
      setAcademicYears(yearRes.academicYears);
      setDepartments(deptRes.departments);

      const activeYear = yearRes.academicYears.find((y) => y.active) || yearRes.academicYears[0];
      setFormData((prev) => ({
        ...prev,
        academic_year_id: activeYear?.id || '',
        class_id: classRes.classes[0]?.id || '',
        subject_id: subRes.subjects[0]?.id || '',
        staff_id: staffRes.staff[0]?.id || '',
      }));
    });
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.end_time <= formData.start_time) {
      setFormError('End time must be later than start time.');
      return;
    }

    try {
      setSubmitting(true);
      await masterDataService.createTimetable(formData);
      showToast('Timetable slot scheduled successfully.', 'success');
      setIsAddModalOpen(false);
      fetchTimetable();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create slot.');
      showToast(err.message || 'Conflict detected.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setFormError(null);

    if (formData.end_time <= formData.start_time) {
      setFormError('End time must be later than start time.');
      return;
    }

    try {
      setSubmitting(true);
      await masterDataService.updateTimetable(selectedSlot.id, formData);
      showToast('Timetable slot updated successfully.', 'success');
      setIsEditModalOpen(false);
      setSelectedSlot(null);
      fetchTimetable();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update slot.');
      showToast(err.message || 'Conflict detected.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSlot) return;
    try {
      setSubmitting(true);
      await masterDataService.deleteTimetable(selectedSlot.id);
      showToast('Timetable slot removed successfully.', 'success');
      setIsDeleteModalOpen(false);
      setSelectedSlot(null);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove slot', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      setPdfError('Please choose a valid timetable PDF file.');
      return;
    }

    setUploadingPdf(true);
    setPdfError(null);

    try {
      const previewRes = await masterDataService.uploadTimetablePdf(pdfFile);

      setImportPreview(previewRes);
      showToast(
        `PDF parsed: ${previewRes.summary?.validRows || previewRes.rows?.length || 0} valid entries ready for preview.`,
        'success'
      );
    } catch (err: any) {
      setPdfError(err.message || 'Error processing timetable PDF.');
      showToast(err.message || 'Failed to parse timetable PDF', 'error');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || !importPreview.rows || importPreview.rows.length === 0) {
      showToast('No valid rows available to import.', 'error');
      return;
    }

    setConfirmingImport(true);

    try {
      const importPayload = {
        importId: importPreview.importId || importPreview.id,
        rows: importPreview.rows,
        replaceExisting,
      };

      const result = await masterDataService.confirmTimetableImport(importPayload);

      showToast(
        `Import complete: ${result.importedCount || 0} slots imported, ${result.updatedCount || 0} updated.`,
        'success'
      );

      setIsPdfModalOpen(false);
      setPdfFile(null);
      setImportPreview(null);
      setReplaceExisting(false);
      fetchTimetable();
    } catch (err: any) {
      showToast(err.message || 'Import failed.', 'error');
    } finally {
      setConfirmingImport(false);
    }
  };

  const downloadPreviewCsv = () => {
    if (!importPreview?.rows?.length) return;

    const headers = [
      'Row',
      'Section',
      'Day',
      'Hour',
      'Start Time',
      'End Time',
      'Class Name',
      'Subject Code',
      'Subject Name',
      'Faculty Name',
      'Room',
      'Status',
      'Validation Notes',
    ];
    const csvRows = [headers.join(',')];

    for (const r of importPreview.rows) {
      const notes = [...(r.errors || []), ...(r.warnings || [])].join('; ').replace(/"/g, '""');
      const row = [
        r.rowNumber || '',
        `"${r.section || ''}"`,
        `"${r.dayName || ''}"`,
        r.hour || '',
        `"${r.startTime || ''}"`,
        `"${r.endTime || ''}"`,
        `"${(r.className || '').replace(/"/g, '""')}"`,
        `"${(r.subjectCode || '').replace(/"/g, '""')}"`,
        `"${(r.subjectName || '').replace(/"/g, '""')}"`,
        `"${(r.staffName || '').replace(/"/g, '""')}"`,
        `"${(r.room || '').replace(/"/g, '""')}"`,
        `"${r.status || (r.isValid ? 'READY' : 'UNRESOLVED')}"`,
        `"${notes}"`,
      ];
      csvRows.push(row.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `timetable-preview-${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleStartResolve = (row: any, idx: number) => {
    setEditingRowIndex(idx);
    setResolveClassId(row.classId || classes[0]?.id || '');
    setResolveSubjectId(row.subjectId || subjects[0]?.id || '');
    setResolveStaffId(row.staffRecordId || staffList[0]?.id || '');
  };

  const handleApplyResolution = (idx: number) => {
    if (!importPreview?.rows?.[idx]) return;
    const targetRow = { ...importPreview.rows[idx] };

    if (resolveClassId) {
      const c = classes.find((cls) => cls.id === resolveClassId);
      if (c) {
        targetRow.classId = c.id;
        targetRow.className = c.name;
        targetRow.section = c.section || targetRow.section;
      }
    }

    if (resolveSubjectId) {
      const s = subjects.find((sub) => sub.id === resolveSubjectId);
      if (s) {
        targetRow.subjectId = s.id;
        targetRow.subjectName = s.name;
        targetRow.subjectCode = s.code;
      }
    }

    if (resolveStaffId) {
      const st = staffList.find((staff) => staff.id === resolveStaffId);
      if (st) {
        targetRow.staffRecordId = st.id;
        targetRow.staffId = st.staff_id;
        targetRow.staffName = st.full_name;
      }
    }

    if (targetRow.classId && targetRow.subjectId && targetRow.staffRecordId) {
      targetRow.isUnresolved = false;
      targetRow.isValid = !targetRow.isConflict;
      targetRow.status = targetRow.isConflict ? 'CONFLICT' : 'READY';
      targetRow.errors = targetRow.errors.filter(
        (e: string) => !e.toLowerCase().includes('unresolved')
      );
    }

    const updatedRows = [...importPreview.rows];
    updatedRows[idx] = targetRow;

    const validRows = updatedRows.filter((r) => r.isValid && !r.isUnresolved && !r.isConflict).length;
    const unresolvedRows = updatedRows.filter((r) => r.isUnresolved).length;
    const conflictRows = updatedRows.filter((r) => r.isConflict).length;
    const duplicateRows = updatedRows.filter((r) => r.isDuplicate).length;

    setImportPreview({
      ...importPreview,
      rows: updatedRows,
      summary: {
        ...importPreview.summary,
        validRows,
        unresolvedRows,
        conflictRows,
        duplicateRows,
      },
    });

    setEditingRowIndex(null);
    showToast('Entity mapping resolved successfully.', 'success');
  };

  const openImportHistoryModal = async () => {
    try {
      setLoadingHistory(true);
      setIsHistoryModalOpen(true);
      const res = await masterDataService.getTimetableImportHistory();
      setImportHistory(res.imports || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch import history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openEditModal = (slot: TimetableEntity) => {
    setSelectedSlot(slot);
    setFormError(null);
    setFormData({
      academic_year_id: slot.academic_year_id,
      class_id: slot.class_id,
      subject_id: slot.subject_id,
      staff_id: slot.staff_id,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: slot.room || '',
      status: slot.status,
    });
    setIsEditModalOpen(true);
  };

  const getDayName = (dayNum: number) => {
    return DAYS_OF_WEEK.find((d) => d.id === dayNum)?.label || `Day ${dayNum}`;
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Timetable Scheduling' },
      ]}
      searchPlaceholder="Filter timetable records..."
    >
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Institutional Timetable & Schedules"
          subtitle="Enforce conflict-free class allocations, classroom rooms, and faculty teaching timetables."
          icon={Clock}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Deterministic Scheduling Matrix
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={openImportHistoryModal}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-colors"
              >
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Import History</span>
              </button>

              <button
                onClick={() => {
                  setPdfError(null);
                  setPdfFile(null);
                  setImportPreview(null);
                  setIsPdfModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-colors"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Upload Timetable PDF</span>
              </button>

              <button
                onClick={() => {
                  setFormError(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule New Slot</span>
              </button>
            </div>
          }
        />

        {/* Day Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200/80 rounded-2xl overflow-x-auto text-xs font-semibold shadow-2xs">
          <button
            onClick={() => setActiveDayTab('ALL')}
            className={`px-3.5 py-2 rounded-xl transition-all ${
              activeDayTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            All Days
          </button>
          {DAYS_OF_WEEK.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDayTab(d.id)}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeDayTab === d.id
                  ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-600 font-semibold block mb-1">Class / Cohort</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `(Sec ${c.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-semibold block mb-1">Faculty Member</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Faculty</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.staff_id})
                </option>
              ))}
            </select>
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
            <label className="text-slate-600 font-semibold block mb-1">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timetable Table */}
        <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase font-semibold border-b border-slate-200/80 text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Day & Time Slot</th>
                  <th className="px-5 py-3.5">Subject</th>
                  <th className="px-5 py-3.5">Assigned Faculty</th>
                  <th className="px-5 py-3.5">Class / Section</th>
                  <th className="px-5 py-3.5">Room</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                      <div>Loading schedules...</div>
                    </td>
                  </tr>
                ) : timetable.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <div className="text-slate-800 font-semibold">No scheduled slots found for this selection.</div>
                      <div className="text-slate-500 text-[11px] mt-1">Click "Schedule New Slot" to create conflict-checked timetable entries.</div>
                    </td>
                  </tr>
                ) : (
                  timetable.map((slot) => (
                    <tr key={slot.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{getDayName(slot.day_of_week)}</div>
                        <div className="font-mono text-blue-600 font-semibold text-[11px] mt-0.5">
                          {formatTimeWithAmPm(slot.start_time)} - {formatTimeWithAmPm(slot.end_time)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{slot.subject?.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{slot.subject?.code}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{slot.staff?.full_name}</div>
                        <div className="text-[10px] text-blue-600 font-mono font-medium">{slot.staff?.staff_id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-800 font-medium">{slot.class?.name}</div>
                        {slot.class?.section && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Sec {slot.class.section}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{slot.room || 'Unassigned Hall'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {slot.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(slot)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors"
                            title="Edit Schedule Slot"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSlot(slot);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                            title="Delete Schedule Slot"
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

        {/* Add Slot Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl p-6 my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Schedule New Timetable Slot</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Scheduling Conflict Detected:</strong>
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Day of the Week <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Academic Year <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.academic_year_id}
                      onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.active ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Start Time (24h) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      End Time (24h) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">
                      Faculty Member <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.staff_id}
                      onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.staff_id}) - {s.department?.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Class Cohort <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `(Sec ${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Subject / Module <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.subject_id}
                      onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} - {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Room / Lecture Hall</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      placeholder="e.g. Hall CS-301"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
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
                    <span>Schedule Slot</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Slot Modal */}
        {isEditModalOpen && selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl p-6 my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Edit Schedule Slot</h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Scheduling Conflict Detected:</strong>
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="mt-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Day of Week</label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Academic Year</label>
                    <select
                      value={formData.academic_year_id}
                      onChange={(e) => setFormData({ ...formData, academic_year_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.active ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Start Time (24h)</label>
                    <input
                      type="time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">End Time (24h)</label>
                    <input
                      type="time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">Faculty Member</label>
                    <select
                      required
                      value={formData.staff_id}
                      onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.staff_id}) - {s.department?.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Class Cohort</label>
                    <select
                      required
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.section ? `(Sec ${c.section})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Subject / Module</label>
                    <select
                      required
                      value={formData.subject_id}
                      onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} - {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Room / Hall</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
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

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && selectedSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl p-6 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">Delete Timetable Slot</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove this timetable slot for{' '}
                <span className="font-semibold text-slate-900">{selectedSlot.subject?.name}</span> with{' '}
                <span className="font-semibold text-slate-900">{selectedSlot.staff?.full_name}</span>?
              </p>

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
                  <span>Delete Slot</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timetable PDF Import History Modal */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Timetable PDF Import History</h3>
                    <p className="text-xs text-slate-500">Audit trail of all institutional timetable PDF uploads and processing outcomes.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {loadingHistory ? (
                  <div className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs">Loading import history...</p>
                  </div>
                ) : importHistory.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-800">No PDF imports recorded yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Upload a timetable PDF to create your first institutional schedule import.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-slate-500 sticky top-0 uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">File Name</th>
                          <th className="py-2.5 px-3">Uploaded By</th>
                          <th className="py-2.5 px-3">Uploaded At</th>
                          <th className="py-2.5 px-3">Total Rows</th>
                          <th className="py-2.5 px-3">Imported</th>
                          <th className="py-2.5 px-3">Updated</th>
                          <th className="py-2.5 px-3">Skipped / Unresolved</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {importHistory.map((imp) => (
                          <tr key={imp.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900 truncate max-w-xs">{imp.fileName}</td>
                            <td className="py-2.5 px-3 text-slate-500">{imp.uploadedBy}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{new Date(imp.uploadedAt).toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{imp.totalRows}</td>
                            <td className="py-2.5 px-3 text-emerald-600 font-semibold">{imp.importedRows}</td>
                            <td className="py-2.5 px-3 text-blue-600 font-semibold">{imp.updatedRows}</td>
                            <td className="py-2.5 px-3 text-amber-600 font-semibold">{imp.skippedRows + imp.unresolvedRows}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  imp.status === 'COMPLETED'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : imp.status === 'COMPLETED_WITH_WARNINGS'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}
                              >
                                {imp.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timetable PDF Upload & Preview Modal */}
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Admin Timetable PDF Upload</h3>
                    <p className="text-xs text-slate-500">
                      Extract structured timetable schedules, detect conflicts, and import into production.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {pdfError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{pdfError}</span>
                  </div>
                )}

                {!importPreview ? (
                  /* Step 1: File Selection & Upload */
                  <form onSubmit={handlePdfUpload} className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/50 transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setPdfFile(file);
                          setPdfError(null);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-3">
                          <FileUp className="w-7 h-7" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mb-1">
                          {pdfFile ? pdfFile.name : 'Click to select or drag timetable PDF here'}
                        </p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {pdfFile
                            ? `${(pdfFile.size / 1024).toFixed(1)} KB — Ready to parse`
                            : 'Accepts institutional timetable PDFs up to 10MB'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <p className="font-semibold text-slate-900">Supported PDF Formats & Matching Rules:</p>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        <li>Matches days: Monday through Saturday (e.g. MON, TUE, WED, etc.)</li>
                        <li>Matches 12h & 24h formats: 09:00 - 10:00, 10:00 AM - 11:00 AM</li>
                        <li>Matches Faculty Staff by Name or Staff ID (e.g. STF-CSE-001)</li>
                        <li>Matches Class Cohorts (e.g. CSE-A, ECE 3rd Year) and Subjects by Code</li>
                        <li>Automatically detects schedule clashes and overlapping allocations</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsPdfModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!pdfFile || uploadingPdf}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
                      >
                        {uploadingPdf && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{uploadingPdf ? 'Extracting Timetable Data...' : 'Extract & Preview Records'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Step 2: Extracted Preview & Conflict Review */
                  <div className="space-y-4">
                    {/* Detected Sections & Summary Metric Chips */}
                    {importPreview.sectionsDetected && importPreview.sectionsDetected.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs font-semibold text-slate-700">Sections Detected:</span>
                        {importPreview.sectionsDetected.map((sec: string) => (
                          <span key={sec} className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
                            {sec}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-[11px] text-slate-500 font-medium">Total Rows</p>
                        <p className="text-lg font-bold text-slate-900 mt-1">{importPreview.summary?.totalRows || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <p className="text-[11px] text-emerald-700 font-medium">Ready</p>
                        <p className="text-lg font-bold text-emerald-700 mt-1">{importPreview.summary?.validRows || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-[11px] text-amber-700 font-medium">Unresolved</p>
                        <p className="text-lg font-bold text-amber-700 mt-1">{importPreview.summary?.unresolvedRows || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                        <p className="text-[11px] text-rose-700 font-medium">Conflicts</p>
                        <p className="text-lg font-bold text-rose-700 mt-1">{importPreview.summary?.conflictRows || 0}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                        <p className="text-[11px] text-blue-700 font-medium">Duplicates</p>
                        <p className="text-lg font-bold text-blue-700 mt-1">{importPreview.summary?.duplicateRows || 0}</p>
                      </div>
                    </div>

                    {/* Replace Existing Option */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="replaceExisting"
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="replaceExisting" className="text-xs text-slate-700 cursor-pointer leading-relaxed">
                        <span className="font-semibold text-slate-900">Replace existing timetable records for matched cohorts:</span>{' '}
                        When checked, existing timetable entries for the affected class/day/timeslot will be updated. When unchecked,
                        only new conflict-free slots will be added and existing slots will be preserved.
                      </label>
                    </div>

                    {/* Preview Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-slate-500 sticky top-0 uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Section</th>
                            <th className="py-2.5 px-3">Day</th>
                            <th className="py-2.5 px-3">Hour</th>
                            <th className="py-2.5 px-3">Time</th>
                            <th className="py-2.5 px-3">Subject Code</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Faculty</th>
                            <th className="py-2.5 px-3">Room</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {importPreview.rows?.map((row: any, idx: number) => {
                            const isOk = row.status === 'READY';
                            const isEditingThis = editingRowIndex === idx;

                            return (
                              <React.Fragment key={idx}>
                                <tr className={isOk ? 'hover:bg-slate-50/60' : 'bg-rose-50/30 hover:bg-rose-50/50'}>
                                  <td className="py-2 px-3 text-slate-400 font-mono">{row.rowNumber || idx + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-blue-600">{row.section || '—'}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-900">{row.dayName}</td>
                                  <td className="py-2 px-3 font-mono text-slate-600">{row.hour ? `Hour ${row.hour}` : '—'}</td>
                                  <td className="py-2 px-3 font-mono text-slate-600">{row.startTime} - {row.endTime}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-900">{row.subjectCode}</td>
                                  <td className="py-2 px-3 text-slate-700 max-w-xs truncate">{row.subjectName}</td>
                                  <td className="py-2 px-3 font-medium text-slate-900">
                                    {row.staffName}
                                    {row.staffId && <span className="text-slate-500 text-[10px] block">{row.staffId}</span>}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">{row.room || '—'}</td>
                                  <td className="py-2 px-3">
                                    {row.status === 'CONFLICT' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        Conflict
                                      </span>
                                    ) : row.status === 'UNRESOLVED' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                                        <AlertCircle className="w-3 h-3 text-amber-600" />
                                        Unresolved
                                      </span>
                                    ) : row.status === 'DUPLICATE' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
                                        <Info className="w-3 h-3 text-blue-600" />
                                        Duplicate
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        Ready
                                      </span>
                                    )}
                                    {row.errors?.length > 0 && (
                                      <span className="text-rose-600 block text-[10px] mt-0.5">{row.errors[0]}</span>
                                    )}
                                    {row.warnings?.length > 0 && (
                                      <span className="text-amber-600 block text-[10px] mt-0.5">{row.warnings[0]}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {row.status === 'UNRESOLVED' && (
                                      <button
                                        type="button"
                                        onClick={() => handleStartResolve(row, idx)}
                                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-semibold transition-colors"
                                      >
                                        Fix Mapping
                                      </button>
                                    )}
                                  </td>
                                </tr>

                                {/* Inline Resolver Row */}
                                {isEditingThis && (
                                  <tr className="bg-amber-50/40 border-y border-amber-200">
                                    <td colSpan={11} className="p-3">
                                      <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-xs font-bold text-amber-900">Resolve Mapping:</span>

                                        <div className="flex items-center gap-1">
                                          <label className="text-[11px] text-slate-600 font-medium">Class:</label>
                                          <select
                                            value={resolveClassId}
                                            onChange={(e) => setResolveClassId(e.target.value)}
                                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none"
                                          >
                                            {classes.map((cls) => (
                                              <option key={cls.id} value={cls.id}>
                                                {cls.name} ({cls.section || '—'})
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <label className="text-[11px] text-slate-600 font-medium">Subject:</label>
                                          <select
                                            value={resolveSubjectId}
                                            onChange={(e) => setResolveSubjectId(e.target.value)}
                                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none"
                                          >
                                            {subjects.map((sub) => (
                                              <option key={sub.id} value={sub.id}>
                                                {sub.code} - {sub.name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1">
                                          <label className="text-[11px] text-slate-600 font-medium">Faculty:</label>
                                          <select
                                            value={resolveStaffId}
                                            onChange={(e) => setResolveStaffId(e.target.value)}
                                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none"
                                          >
                                            {staffList.map((st) => (
                                              <option key={st.id} value={st.id}>
                                                {st.full_name} ({st.staff_id})
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-2 ml-auto">
                                          <button
                                            type="button"
                                            onClick={() => setEditingRowIndex(null)}
                                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleApplyResolution(idx)}
                                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                                          >
                                            Save Mapping
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Confirmation Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setImportPreview(null);
                            setPdfFile(null);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                        >
                          Re-upload PDF
                        </button>
                        <button
                          type="button"
                          onClick={downloadPreviewCsv}
                          className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Download Preview (CSV)</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setIsPdfModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={confirmingImport || !importPreview.summary?.validRows}
                          onClick={handleConfirmImport}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
                        >
                          {confirmingImport && <Loader2 className="w-4 h-4 animate-spin" />}
                          <span>Confirm & Import ({importPreview.summary?.validRows || 0} Slots)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminTimetablePage;
