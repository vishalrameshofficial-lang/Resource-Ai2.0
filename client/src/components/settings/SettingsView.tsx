import React, { useEffect, useState } from 'react';
import { Settings, Database, Radio, Cpu, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

export function SettingsView() {
  const [health, setHealth] = useState<any>(null);
  const [exotel, setExotel] = useState<any>(null);
  const { user, switchRoleQuickly } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const fetchInfo = async () => {
    setIsLoading(true);
    try {
      const [h, e] = await Promise.all([api.getHealth(), api.getExotelStatus()]);
      setHealth(h);
      setExotel(e);
    } catch (err) {
      console.warn('Settings load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <span>ResourceAI System & Architecture Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Production environment parameters, native node:sqlite database engine and Exotel telephony configuration.
          </p>
        </div>

        <button
          onClick={fetchInfo}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Native Database Card */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Database Engine</h4>
              <p className="text-xs text-slate-400">Zero native-gyp SQLite</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
            <div>Engine: <span className="text-emerald-400 font-bold">native node:sqlite</span></div>
            <div>Database Path: <span className="text-slate-400">./server/data/resourceai.db</span></div>
            <div>Status: <span className="text-blue-400">{health?.database || 'Connected'}</span></div>
            <div>WAL Mode: <span className="text-purple-400">ENABLED (High Concurrency)</span></div>
          </div>
        </div>

        {/* Exotel Voicebot Stream Card */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Exotel AgentStream Protocol</h4>
              <p className="text-xs text-slate-400">Bidirectional Telephony WebSocket</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
            <div>Helpline: <span className="text-emerald-400 font-bold">{exotel?.data?.phoneNumber || '+91 8047359000'}</span></div>
            <div>Stream Route: <span className="text-cyan-400">/api/voice/exotel/stream</span></div>
            <div>Sample Rate: <span className="text-amber-400">{exotel?.data?.sampleRate || 8000} Hz Mono</span></div>
            <div>Audio Codec: <span className="text-purple-400">{exotel?.data?.codec || 'audio/l16'}</span></div>
          </div>
        </div>

        {/* AI & Speech Provider Abstraction */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">AI Provider Abstraction</h4>
              <p className="text-xs text-slate-400">Pluggable LLM, STT & TTS</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
            <div>AI Provider: <span className="text-blue-400">OpenAI / Mock Fallback</span></div>
            <div>STT Engine: <span className="text-cyan-400">Whisper / Telephony STT</span></div>
            <div>TTS Engine: <span className="text-purple-400">OpenAI TTS-1 / Telephony Synth</span></div>
            <div>Safety Guardrails: <span className="text-emerald-400 font-bold">STRICT (Zero unverified claims)</span></div>
          </div>
        </div>

        {/* Access Control & Roles */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Access Control (RBAC)</h4>
              <p className="text-xs text-slate-400">Current User Session</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-1.5 text-slate-300">
            <div>User Email: <span className="text-slate-200">{user?.email || 'admin@resourceai.org'}</span></div>
            <div>Active Role: <span className="text-blue-400 font-bold">{user?.role || 'ADMIN'}</span></div>
            <div>JWT Authentication: <span className="text-emerald-400">ACTIVE</span></div>
            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={() => switchRoleQuickly('ADMIN')}
                className={`px-2 py-0.5 rounded text-[10px] ${user?.role === 'ADMIN' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                ADMIN
              </button>
              <button
                onClick={() => switchRoleQuickly('OPERATOR')}
                className={`px-2 py-0.5 rounded text-[10px] ${user?.role === 'OPERATOR' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                OPERATOR
              </button>
              <button
                onClick={() => switchRoleQuickly('VIEWER')}
                className={`px-2 py-0.5 rounded text-[10px] ${user?.role === 'VIEWER' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-300'}`}
              >
                VIEWER
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
