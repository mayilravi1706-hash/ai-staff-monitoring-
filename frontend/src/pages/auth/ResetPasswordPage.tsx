import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlToken = searchParams.get('token') || '';

  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    token?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
    }
  }, [urlToken]);

  const validate = (): boolean => {
    const errors: {
      token?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!token.trim()) {
      errors.token = 'Reset token is required.';
    }
    if (!newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long.';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Password confirmation is required.';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await authService.resetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setServerError(err.message || 'Password reset failed. The link may have expired or already been used.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-blue-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/25 mb-4 text-white">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Set New Password
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Create a secure password with a minimum of 8 characters.
          </p>
        </div>

        <div className="mt-7 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8">
          {serverError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-rose-900">Reset Failed</p>
                <p className="mt-0.5 text-rose-700">{serverError}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setServerError(null)}
                    className="font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                  <Link
                    to="/forgot-password"
                    className="font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2"
                  >
                    Request new link
                  </Link>
                </div>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900">Password Updated Successfully</p>
                  <p className="text-emerald-700 mt-1 leading-relaxed">
                    Your password has been changed securely and active sessions across other devices have been invalidated.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <span>Sign In with New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {!urlToken && (
                <div>
                  <label
                    htmlFor="token"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                  >
                    Reset Security Token
                  </label>
                  <input
                    id="token"
                    type="text"
                    disabled={isSubmitting}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      if (fieldErrors.token) {
                        setFieldErrors((prev) => ({ ...prev, token: undefined }));
                      }
                    }}
                    placeholder="Enter security token"
                    className={`block w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-900 font-mono text-xs placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.token
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                  {fieldErrors.token && (
                    <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {fieldErrors.token}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  New Password (min 8 characters)
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (fieldErrors.newPassword) {
                        setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                      }
                    }}
                    placeholder="••••••••••••"
                    className={`block w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.newPassword
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
                {fieldErrors.newPassword && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {fieldErrors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }
                    }}
                    placeholder="••••••••••••"
                    className={`block w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                      fieldErrors.confirmPassword
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-xs ${
                  isSubmitting
                    ? 'bg-blue-400 cursor-not-allowed opacity-80'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Change Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel and return to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
