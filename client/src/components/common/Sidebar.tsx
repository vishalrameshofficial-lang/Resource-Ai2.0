import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  PhoneCall,
  MapPin,
  Building2,
  Mic,
  FileText,
  Settings,
  ShieldCheck,
  Radio
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  liveCallsCount: number;
  newRequestsCount: number;
}

export function Sidebar({ activeTab, setActiveTab, liveCallsCount, newRequestsCount }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'requests',
      label: 'Emergency Requests',
      icon: AlertTriangle,
      badge: newRequestsCount > 0 ? newRequestsCount : undefined,
      badgeColor: 'bg-red-500'
    },
    {
      id: 'calls',
      label: 'Departments & Calls',
      icon: PhoneCall,
      badge: liveCallsCount > 0 ? liveCallsCount : undefined,
      badgeColor: 'bg-cyan-500 animate-pulse'
    },
    { id: 'map', label: 'Disaster Map', icon: MapPin },
    { id: 'dispatch', label: 'Government Dispatch', icon: Building2 },
    { id: 'simulator', label: 'Exotel Telephony', icon: Radio },
    { id: 'citizen', label: 'Citizen Portal', icon: FileText },
    { id: 'settings', label: 'Settings & Config', icon: Settings }
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex flex-col justify-between p-4 shrink-0 min-h-[calc(100vh-61px)]">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
          <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
            Disaster Operations
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Exotel Live Stream Box */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exotel AgentStream</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            Bidirectional WebSocket AI Bot listening on port 5055.
          </p>
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
            <span className="text-slate-400">Telephony Line:</span>
            <span className="font-mono font-semibold text-emerald-400">+91 44 4761 5477</span>
          </div>
        </div>
      </div>

      {/* Safety & Protocol Footer */}
      <div className="pt-4 border-t border-slate-900 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium">Strict Safety Active</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Zero unconfirmed claims. Native node:sqlite engine.
        </p>
      </div>
    </aside>
  );
}
