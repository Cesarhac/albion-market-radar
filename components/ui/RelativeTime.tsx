'use client';

import React from 'react';
import { formatRelativeTime } from '@/lib/utils';

type RelativeTimeProps = {
  date?: string | number | Date | null;
  prefix?: string;
  fallback?: string;
  className?: string;
};

export function RelativeTime({
  date,
  prefix,
  fallback = 'atualizando...',
  className,
}: RelativeTimeProps) {
  const [label, setLabel] = React.useState(fallback);

  React.useEffect(() => {
    if (!date) return;

    const updateLabel = () => {
      setLabel(formatRelativeTime(date));
    };

    const timeout = window.setTimeout(updateLabel, 0);
    const interval = window.setInterval(updateLabel, 60_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [date]);

  const visibleLabel = date ? label : fallback;

  return (
    <span className={className} suppressHydrationWarning>
      {prefix ? `${prefix} ` : ''}
      {visibleLabel}
    </span>
  );
}
