import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/common/Toast';
import { auditApi, AuditLogEntity, AuditLogFilterParams } from '../../services/audit.service';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  FileCode,
  X,
  Shield,
  Layers,
  Users,
} from 'lucide-react';

export const AdminAuditLogsPage: React.FC = () => {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntity | null>(null);

  const fetchLogs = useCallback(
    async (pageNum = 1) => {
      try {
        setLoading(true);
        const res = await auditApi.getAuditLogs({
          search,
          action,
          entityType,
          role,
          startDate,
          endDate,
          page: pageNum,
          limit: pagination.limit,
        });
        setLogs(res.logs);
        setPagination(res.pagination);
      } catch (err: any) {
        addToast(err.message || 'Failed to load audit logs', 'error');
      } finally {
        setLoading(false);
      }
    },
    [search, action, entityType, role, startDate, endDate, pagination.limit, addToast]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [action, entityType, role, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Platform & Security' },
        { label: 'Security Audit Trail' },
      ]}
      searchPlaceholder="Filter audit trail records..."
    >
      <div className="space-y-6">
        <PageHeader
          title="System Audit Trail & Security Logs"
          subtitle="Immutable, append-only security logs tracking administrative, faculty, and background actions."
          icon={ShieldAlert}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              Append-Only Immutable
            </span>
          }
          actions={
            <button
              onClick={() => fetchLogs(pagination.page)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>Refresh Trail</span>
            </button>
          }
        />

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Audited Events"
            value={pagination.total}
            icon={ShieldAlert}
            color="indigo"
            subtext="Persisted audit entries"
          />
          <StatCard
            label="Current Page Events"
            value={logs.length}
            icon={Layers}
            color="blue"
            badge={`Page ${pagination.page}`}
          />
          <StatCard
            label="Total Log Pages"
            value={pagination.totalPages}
            icon={Users}
            color="slate"
            subtext="25 records per page"
          />
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search action, entity ID, metadata, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 flex items-center justify-center gap-2 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              Apply Filter
            </button>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
            {/* Action Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
                <option value="STAFF_CREATED">STAFF_CREATED</option>
                <option value="STAFF_UPDATED">STAFF_UPDATED</option>
                <option value="TASK_CREATED">TASK_CREATED</option>
                <option value="TASK_STATUS_CHANGED">TASK_STATUS_CHANGED</option>
                <option value="LEAVE_APPROVED">LEAVE_APPROVED</option>
                <option value="REPORT_GENERATED">REPORT_GENERATED</option>
                <option value="SETTING_CHANGED">SETTING_CHANGED</option>
                <option value="PERFORMANCE_WEIGHT_CHANGED">PERFORMANCE_WEIGHT_CHANGED</option>
              </select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Entities</option>
                <option value="USER">USER</option>
                <option value="STAFF">STAFF</option>
                <option value="TASK">TASK</option>
                <option value="LEAVE_REQUEST">LEAVE_REQUEST</option>
                <option value="REPORT">REPORT</option>
                <option value="SETTING">SETTING</option>
                <option value="TIMETABLE">TIMETABLE</option>
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Actor Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="STAFF">STAFF</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-500 items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading audit records...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50 m-6 rounded-xl border border-dashed border-slate-200">
              <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No audit log records match your filter criteria.</p>
              <p className="text-xs text-slate-500 mt-1">Try widening your date range or clearing filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Metadata / Details</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {log.user?.staff?.full_name || log.user?.email || 'System'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            log.user?.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {log.user?.role || 'SYSTEM'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] font-mono text-slate-600">
                        {log.entity_type}:{log.entity_id.substring(0, 8)}...
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {log.metadata || log.after_value || 'None'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Audit Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Audit Log Record Details</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Event ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div>
                <span className="font-semibold text-slate-600 block">Action:</span>
                <span className="font-mono text-blue-700 font-bold">{selectedLog.action}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600 block">Timestamp:</span>
                <span className="font-mono text-slate-700">{new Date(selectedLog.created_at).toISOString()}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600 block">Actor Email:</span>
                <span className="text-slate-800">{selectedLog.user?.email || 'System'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600 block">Entity:</span>
                <span className="font-mono text-slate-700">{selectedLog.entity_type} ({selectedLog.entity_id})</span>
              </div>
            </div>

            {selectedLog.metadata && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Metadata Payload:</label>
                <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl text-xs font-mono overflow-x-auto">
                  {JSON.stringify(JSON.parse(selectedLog.metadata || '{}'), null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.before_value && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Before Value:</label>
                <pre className="bg-amber-950/90 text-amber-200 p-3.5 rounded-xl text-xs font-mono overflow-x-auto border border-amber-900">
                  {selectedLog.before_value}
                </pre>
              </div>
            )}

            {selectedLog.after_value && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">After Value:</label>
                <pre className="bg-emerald-950/90 text-emerald-200 p-3.5 rounded-xl text-xs font-mono overflow-x-auto border border-emerald-900">
                  {selectedLog.after_value}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
