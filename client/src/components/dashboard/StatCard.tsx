import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  color: 'red' | 'amber' | 'blue' | 'purple' | 'cyan' | 'emerald';
  badge?: string;
  onClick?: () => void;
}

export function StatCard({ title, value, subtitle, icon: Icon, color, badge, onClick }: StatCardProps) {
  const colorMap = {
    red: {
      bg: 'bg-red-500/10 border-red-500/20 text-red-400',
      iconBg: 'bg-red-500/20 text-red-400',
      glow: 'shadow-red-500/10'
    },
    amber: {
      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      iconBg: 'bg-amber-500/20 text-amber-400',
      glow: 'shadow-amber-500/10'
    },
    blue: {
      bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      iconBg: 'bg-blue-500/20 text-blue-400',
      glow: 'shadow-blue-500/10'
    },
    purple: {
      bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      iconBg: 'bg-purple-500/20 text-purple-400',
      glow: 'shadow-purple-500/10'
    },
    cyan: {
      bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
      iconBg: 'bg-cyan-500/20 text-cyan-400',
      glow: 'shadow-cyan-500/10'
    },
    emerald: {
      bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      glow: 'shadow-emerald-500/10'
    }
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 rounded-2xl border transition-all duration-200 hover:scale-[1.02] shadow-lg ${scheme.glow} ${
        onClick ? 'cursor-pointer hover:border-slate-700' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline space-x-2 mt-2">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scheme.bg}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl border border-white/5 ${scheme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
