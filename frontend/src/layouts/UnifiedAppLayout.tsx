import { FloatingAiChatbot } from "../components/common/FloatingAiChatbot";
import { BrandLogo } from '../components/common/BrandLogo';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationDropdown } from '../components/common/NotificationDropdown';
import {
  Shield,
  LayoutDashboard,
  Users,
  Building2,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Calendar,
  Layers,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  Database,
  CheckCircle2,
  Activity,
  CalendarCheck,
  FileText,
  ShieldAlert,
  Settings,
  Sparkles,
  PieChart,
  BarChart3,
  Award,
  AlertTriangle,
  UserCheck,
  ChevronDown,
} from 'lucide-react';

interface UnifiedAppLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export const UnifiedAppLayout: React.FC<UnifiedAppLayoutProps> = ({
  children,
  breadcrumbs = [],
  searchPlaceholder = 'Search staff, classes, subjects, tasks, reports...',
  onSearch,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchVal);
    } else if (searchVal.trim()) {
      // Global search shortcut: if searching staff or timetable
      if (isAdmin) {
        navigate(`/admin/staff?search=${encodeURIComponent(searchVal)}`);
      }
    }
  };

  // Admin Navigation Groups
  const adminCoreNav = [
    { label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Staff 360°', href: '/admin/staff', icon: Users, badge: 'Staff' },
    { label: 'Timetable Scheduling', href: '/admin/timetable', icon: Calendar },
    { label: 'Live Class Coverage', href: '/admin/coverage', icon: Activity, badge: 'Live' },
    { label: 'Operations & Alerts', href: '/admin/operations', icon: AlertTriangle },
    { label: 'Attendance Management', href: '/admin/attendance', icon: CalendarCheck },
    { label: 'Analytics & Workload', href: '/admin/analytics', icon: BarChart3 },
    { label: 'Reports & Analytics', href: '/admin/reports', icon: FileText },
    { label: 'AI Operations Copilot', href: '/admin/ai-copilot', icon: Sparkles, badge: 'Gemini' },
  ];

  const adminMasterNav = [
    { label: 'Departments', href: '/admin/departments', icon: Building2 },
    { label: 'Classes & Sections', href: '/admin/classes', icon: GraduationCap },
    { label: 'Course Subjects', href: '/admin/subjects', icon: BookOpen },
    { label: 'Academic Years', href: '/admin/academic-years', icon: CalendarDays },
  ];

  const adminSystemNav = [
    { label: 'Security Audit Trail', href: '/admin/audit-logs', icon: ShieldAlert },
    { label: 'System Settings', href: '/admin/settings', icon: Settings },
    { label: 'Foundation Specs', href: '/foundation', icon: Database },
  ];

  // Staff Navigation Items
  const staffNav = [
    { label: 'My Workspace', href: '/staff/dashboard', icon: LayoutDashboard },
    { label: 'My AI Assistant', href: '/staff/ai-assistant', icon: Sparkles, badge: 'AI' },
    { label: 'Reports & Exports', href: '/staff/reports', icon: FileText },
    { label: 'Workload Analytics', href: '/staff/workload', icon: PieChart },
    { label: 'Performance Metrics', href: '/staff/performance', icon: Award },
    { label: 'Foundation Specs', href: '/foundation', icon: Database },
  ];

  const renderNavItems = (items: Array<{ label: string; href: string; icon: any; badge?: string }>) => (
    items.map((item) => {
      const isActive =
        location.pathname === item.href ||
        (item.href !== '/admin/dashboard' && item.href !== '/staff/dashboard' && location.pathname.startsWith(item.href));
      const Icon = item.icon;

      return (
        <Link
          key={item.href}
          to={item.href}
          onClick={() => setMobileSidebarOpen(false)}
          className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
            isActive
              ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
              }`}
            />
            <span className="truncate">{item.label}</span>
          </div>
          {item.badge && (
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                isActive
                  ? 'bg-blue-700 text-blue-100'
                  : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
              }`}
            >
              {item.badge}
            </span>
          )}
        </Link>
      );
    })
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans antialiased">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/95 p-0.5 flex items-center justify-center shadow-xs border border-slate-700/60 shrink-0">
            <img
              src="/assets/branding/logo-emblem.png"
              alt="AI Staff OS Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-white tracking-tight">AI Staff Operations</div>
            <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
              {isAdmin ? 'Admin Portal' : 'Faculty Workspace'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white focus:outline-none"
          aria-label="Toggle Navigation"
        >
          {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800/80 flex items-center bg-slate-950/40">
          <BrandLogo variant="compact" />
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {isAdmin ? (
            <>
              <div className="space-y-1">
                <div className="px-3 pb-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {'OPERATIONS & COVERAGE'}
                  </div>
                  <div className="text-[9px] font-medium text-slate-400 tracking-tight">
                    {'Operational Intelligence & Monitoring'}
                  </div>
                </div>
                {renderNavItems(adminCoreNav)}
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-800/60">
                <div className="px-3 pb-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {'MASTER DATA'}
                  </div>
                  <div className="text-[9px] font-medium text-slate-400 tracking-tight">
                    {'Institutional Master Data'}
                  </div>
                </div>
                {renderNavItems(adminMasterNav)}
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-800/60">
                <div className="px-3 pb-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {'PLATFORM & SECURITY'}
                  </div>
                </div>
                {renderNavItems(adminSystemNav)}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Faculty Workspace
              </div>
              {renderNavItems(staffNav)}
            </div>
          )}
        </nav>

        {/* User Profile & Logout in Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/30">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
              {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {user?.fullName || user?.email || 'User'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {isAdmin ? 'Administrator' : user?.staffId || 'Faculty'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Unified Top Navbar */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  if (onSearch) onSearch(e.target.value);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-12 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition-all"
              />
              <span className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-200/60 border border-slate-300/60">
                ⌘K
              </span>
            </div>
          </form>

          {/* Right Action Icons & Profile */}
          <div className="flex items-center gap-3 ml-4 shrink-0">
            {/* Live Monitoring Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Monitoring Active</span>
            </div>

            {/* Notification Center */}
            <NotificationDropdown />

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:block text-left pr-1">
                  <div className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[120px]">
                    {user?.fullName || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {isAdmin ? 'Admin' : 'Faculty'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileDropdownOpen && (
                <div
                  onMouseLeave={() => setProfileDropdownOpen(false)}
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.fullName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <div className="mt-1.5 inline-block">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {user?.role}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    {isAdmin && (
                      <Link
                        to="/admin/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-400" />
                        <span>System Settings</span>
                      </Link>
                    )}
                    <Link
                      to={isAdmin ? '/admin/ai-copilot' : '/staff/ai-assistant'}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>{isAdmin ? 'AI Operations Copilot' : 'My AI Assistant'}</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
        {/* Floating AI Chatbot in bottom-right corner of all dashboard pages */}
        <FloatingAiChatbot />
      </div>
    </div>
  );
};
