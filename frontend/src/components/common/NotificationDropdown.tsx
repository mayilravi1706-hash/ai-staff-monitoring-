import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, CheckCircle2, Clock, Sparkles, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { operationsService } from '../../services/operations.service';

export const NotificationDropdown: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      operationsService
        .getMonitoringAlerts({ status: 'ACTIVE' })
        .then((res) => {
          setAlerts(res.alerts || []);
        })
        .catch(() => {
          setAlerts([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open]);

  const unreadCount = alerts.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {unreadCount} active
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Checking live operational signals...
              </div>
            ) : alerts.length > 0 ? (
              alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="p-3.5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 leading-tight">
                        {alert.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {alert.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="text-amber-600 font-medium">Monitoring Signal</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-slate-800">All Operations Normal</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No active operational alerts or timetable exceptions.
                </p>
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-slate-100 bg-slate-50/60 text-center">
            <Link
              to={isAdmin ? '/admin/operations' : '/staff/dashboard'}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>View Operations Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
