import React from 'react';
import { PhoneCall, Activity, ArrowRight } from 'lucide-react';
import { ActiveLiveCall } from '../../types/emergency';

interface LiveCallsBannerProps {
  calls: ActiveLiveCall[];
  onViewCalls: () => void;
}

export function LiveCallsBanner({ calls, onViewCalls }: LiveCallsBannerProps) {
  if (!calls || calls.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-blue-950/60 border border-cyan-500/40 shadow-lg shadow-cyan-900/10 mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-cyan-400 animate-bounce" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-white">
                {calls.length} Active AI Phone Call{calls.length > 1 ? 's' : ''} in Progress
              </h4>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                AgentStream Live
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Listening via Exotel helpline. The AI voice agent is actively triaging citizen requests.
            </p>
          </div>
        </div>

        {/* Quick summary of in-flight call stages */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center space-x-2">
            {calls.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs flex items-center space-x-1.5"
              >
                <div className="flex space-x-0.5 items-end h-3">
                  <span className="w-0.5 bg-cyan-400 voice-bar-1" />
                  <span className="w-0.5 bg-cyan-400 voice-bar-2" />
                  <span className="w-0.5 bg-cyan-400 voice-bar-3" />
                </div>
                <span className="text-slate-300 font-mono">{c.language}</span>
                <span className="text-[10px] text-cyan-400 font-bold px-1 rounded bg-cyan-500/20">
                  {c.stage}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onViewCalls}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
          >
            <span>Monitor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
