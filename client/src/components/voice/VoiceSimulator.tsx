import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  RotateCcw,
  Volume2,
  VolumeX,
  Languages,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  User,
  Bot
} from 'lucide-react';
import { api } from '../../lib/api';

const QUICK_PROMPTS: Record<string, string[]> = {
  English: [
    "There is flooding in our village and 25 people need food and drinking water.",
    "Near Coimbatore railway station.",
    "About 25 people.",
    "Food and drinking water.",
    "Yes."
  ],
  Tamil: [
    "திருநெல்வேலி அருகே எங்கள் பகுதியில் வெள்ளப்பெருக்கு ஏற்பட்டுள்ளது. உணவு மற்றும் குடிநீர் தேவை.",
    "குறுக்குத்துறை முருகன் கோவில் படித்துறை அருகே.",
    "சுமார் 35 பேர் மாடியில் தவிக்கிறோம்.",
    "ஆம், உறுதி செய்கிறேன்."
  ],
  Hindi: [
    "हमारे क्षेत्र में बाढ़ आ गई है और हमें भोजन और पीने के पानी की सख्त जरूरत है।",
    "कुल्लू रेलवे स्टेशन के पास।",
    "लगभग 20 लोग फंसे हैं।",
    "हाँ, यह सही है।"
  ]
};

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

