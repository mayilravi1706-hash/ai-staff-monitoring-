import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/common/Toast';
import { reportsApi, GeneratedReport, ReportFilterParams } from '../../services/reports.service';
import { UnifiedAppLayout } from '../../layouts/UnifiedAppLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  FileText,
  Download,
  Filter,
  FileSpreadsheet,
  FileType,
  RefreshCw,
  Clock,
  Shield,
  Layers,
} from 'lucide-react';

const STAFF_REPORT_TYPES = [
  { id: 'DAILY_STAFF', label: 'My Daily Activity & Duty Log' },
  { id: 'WEEKLY_STAFF', label: 'My Weekly Performance & Duty Summary' },
  { id: 'MONTHLY_STAFF', label: 'My Monthly Workload & Performance Summary' },
  { id: 'ATTENDANCE', label: 'My Attendance Log Report' },
  { id: 'TASK', label: 'My Assigned Tasks Status Report' },
  { id: 'LEAVE', label: 'My Leave Requests History Report' },
  { id: 'WORKLOAD', label: 'My Teaching Workload Metrics Report' },
  { id: 'PERFORMANCE', label: 'My Performance Evaluation Report' },
  { id: 'TIMETABLE', label: 'My Class Schedules Report' },
  { id: 'CLASS_COVERAGE', label: 'My Conducted Classes & Coverage Report' },
  { id: 'OPERATIONAL_ALERT', label: 'My Operational Signals Report' },
];

export const StaffReportsPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedType, setSelectedType] = useState<string>('DAILY_STAFF');
  const [format, setFormat] = useState<'PDF' | 'EXCEL' | 'CSV'>('PDF');
  const [filters, setFilters] = useState<ReportFilterParams>({
    startDate: '',
    endDate: '',
  });

  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await reportsApi.getReportHistory();
      setHistory(data);
    } catch {
      addToast('Failed to load personal report history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const report = await reportsApi.generateReport(selectedType, format, filters);
      addToast(`Personal report generated (${report.recordCount ?? 0} records)`, 'success');
      await fetchHistory();

      if (report.downloadUrl || report.id) {
        window.open(reportsApi.getDownloadUrl(report.id), '_blank');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to generate personal report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const pdfCount = history.filter((h) => h.format === 'PDF').length;
  const excelCount = history.filter((h) => h.format === 'EXCEL').length;

  return (
    <UnifiedAppLayout
      breadcrumbs={[
        { label: 'Workspace', href: '/staff/dashboard' },
        { label: 'Reports & Exports' },
      ]}
      searchPlaceholder="Filter report history..."
    >
      <div className="space-y-6">
        <PageHeader
          title="My Operational Reports & Exports"
          subtitle="Generate and export authenticated PDF, Excel, or CSV reports containing strictly your authorized operational data."
          icon={FileText}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              IDOR Protected
            </span>
          }
          actions={
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Refresh History</span>
            </button>
          }
        />

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Personal Reports"
            value={history.length}
            icon={FileText}
            color="blue"
            subtext="Available downloads"
          />
          <StatCard
            label="PDF Documents"
            value={pdfCount}
            icon={FileType}
            color="rose"
            badge="Official"
          />
          <StatCard
            label="Excel Files"
            value={excelCount}
            icon={FileSpreadsheet}
            color="emerald"
            badge=".xlsx"
          />
        </div>

        {/* Report Generator Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Personal Report Generator</h2>
              <p className="text-xs text-slate-500">Choose data category and export format</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Report Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Report Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                {STAFF_REPORT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Format */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Export Format <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('PDF')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                    format === 'PDF'
                      ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileType className="w-3.5 h-3.5 text-rose-600" />
                  PDF
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('EXCEL')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                    format === 'EXCEL'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Excel
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('CSV')}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                    format === 'CSV'
                      ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  CSV
                </button>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Generate & Export {format}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Report History */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Personal Report History</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {history.length} records
            </span>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-12 text-slate-500 items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 m-6 rounded-xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No report history yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Select report options above to generate personal reports.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Title / Type</th>
                    <th className="py-3 px-4">Format</th>
                    <th className="py-3 px-4">Records</th>
                    <th className="py-3 px-4">Generated At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.title || item.reportType}</div>
                        <div className="text-[11px] text-slate-500">{item.reportType}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.format === 'PDF'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.format === 'EXCEL'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.format}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {item.recordCount ?? 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {new Date(item.generatedAt || item.generated_at || Date.now()).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={reportsApi.getDownloadUrl(item.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </UnifiedAppLayout>
  );
};
