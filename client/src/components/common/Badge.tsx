import React from 'react';
import { UrgencyLevel, RequestStatus } from '../../types/emergency';
import { getUrgencyBadgeColor, getStatusBadgeColor, formatStatusLabel, cn } from '../../lib/utils';

export function UrgencyBadge({ urgency, className }: { urgency: UrgencyLevel; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        getUrgencyBadgeColor(urgency),
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current" />
      {urgency}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider',
        getStatusBadgeColor(status),
        className
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

export function SourceBadge({ source }: { source: 'WEB' | 'AI VOICE' | 'ADMIN' }) {
  const styles = {
    'AI VOICE': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    WEB: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    ADMIN: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
  };

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border tracking-wide', styles[source] || styles.WEB)}>
      {source === 'AI VOICE' && (
        <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
      )}
      {source}
    </span>
  );
}
