import React from 'react';

interface BreakdownProps {
  title: string;
  data: Array<{ name: string; count: number }>;
  total: number;
}

export function CategoryChart({ title, data, total }: BreakdownProps) {
  const categoryColors: Record<string, string> = {
    flood: 'bg-blue-500',
    landslide: 'bg-amber-600',
    cyclone: 'bg-cyan-400',
    medical: 'bg-red-500',
    building_collapse: 'bg-orange-500',
    fire: 'bg-rose-600',
    drowning: 'bg-teal-500',
    other: 'bg-slate-500'
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800">
      <h4 className="text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-slate-400 font-normal">{data.length} categories</span>
      </h4>

      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No categories recorded yet</p>
        ) : (
          data.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const barColor = categoryColors[item.name.toLowerCase()] || 'bg-blue-500';

            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize text-slate-300 font-medium">
                    {item.name.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white">{item.count}</span>
                    <span className="text-slate-400 text-[11px] w-8 text-right">({pct}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function StatusChart({ title, data, total }: BreakdownProps) {
  const statusColors: Record<string, string> = {
    NEW: 'bg-blue-500',
    VERIFIED: 'bg-indigo-500',
    FORWARDED_TO_GOVERNMENT: 'bg-purple-500',
    ACCEPTED: 'bg-cyan-500',
    RESOURCE_ALLOCATED: 'bg-amber-500',
    DELIVERY_IN_PROGRESS: 'bg-orange-500',
    DELIVERED: 'bg-emerald-500',
    REJECTED: 'bg-slate-600',
    CANCELLED: 'bg-red-800'
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800">
      <h4 className="text-sm font-semibold text-slate-200 mb-4 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-slate-400 font-normal">{data.length} active stages</span>
      </h4>

      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No status data yet</p>
        ) : (
          data.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const barColor = statusColors[item.name] || 'bg-slate-500';

            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {item.name.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white">{item.count}</span>
                    <span className="text-slate-400 text-[11px] w-8 text-right">({pct}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
