import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import {
  Shield,
  Mail,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  ExternalLink,
} from 'lucide-react';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetResult, setResetResult] = useState<{
    message: string;
    devResetToken?: string;
    devResetUrl?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Email address is required.');
      return;
    }
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    try {
      const data = await authService.forgotPassword(trimmed);
      setResetResult(data);
    } catch (err: any) {
      setServerError(err.message || 'Unable to process reset request. Please try again.');
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
            Reset Password
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Enter your registered institutional email to receive secure recovery instructions.
          </p>
        </div>

        <div className="mt-7 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8">
          {serverError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-rose-900">Request Error</p>
                <p className="mt-0.5 text-rose-700">{serverError}</p>
                <button
                  type="button"
                  onClick={() => setServerError(null)}
                  className="mt-1.5 font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry request
                </button>
              </div>
            </div>
          )}

          {resetResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900">Instructions Generated</p>
                  <p className="text-emerald-700 mt-1 leading-relaxed">
                    {resetResult.message}
                  </p>
                </div>
              </div>

              {resetResult.devResetToken && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-2">
                  <p className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Development Reset Link (Single-Use, 15 min):
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    In this preview runtime, you can proceed directly to the reset screen:
                  </p>
                  <Link
                    to={resetResult.devResetUrl || `/reset-password?token=${resetResult.devResetToken}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-2xs"
                  >
                    <span>Proceed to Password Reset</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Institutional Email Address
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    placeholder="e.g. arun.kumar@college.demo"
                    className={`block w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${
                      fieldError
                        ? 'border-rose-400 focus:ring-rose-200'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {fieldError && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {fieldError}
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
                    <span>Processing Request...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
