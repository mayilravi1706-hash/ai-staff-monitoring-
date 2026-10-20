import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  subMessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Connecting to service...',
  subMessage = 'Querying live system health and database status',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
      <h3 className="text-sm font-semibold text-slate-800">{message}</h3>
      {subMessage && <p className="text-xs text-slate-500 mt-1 max-w-sm">{subMessage}</p>}
    </div>
  );
};
