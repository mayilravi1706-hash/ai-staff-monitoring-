import { BrandLogo } from '../../components/common/BrandLogo';
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Smartphone,
  Download,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Form states
  const [role, setRole] = useState<'ADMIN' | 'STAFF'>('ADMIN');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Validation
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);

  // Validation
  const validateForm = (): boolean => {
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errors.identifier = 'Email address or Staff ID is required.';
    }
    if (!password) {
      errors.password = 'Password is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        identifier: identifier.trim(),
        password,
        role,
      });

      setLoginSuccess(true);

      // Brief transition before navigating
      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname;
        if (from && from !== '/login') {
          navigate(from, { replace: true });
        } else if (role === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/staff/dashboard', { replace: true });
        }
      }, 500);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please verify your credentials.';
      setServerError(msg);
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = (demoRole: 'ADMIN' | 'STAFF', demoIdentifier: string, demoPass: string) => {
    setRole(demoRole);
    setIdentifier(demoIdentifier);
    setPassword(demoPass);
    setFieldErrors({});
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-blue-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Institutional Branding */}
        <div className="flex flex-col items-center text-center">
          <BrandLogo variant="full" className="mb-2" />
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Institutional Faculty Workload, Real-time Class Monitoring & Operations OS
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-7 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8">
          {/* Direct Mobile App APK Download Banner */}
          <div className="mb-5 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">Android Mobile App (.APK)</p>
                <p className="text-[11px] text-slate-500 truncate">Install directly on Android mobile</p>
              </div>
            </div>
            <a
              href="/app-debug.apk"
              download="AI_Staff_Platform.apk"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>

          {/* Role Selector Tabs */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Operating Role
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setRole('ADMIN');
                  setServerError(null);
                }}
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  role === 'ADMIN'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Administrator</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('STAFF');
                  setServerError(null);
                }}
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  role === 'STAFF'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Faculty / Staff</span>
              </button>
            </div>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-rose-900">Authentication Failed</p>
                <p className="mt-0.5 text-rose-700 leading-relaxed">{serverError}</p>
                <button
                  type="button"
                  onClick={() => setServerError(null)}
                  className="mt-1.5 font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Dismiss and try again
                </button>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {loginSuccess && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-emerald-900">Authentication Verified</p>
                <p className="text-emerald-700">Redirecting to institutional dashboard...</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Identifier Input */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                {role === 'ADMIN' ? 'Admin Email Address' : 'Email Address or Staff ID'}
              </label>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  disabled={isSubmitting}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (fieldErrors.identifier) {
                      setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                    }
                  }}
                  placeholder={
                    role === 'ADMIN'
                      ? 'admin@college.demo'
                      : 'arun.kumar@college.demo or STF-CSE-001'
                  }
                  className={`block w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.identifier
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
              </div>
              {fieldErrors.identifier && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.identifier}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-semibold"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative rounded-xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••••••"
                  className={`block w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.password
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || loginSuccess}
              className={`w-full mt-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-xs ${
                isSubmitting || loginSuccess
                  ? 'bg-blue-400 cursor-not-allowed opacity-80'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : loginSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Authenticated</span>
                </>
              ) : (
                <>
                  <span>Sign In as {role === 'ADMIN' ? 'Administrator' : 'Staff'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Seed Demo Credentials Box */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Seed Demo Credentials (PostgreSQL)
              </span>
              {showDemoAccounts ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showDemoAccounts && (
              <div className="mt-3 space-y-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                {/* Admin demo card */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        ADMIN
                      </span>
                      <span className="font-mono text-slate-800">admin@college.demo</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">Password: <span className="font-mono text-slate-700">Admin@123</span></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('ADMIN', 'admin@college.demo', 'Admin@123')}
                    className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold transition-all"
                  >
                    Use
                  </button>
                </div>

                {/* Staff demo card */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        STAFF
                      </span>
                      <span className="font-mono text-slate-800">arun.kumar@college.demo</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      ID: <span className="font-mono text-slate-700">STF-CSE-001</span> | Pass: <span className="font-mono text-slate-700">Staff@123</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFillDemo('STAFF', 'STF-CSE-001', 'Staff@123')}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-semibold transition-all"
                  >
                    Use
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase 1 Foundation link */}
        <div className="mt-5 text-center">
          <Link
            to="/foundation"
            className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4 transition-colors"
          >
            ← View Phase 1 Infrastructure Health & Status
          </Link>
        </div>
      </div>
    </div>
  );
};
