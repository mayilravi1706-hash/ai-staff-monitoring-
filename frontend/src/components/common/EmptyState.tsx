import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Records Found',
  description = 'There are currently no items available in this category.',
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 bg-white rounded-xl border border-dashed border-slate-300 text-center">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
        {icon || <Database className="w-5 h-5" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
    </div>
  );
};
