import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'outline' | 'muted';
  className?: string;
}

export function Badge({ children, variant = 'outline', className }: BadgeProps) {
  const variants = {
    primary: 'bg-brand-primary/10 text-brand-primary border-brand-primary/25',
    success: 'bg-status-success/10 text-status-success border-status-success/25',
    danger: 'bg-status-danger/10 text-status-danger border-status-danger/25',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/25',
    info: 'bg-status-info/10 text-status-info border-status-info/25',
    outline: 'bg-transparent text-zinc-300 border-zinc-700',
    muted: 'bg-zinc-900 text-zinc-500 border-zinc-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
