import React from 'react';
import { PhoneCall, Activity, Clock, Languages, CheckCircle2, ChevronRight, Radio } from 'lucide-react';
import { ActiveLiveCall } from '../../types/emergency';
import { maskPhone } from '../../lib/utils';
import { DepartmentDashboardView } from './DepartmentDashboardView';

interface LiveCallsViewProps {
  activeCalls: ActiveLiveCall[];
  onOpenSimulator?: () => void;
}

const STAGES = [
  'EMERGENCY',
  'LOCATION',
  'PEOPLE',
  'RESOURCES',
  'CONFIRMATION'
];

const STAGE_INDEX_MAP: Record<string, number> = {
  GREETING: 0,
  EMERGENCY: 0,
  LOCATION: 1,
  PEOPLE: 2,
  RESOURCES: 3,
  CONFIRMATION: 4,
  SUBMISSION: 4,
  COMPLETED: 5
};

export function LiveCallsView({ activeCalls }: LiveCallsViewProps) {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span>Active Exotel AI Voicebot Calls</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time monitoring of in-flight citizen telephone triage sessions.
          </p>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Exotel Virtual Helpline Active (+91 44 4761 5477)</span>
        </div>
      </div>

      {/* Active Calls Grid */}
      {activeCalls.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center">
            <PhoneCall className="w-8 h-8 text-slate-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">No Calls Currently In Progress</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              The AI Voice Agent helpline is waiting for incoming calls on Exotel number{' '}
              <a href="tel:+914447615477" className="text-emerald-400 font-mono font-bold hover:underline">
                +91 44 4761 5477
              </a>.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Telephony Stream: /api/voice/exotel/stream</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activeCalls.map((call) => {
            const currentStageIndex = STAGE_INDEX_MAP[call.stage] ?? STAGES.indexOf(call.stage);

            return (
              <div
                key={call.id}
                className="glass-panel p-5 rounded-2xl border border-cyan-500/30 shadow-xl space-y-4 relative overflow-hidden"
              >
                {/* Active Call Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
                      <PhoneCall className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-white">
                          {maskPhone(call.callerPhone)}
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        SID: {call.callSid}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[11px] font-semibold border border-blue-500/30 flex items-center space-x-1">
                      <Languages className="w-3 h-3" />
                      <span>{call.language}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{call.durationSec}s</span>
                    </span>
                  </div>
                </div>

                {/* Audio Telephony Activity Waves */}
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1 items-end h-5">
                      <span className="w-1 bg-cyan-400 voice-bar-1 rounded-full" />
                      <span className="w-1 bg-cyan-400 voice-bar-2 rounded-full" />
                      <span className="w-1 bg-cyan-400 voice-bar-3 rounded-full" />
                      <span className="w-1 bg-cyan-400 voice-bar-4 rounded-full" />
                      <span className="w-1 bg-cyan-400 voice-bar-2 rounded-full" />
                    </div>
                    <span className="text-xs text-slate-300 font-medium">
                      AgentStream: Bidirectional Audio Active
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10">
                    STAGE: {call.stage}
                  </span>
                </div>

                {/* Conversation Stage Progression Track */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Conversation Progress ({currentStageIndex >= 0 ? currentStageIndex + 1 : 1}/{STAGES.length})
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {STAGES.map((stg, idx) => {
                      const isPast = idx < currentStageIndex;
                      const isCurrent = idx === currentStageIndex;

                      return (
                        <div
                          key={stg}
                          className={`p-1.5 rounded-lg text-center text-[9px] font-bold tracking-tight transition ${
                            isCurrent
                              ? 'bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/20 animate-pulse'
                              : isPast
                              ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {stg}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Generated Request ID if submitted */}
                {call.requestId && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Request Saved:</span>
                    </span>
                    <strong className="font-mono text-sm text-white">{call.requestId}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post-Call AI Query Understanding & Department Classification Section */}
      <div className="pt-6 border-t border-slate-800/80">
        <DepartmentDashboardView activeLiveCallsCount={activeCalls.length} />
      </div>
    </div>
  );
}
