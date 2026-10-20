import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/common/Toast';
import { settingsApi, SystemSettingsPayload } from '../../services/settings.service';
import { AdminLayout } from '../../layouts/AdminLayout';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import {
  Sliders,
  Settings,
  Bell,
  SlidersHorizontal,
  Bot,
  Info,
  Save,
  RefreshCw,
  Calendar,
  Clock,
  ShieldCheck,
  Server,
  Database,
  Lock,
} from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'monitoring' | 'notifications' | 'performanceWeights' | 'ai' | 'system'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SystemSettingsPayload | null>(null);

  // Editable Form States
  const [general, setGeneral] = useState({
    appName: '',
    maintenanceMode: false,
    allowSelfRegistration: false,
  });

  const [monitoring, setMonitoring] = useState({
    classMonitoringGracePeriodMinutes: 10,
    taskDueSoonThresholdHours: 24,
    workloadWarningThreshold: 24,
  });

  const [notifications, setNotifications] = useState({
    notificationCooldownMinutes: 60,
    emailNotificationsEnabled: true,
    overdueTaskAlertsEnabled: true,
    monitoringAlertsEnabled: true,
  });

  const [weights, setWeights] = useState({
    attendanceWeight: 20,
    taskCompletionWeight: 25,
    onTimeCompletionWeight: 20,
    classCompletionWeight: 25,
    operationalActivityWeight: 10,
  });

  const [ai, setAi] = useState({
    aiEnabled: false,
    aiModel: 'gemini-3.7-flash',
    maxTokens: 2048,
    scheduleIntervalMinutes: 15,
    aiAlertsEnabled: true,
    evidenceRequired: true,
    credentialsAvailable: false,
  });

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsApi.getSettings();
      setData(res);

      setGeneral(res.general);
      setMonitoring(res.monitoring);
      setNotifications(res.notifications);
      setWeights(res.performanceWeights);
      setAi(res.aiFoundation);
    } catch {
      addToast('Failed to load system settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await settingsApi.updateSettings('general', general);
      setData(res);
      addToast('General system settings updated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save general settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonitoring = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await settingsApi.updateSettings('monitoring', monitoring);
      setData(res);
      addToast('Monitoring thresholds updated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save monitoring settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await settingsApi.updateSettings('notifications', notifications);
      setData(res);
      addToast('Notification settings updated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save notification settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    const sum =
      weights.attendanceWeight +
      weights.taskCompletionWeight +
      weights.onTimeCompletionWeight +
      weights.classCompletionWeight +
      weights.operationalActivityWeight;

    if (Math.round(sum) !== 100) {
      addToast(`Weights must sum strictly to 100% (currently ${sum}%)`, 'error');
      return;
    }

    try {
      setSaving(true);
      const res = await settingsApi.updateSettings('performanceWeights', weights);
      setData(res);
      addToast('Performance scoring weights updated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save performance weights', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await settingsApi.updateSettings('aiFoundation', ai);
      setData(res);
      addToast('AI settings foundation updated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to save AI settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const weightSum =
    weights.attendanceWeight +
    weights.taskCompletionWeight +
    weights.onTimeCompletionWeight +
    weights.classCompletionWeight +
    weights.operationalActivityWeight;

  if (loading) {
    return (
      <AdminLayout
        breadcrumbs={[
          { label: 'Overview', href: '/admin/dashboard' },
          { label: 'Platform & Security' },
          { label: 'System Settings' },
        ]}
      >
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex items-center gap-3 text-blue-600 font-medium text-xs">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Loading system configurations...
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Overview', href: '/admin/dashboard' },
        { label: 'Platform & Security' },
        { label: 'System Settings' },
      ]}
      searchPlaceholder="Search configurations..."
    >
      <div className="space-y-6">
        <PageHeader
          title="System Settings & Operational Configurations"
          subtitle="Configure database-backed parameters for monitoring thresholds, notification behavior, performance weights, and health status."
          icon={Settings}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Live Database Config
            </span>
          }
          actions={
            <button
              onClick={loadSettings}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reload Settings</span>
            </button>
          }
        />

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto bg-white p-1.5 rounded-2xl border shadow-2xs">
          {[
            { id: 'general', label: 'General System', icon: Settings },
            { id: 'monitoring', label: 'Class Monitoring & Grace', icon: SlidersHorizontal },
            { id: 'notifications', label: 'Notifications & Cooldown', icon: Bell },
            { id: 'performanceWeights', label: 'Performance Weights', icon: Sliders },
            { id: 'ai', label: 'AI Foundation', icon: Bot },
            { id: 'system', label: 'System Health', icon: Info },
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

        {/* Tab 1: General */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveGeneral} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">General System Configurations</h2>
              <p className="text-xs text-slate-500">Core operational branding and access controls</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Application Display Name
                </label>
                <input
                  type="text"
                  value={general.appName}
                  onChange={(e) => setGeneral({ ...general, appName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="maintenanceMode"
                  checked={general.maintenanceMode}
                  onChange={(e) => setGeneral({ ...general, maintenanceMode: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="maintenanceMode" className="text-xs font-medium text-slate-700">
                  Enable Maintenance Mode (Restricts access exclusively to ADMIN role)
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save General Settings
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Monitoring */}
        {activeTab === 'monitoring' && (
          <form onSubmit={handleSaveMonitoring} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Class Monitoring & Threshold Parameters</h2>
              <p className="text-xs text-slate-500">Timing parameters that govern automated signal evaluation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Class Monitoring Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={monitoring.classMonitoringGracePeriodMinutes}
                  onChange={(e) =>
                    setMonitoring({
                      ...monitoring,
                      classMonitoringGracePeriodMinutes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Grace interval after period start before unrecorded signal is flagged.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Task Due-Soon Threshold (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={monitoring.taskDueSoonThresholdHours}
                  onChange={(e) =>
                    setMonitoring({
                      ...monitoring,
                      taskDueSoonThresholdHours: parseInt(e.target.value, 10) || 24,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Hours before deadline to categorize active task as due soon.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Workload High Warning Threshold (Hours/Week)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={monitoring.workloadWarningThreshold}
                  onChange={(e) =>
                    setMonitoring({
                      ...monitoring,
                      workloadWarningThreshold: parseInt(e.target.value, 10) || 24,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Weekly instructional hours threshold for workload warnings.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Monitoring Settings
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === 'notifications' && (
          <form onSubmit={handleSaveNotifications} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Notification Settings & Cooldowns</h2>
              <p className="text-xs text-slate-500">Control automated operational alert dispatch frequencies</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notification Cooldown (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={notifications.notificationCooldownMinutes}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      notificationCooldownMinutes: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Minimum duration between duplicate alerts for the same operational event.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={notifications.overdueTaskAlertsEnabled}
                    onChange={(e) =>
                      setNotifications({ ...notifications, overdueTaskAlertsEnabled: e.target.checked })
                    }
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  Enable Overdue Task Alert Notifications
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={notifications.monitoringAlertsEnabled}
                    onChange={(e) =>
                      setNotifications({ ...notifications, monitoringAlertsEnabled: e.target.checked })
                    }
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  Enable Class Monitoring Operational Signals
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Notification Settings
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Performance Weights */}
        {activeTab === 'performanceWeights' && (
          <form onSubmit={handleSaveWeights} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Performance Evaluation Weights Configuration</h2>
                <p className="text-xs text-slate-500">
                  Relative contribution of each operational metric. Total must equal strictly 100%.
                </p>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                  Math.round(weightSum) === 100
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                Total: {weightSum}% {Math.round(weightSum) === 100 ? '✓ Valid (100%)' : '❌ Must equal 100%'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Attendance Score Weight</label>
                  <span className="font-mono text-xs font-bold text-blue-600">{weights.attendanceWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.attendanceWeight}
                  onChange={(e) => setWeights({ ...weights, attendanceWeight: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Task Completion Weight</label>
                  <span className="font-mono text-xs font-bold text-blue-600">{weights.taskCompletionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.taskCompletionWeight}
                  onChange={(e) => setWeights({ ...weights, taskCompletionWeight: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">On-Time Completion Weight</label>
                  <span className="font-mono text-xs font-bold text-blue-600">{weights.onTimeCompletionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.onTimeCompletionWeight}
                  onChange={(e) => setWeights({ ...weights, onTimeCompletionWeight: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Class Coverage Weight</label>
                  <span className="font-mono text-xs font-bold text-blue-600">{weights.classCompletionWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.classCompletionWeight}
                  onChange={(e) => setWeights({ ...weights, classCompletionWeight: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 md:col-span-2">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">Operational Activity Weight</label>
                  <span className="font-mono text-xs font-bold text-blue-600">{weights.operationalActivityWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights.operationalActivityWeight}
                  onChange={(e) => setWeights({ ...weights, operationalActivityWeight: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving || Math.round(weightSum) !== 100}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save Performance Weights
              </button>
            </div>
          </form>
        )}

        {/* Tab 5: AI Foundation */}
        {activeTab === 'ai' && (
          <form onSubmit={handleSaveAi} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span>AI Operations Intelligence Foundation</span>
                </h2>
                <p className="text-xs text-slate-500">Configure evidence-grounded Gemini intelligence layer</p>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  ai.credentialsAvailable
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                {ai.credentialsAvailable
                  ? 'Credentials Present in Environment'
                  : 'Credentials Managed via AI Studio Secrets'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={ai.aiEnabled}
                    onChange={(e) => setAi({ ...ai, aiEnabled: e.target.checked })}
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  Enable AI Analysis Layer (Requires Environment Credentials)
                </label>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    AI Model Target
                  </label>
                  <select
                    value={ai.aiModel}
                    onChange={(e) => setAi({ ...ai, aiModel: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gemini-3.7-flash">Gemini 3.7 Flash (Default)</option>
                    <option value="gemini-3.5-turbo">Gemini 3.5 Turbo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Max Response Tokens
                  </label>
                  <input
                    type="number"
                    value={ai.maxTokens}
                    onChange={(e) => setAi({ ...ai, maxTokens: parseInt(e.target.value, 10) || 2048 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={ai.aiAlertsEnabled}
                    onChange={(e) => setAi({ ...ai, aiAlertsEnabled: e.target.checked })}
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  Enable AI Operational Risk Alerts
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={ai.evidenceRequired}
                    onChange={(e) => setAi({ ...ai, evidenceRequired: e.target.checked })}
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  Strict Audit Evidence Requirement for AI Findings
                </label>

                <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1 mt-4">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Security Notice:
                  </div>
                  <p className="text-[11px] leading-relaxed text-blue-800">
                    API Keys and credentials are strictly stored in server environment variables or AI Studio Secrets panel. They are never written to plain database tables or exposed to client browsers.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/20 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save AI Settings
              </button>
            </div>
          </form>
        )}

        {/* Tab 6: System Health */}
        {activeTab === 'system' && data && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>System Health & Runtime Environment</span>
              </h2>
              <p className="text-xs text-slate-500">Live infrastructure connectivity and scheduler status</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Database Status</span>
                <div className="text-base font-bold text-emerald-700 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  PostgreSQL ({data.systemInfo.dbStatus})
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Academic Year</span>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  {data.systemInfo.activeAcademicYear}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Scheduler Engine</span>
                <div className="text-sm font-bold text-blue-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  {data.systemInfo.schedulerStatus} ({data.systemInfo.registeredJobsCount} Jobs Active)
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Server Uptime</span>
                <div className="text-sm font-bold text-slate-900">
                  {Math.floor(data.systemInfo.backendUptimeSeconds / 3600)} Hours,{' '}
                  {Math.floor((data.systemInfo.backendUptimeSeconds % 3600) / 60)} Mins
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">System Version</span>
                <div className="text-sm font-bold text-slate-900">v{data.systemInfo.version}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Last Health Ping</span>
                <div className="text-xs font-mono text-slate-700">
                  {new Date(data.systemInfo.lastHealthCheck).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
