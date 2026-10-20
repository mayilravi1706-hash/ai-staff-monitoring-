import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'indigo'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'blue'
  | 'cyan';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; dot: string }> = {
    success: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
    emerald: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', dot: 'bg-emerald-500' },
    warning: { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500' },
    amber: { bg: 'bg-amber-50 text-amber-700 border-amber-200/80', dot: 'bg-amber-500' },
    error: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
    rose: { bg: 'bg-rose-50 text-rose-700 border-rose-200/80', dot: 'bg-rose-500' },
    info: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500' },
    blue: { bg: 'bg-blue-50 text-blue-700 border-blue-200/80', dot: 'bg-blue-500' },
    indigo: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', dot: 'bg-indigo-500' },
    purple: { bg: 'bg-purple-50 text-purple-700 border-purple-200/80', dot: 'bg-purple-500' },
    cyan: { bg: 'bg-cyan-50 text-cyan-700 border-cyan-200/80', dot: 'bg-cyan-500' },
    neutral: { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  };

  const sizeStyles = {
    xs: 'px-1.5 py-0.2 text-[10px] font-semibold',
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
  };

  const style = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${style.bg} ${sizeStyles[size]} tracking-tight ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />}
      <span>{children}</span>
    </span>
  );
};

/**
 * Maps operational entity status strings to semantic badges
 */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  const norm = (status || '').toUpperCase().trim();
  switch (norm) {
    case 'ACTIVE':
    case 'PRESENT':
    case 'COVERED':
    case 'SCHEDULED':
    case 'APPROVED':
    case 'COMPLETED':
    case 'READY':
    case 'TEACHING':
      return 'emerald';
    case 'NOT_RECORDED':
    case 'PENDING':
    case 'PREPARING_CLASS':
    case 'MEETING':
    case 'WARNING':
    case 'IN_PROGRESS':
    case 'BREAK':
      return 'amber';
    case 'ABSENT':
    case 'REJECTED':
    case 'CONFLICT':
    case 'OVERDUE':
    case 'URGENT':
    case 'ERROR':
    case 'FAILED':
      return 'rose';
    case 'UNRESOLVED':
    case 'DUPLICATE':
    case 'ADMINISTRATIVE_WORK':
    case 'INFO':
      return 'indigo';
    default:
      return 'neutral';
  }
}