export function VoiceSimulator() {
  const [language, setLanguage] = useState('English');
  const [callerPhone, setCallerPhone] = useState('+919876543210');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState('GREETING');
  const [transcript, setTranscript] = useState<Array<{ role: 'caller' | 'assistant'; text: string; time: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [extractedData, setExtractedData] = useState<any>({});
  const [finalRequestId, setFinalRequestId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Audio Speech Synthesis for phone simulation
  const speakText = (text: string, lang: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langCodes: Record<string, string> = {
      English: 'en-US',
      Tamil: 'ta-IN',
      Hindi: 'hi-IN',
      Telugu: 'te-IN',
      Malayalam: 'ml-IN',
      Kannada: 'kn-IN',
      Bengali: 'bn-IN',
      Odia: 'or-IN'
    };
    utterance.lang = langCodes[lang] || 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Start new simulated call
  const startNewCall = async () => {
    setIsLoading(true);
    setTranscript([]);
    setFinalRequestId(null);
    setExtractedData({});

    try {
      const res = await api.testVoice('', language, callerPhone);
      if (res.success && res.data) {
        setSessionId(res.data.sessionId);
        setCurrentStage(res.data.stage);
        const greeting = res.data.replyText;
        setTranscript([
          { role: 'assistant', text: greeting, time: new Date().toLocaleTimeString() }
        ]);
        speakText(greeting, language);
      }
    } catch (err) {
      console.warn('Simulator start error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    startNewCall();
  }, [language]);

  const handleSendUtterance = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || isLoading) return;

    setInputText('');
    const userTime = new Date().toLocaleTimeString();

    // Optimistically add caller message
    setTranscript((prev) => [...prev, { role: 'caller', text: text.trim(), time: userTime }]);
    setIsLoading(true);

    try {
      const res = await api.testVoice(text.trim(), language, callerPhone, sessionId || undefined);
      if (res.success && res.data) {
        setCurrentStage(res.data.stage);
        if (res.data.gatheredData) {
          setExtractedData(res.data.gatheredData);
        }
        if (res.data.requestId) {
          setFinalRequestId(res.data.requestId);
        }

        const reply = res.data.replyText;
        setTranscript((prev) => [
          ...prev,
          { role: 'assistant', text: reply, time: new Date().toLocaleTimeString() }
        ]);

        speakText(reply, language);
      }
    } catch (err: any) {
      console.error('Simulator utterance error:', err);
      setTranscript((prev) => [
        ...prev,
        { role: 'assistant', text: "Error communicating with AI agent.", time: new Date().toLocaleTimeString() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStageIndex = STAGE_INDEX_MAP[currentStage] ?? STAGES.indexOf(currentStage);
  const prompts = QUICK_PROMPTS[language] || QUICK_PROMPTS.English;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Chat & Voice Simulator Screen */}
      <div className="lg:col-span-2 glass-panel rounded-2xl border border-slate-800 flex flex-col h-[650px] shadow-2xl overflow-hidden">
        {/* Call Banner */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
                <PhoneCall className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white">AI Emergency Voicebot Call</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  LIVE SIMULATOR
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">Caller: {callerPhone}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? 'Mute AI voice output' : 'Enable AI voice output'}
              className={`p-2 rounded-lg border transition ${
                ttsEnabled
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={startNewCall}
              title="Restart call simulation"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stage Tracker Bar */}
        <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Stage ({currentStageIndex + 1}/{STAGES.length}):</span>
          <div className="flex items-center space-x-1 overflow-x-auto max-w-full">
            {STAGES.map((s, idx) => (
              <span
                key={s}
                className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-tight whitespace-nowrap ${
                  idx === currentStageIndex
                    ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-400'
                    : idx < currentStageIndex
                    ? 'bg-blue-600/30 text-blue-300'
                    : 'text-slate-600'
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Chat / Utterances Feed */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-950/30">
          {transcript.map((msg, i) => {
            const isAssistant = msg.role === 'assistant';

            return (
              <div
                key={i}
                className={`flex items-start space-x-2.5 ${isAssistant ? '' : 'flex-row-reverse space-x-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                    isAssistant
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[78%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isAssistant
                      ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-sm shadow'
                      : 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`block text-[9px] mt-1 ${
                      isAssistant ? 'text-slate-500' : 'text-blue-200 text-right'
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center space-x-2 text-xs text-cyan-400">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>AI is thinking & processing speech...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Click Utterances (Section 2 Prompt flow) */}
        <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800 flex items-center space-x-2 overflow-x-auto text-[11px]">
          <span className="text-slate-400 shrink-0 font-medium">Quick Utterances:</span>
          {prompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendUtterance(p)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap transition disabled:opacity-50"
            >
              "{p.length > 28 ? p.slice(0, 28) + '...' : p}"
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            placeholder={`Speak or type citizen reply in ${language}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendUtterance()}
            className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleSendUtterance()}
            disabled={isLoading || !inputText.trim()}
            className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl shadow transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right Column: Settings & Live Extraction Inspector */}
      <div className="space-y-5">
        {/* Language & Phone Controls */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
            <Languages className="w-4 h-4 text-blue-400" />
            <span>Call Simulation Settings</span>
          </h4>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Helpline Language:
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100"
            >
              {['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Odia'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Caller Phone Number:
            </label>
            <input
              type="text"
              value={callerPhone}
              onChange={(e) => setCallerPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 font-mono"
            />
          </div>
        </div>

        {/* Live Structured JSON Extraction Preview */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Live AI Structured Extraction</span>
            </h4>
            <span className="text-[10px] text-cyan-400 font-mono font-bold">
              {currentStage}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1.5 max-h-[220px] overflow-y-auto">
            <div>Category: <span className="text-blue-400">{extractedData.category || 'Extracting...'}</span></div>
            <div>Location: <span className="text-amber-400">{extractedData.location || 'Pending location'}</span></div>
            <div>Affected People: <span className="text-cyan-400">{extractedData.affectedPeople || 1}</span></div>
            <div>Urgency: <span className="text-red-400">{extractedData.urgency || 'HIGH'}</span></div>
            <div>
              Resources:
              <span className="text-emerald-400 block ml-2">
                {extractedData.requirements && extractedData.requirements.length > 0
                  ? extractedData.requirements.map((r: any) => `${r.quantity || ''} ${r.item}`).join(', ')
                  : 'Pending requirements'}
              </span>
            </div>
            <div>Confirmed: <span className="text-purple-400">{extractedData.confirmed ? 'true' : 'false'}</span></div>
          </div>

          {/* Generated Request confirmation */}
          {finalRequestId && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold block">Emergency Request Recorded:</span>
                <span className="font-mono text-white text-sm">{finalRequestId}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
