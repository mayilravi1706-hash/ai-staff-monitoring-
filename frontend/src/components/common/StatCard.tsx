import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'emerald' | 'indigo' | 'amber' | 'purple' | 'rose' | 'slate';
  badge?: string;
  onClick?: () => void;
}

const colorMaps = {
  blue: {
    iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
    highlight: 'text-blue-600',
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    highlight: 'text-emerald-600',
  },
  indigo: {
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    highlight: 'text-indigo-600',
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
    highlight: 'text-amber-600',
  },
  purple: {
    iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
    highlight: 'text-purple-600',
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600 border-rose-100',
    highlight: 'text-rose-600',
  },
  slate: {
    iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
    highlight: 'text-slate-600',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  subtext,
  trend,
  color = 'blue',
  badge,
  onClick,
}) => {
  const styles = colorMaps[color] || colorMaps.blue;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
            {label}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {value}
            </span>
            {badge && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${styles.iconBg}`}>
                {badge}
              </span>
            )}
          </div>
        </div>

        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${styles.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {subtext && <span className="truncate">{subtext}</span>}
          {trend && (
            <span
              className={`font-semibold shrink-0 ${
                trend.isPositive ? 'text-emerald-600' : 'text-slate-600'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
