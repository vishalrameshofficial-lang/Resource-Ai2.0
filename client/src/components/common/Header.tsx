import React from 'react';
import { Shield, PhoneCall, Radio, User, Activity } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRealtimeConnected: boolean;
  liveCallsCount: number;
}

export function Header({ activeTab, setActiveTab, isRealtimeConnected, liveCallsCount }: HeaderProps) {
  const { user, switchRoleQuickly } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Brand & Helpline Badge */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  RESOURCE<span className="text-blue-500">AI</span>
                </span>
                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded border border-blue-500/30">
                  DISASTER RELIEF
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none">AI Multilingual Emergency Dispatch</p>
            </div>
          </div>

          {/* Call Us Header Button & Exotel Helpline */}
          <a
            href="tel:+914447615477"
            aria-label="Call ResourceAI Helpline at +91 44 4761 5477"
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 border border-emerald-400/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <PhoneCall className="w-3.5 h-3.5 text-white" />
            <span>Call Us:</span>
            <span className="font-mono text-emerald-100 font-semibold tracking-wide">
              +91 44 4761 5477
            </span>
          </a>
        </div>

        {/* Center / Right: Live Status, Role Switcher, Quick Citizen View */}
        <div className="flex items-center space-x-3">
          {/* Real-time SSE indicator */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
            <Radio className={`w-3.5 h-3.5 ${isRealtimeConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-slate-400 hidden sm:inline">SSE Feed:</span>
            <span className={isRealtimeConnected ? 'text-emerald-400 font-medium' : 'text-slate-500 font-medium'}>
              {isRealtimeConnected ? 'Live' : 'Connecting'}
            </span>
          </div>

          {/* Live Calls Count Pill */}
          {liveCallsCount > 0 && (
            <button
              onClick={() => setActiveTab('calls')}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold animate-pulse"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{liveCallsCount} Active Call{liveCallsCount > 1 ? 's' : ''}</span>
            </button>
          )}

          {/* Citizen Portal Quick Link */}
          <button
            onClick={() => setActiveTab('citizen')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'citizen'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            Citizen Intake Form
          </button>

          {/* User Role Switcher Dropdown for Demo */}
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <span className="text-slate-400 font-medium hidden md:inline">Role:</span>
            <select
              value={user?.role || 'ADMIN'}
              onChange={(e) => switchRoleQuickly(e.target.value as UserRole)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer pr-1"
            >
              <option value="ADMIN" className="bg-slate-900 text-slate-100">ADMIN</option>
              <option value="OPERATOR" className="bg-slate-900 text-slate-100">OPERATOR</option>
              <option value="VIEWER" className="bg-slate-900 text-slate-100">VIEWER</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
