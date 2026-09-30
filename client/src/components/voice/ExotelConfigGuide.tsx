import React, { useState, useEffect } from 'react';
import { Radio, Copy, Check, ExternalLink, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

export function ExotelConfigGuide() {
  const [exotelData, setExotelData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await api.getExotelStatus();
        setExotelData(res);
      } catch (err) {
        console.warn('Exotel status load error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wssUrl = exotelData?.data?.publicWssUrl || 'wss://YOUR_DOMAIN/api/voice/exotel/stream';

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">
              Exotel AgentStream / Voicebot Integration Guide
            </h3>
            <p className="text-xs text-slate-400">
              Configure your Exotel Flow to stream caller audio into ResourceAI bidirectional WebSocket.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-semibold text-emerald-400">WebSocket Ready</span>
        </div>
      </div>

      {/* Critical Tunnel Warning from Prompt */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">Important Exotel Telephony Rule:</span>
          <p className="text-slate-300 leading-relaxed">
            Do not assume <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">localhost</code> can be reached directly by Exotel telephony servers.
            For local hackathon testing, expose port 5055 with a secure tunnel (e.g., <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">ngrok http 5055</code>) and set <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">PUBLIC_BASE_URL</code> in your <code className="text-slate-200">.env</code>.
          </p>
        </div>
      </div>

      {/* Step by step configuration instructions */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Step-by-Step Exotel Flow Setup:
        </h4>

        <div className="space-y-2 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[11px] shrink-0">
              1
            </span>
            <div>
              <span className="font-semibold text-white">Create Voicebot Flow in Exotel App Bazaar:</span>
              <p className="text-slate-400 mt-0.5">
                Log into Exotel dashboard → App Bazaar → Create new Flow → Add the <strong>Voicebot / AgentStream Applet</strong>.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[11px] shrink-0">
              2
            </span>
            <div className="flex-1">
              <span className="font-semibold text-white">Enter Bidirectional Stream Endpoint:</span>
              <div className="mt-1.5 flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300">
                <span className="truncate pr-2">{wssUrl}</span>
                <button
                  onClick={() => handleCopy(wssUrl)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center space-x-1 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy URL'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[11px] shrink-0">
              3
            </span>
            <div>
              <span className="font-semibold text-white">Configure Audio Telephony Codec:</span>
              <p className="text-slate-400 mt-0.5">
                Encoding: <strong className="text-slate-200">{exotelData?.data?.codec || 'audio/l16'}</strong> · Sample Rate: <strong className="text-slate-200">{exotelData?.data?.sampleRate || 8000} Hz Mono</strong>.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[11px] shrink-0">
              4
            </span>
            <div>
              <span className="font-semibold text-white">Connect Inbound Helpline Number:</span>
              <p className="text-slate-400 mt-0.5">
                Assign your fixed Exotel number (<a href="tel:+914447615477" className="text-emerald-400 font-mono font-bold hover:underline">+91 44 4761 5477</a>) to this applet. When callers dial, audio streams automatically to ResourceAI.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
