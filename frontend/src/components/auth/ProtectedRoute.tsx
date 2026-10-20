import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ADMIN' | 'STAFF')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 bg-slate-800/80 border border-slate-700 p-8 rounded-2xl shadow-xl max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">Verifying Session</h3>
            <p className="text-slate-400 text-sm mt-1">Authenticating with institutional credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect to login while preserving the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role restrictions if specified
  if (allowedRoles && !allowedRoles.includes(user.role as 'ADMIN' | 'STAFF')) {
    const defaultDashboard = user.role === 'ADMIN' ? '/admin/dashboard' : '/staff/dashboard';
    return <Navigate to={defaultDashboard} replace />;
  }

  return <>{children}</>;
};
