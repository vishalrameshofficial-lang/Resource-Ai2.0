import { v4 as uuidv4 } from 'uuid';
import { CONVERSATION_STAGES, MULTILINGUAL_STRINGS } from './prompts.js';
import { getAIProvider } from './aiProvider.js';
import { getTTSProvider } from './ttsProvider.js';
import { validateEmergencyRequest } from './schemas.js';

export class ConversationSession {
  constructor(options = {}) {
    this.id = options.id || `sess-${uuidv4().substring(0, 8)}`;
    this.callSid = options.callSid || `exo_call_${Date.now()}`;
    this.streamSid = options.streamSid || `exo_str_${Date.now()}`;
    this.callerPhone = options.callerPhone || null;
    this.exotelNumber = options.exotelNumber || process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_PHONE_NUMBER || null;
    this.language = options.language || 'English';
    this.stage = options.stage || CONVERSATION_STAGES.GREETING;
    this.data = {
      name: '',
      category: '',
      description: '',
      location: '',
      landmark: '',
      affectedPeople: null,
      hasStatedPeople: false,
      hasStatedResources: false,
      requirements: [],
      urgency: 'HIGH',
      immediateDanger: false,
      confirmed: false
    };
    this.transcript = [];
    this.startedAt = new Date().toISOString();
    this.endedAt = null;
    this.requestId = null;
    this.status = 'IN_PROGRESS';
    this.isRealTelephony = Boolean(options.isRealTelephony);
    this.isSimulator = Boolean(options.isSimulator);

    this.aiProvider = getAIProvider();
    this.ttsProvider = getTTSProvider();
  }

  getGreeting() {
    const langStrings = MULTILINGUAL_STRINGS[this.language] || MULTILINGUAL_STRINGS.English;
    const greetingText = langStrings.greeting;
    this.stage = CONVERSATION_STAGES.EMERGENCY;
    this.transcript.push({
      role: 'assistant',
      text: greetingText,
      timestamp: new Date().toISOString()
    });
    return greetingText;
  }

  async processUtterance(callerUtterance, emergencyService = null) {
    if (!callerUtterance || !callerUtterance.trim()) {
      return { replyText: "I'm listening, please tell me what you need.", audioBuffer: null, stage: this.stage };
    }

    // 1. Record caller transcript
    this.transcript.push({
      role: 'caller',
      text: callerUtterance.trim(),
      timestamp: new Date().toISOString()
    });

    // 2. Query AI Provider
    const { reply, stage } = await this.aiProvider.processUtterance(this, callerUtterance);

    let finalReply = reply;

    // 3. Handle submission if caller confirmed
    if (reply === 'PROCESSING_SUBMISSION' || this.stage === CONVERSATION_STAGES.SUBMISSION) {
      this.stage = CONVERSATION_STAGES.SUBMISSION;
      const structured = await this.aiProvider.extractStructuredEmergency(this);
      
      // Safety validation before database insert
      const validation = validateEmergencyRequest({
        ...structured,
        caller_phone: this.callerPhone,
        caller_language: this.language,
        source: 'AI VOICE',
        created_from_call_id: this.id
      });

      if (!validation.valid) {
        console.warn('[ConversationManager] Emergency request validation failed:', validation.errors);
        this.stage = CONVERSATION_STAGES.CONFIRMATION;
        this.requestId = null;
        finalReply = "I am missing some required details to register your request. Please clarify your location and what help you need.";
      } else if (emergencyService) {
        try {
          const created = await emergencyService.createFromCall(this, validation.data);
          if (!created || !created.request_id) {
            throw new Error('Database insert did not return a valid request ID');
          }
          this.requestId = created.request_id;
          const langStrings = MULTILINGUAL_STRINGS[this.language] || MULTILINGUAL_STRINGS.English;
          finalReply = langStrings.recorded(this.requestId);
          this.stage = CONVERSATION_STAGES.COMPLETED;
          this.status = 'COMPLETED';
          this.endedAt = new Date().toISOString();
        } catch (err) {
          console.error('[ConversationManager] Real database insert failed:', err.message);
          this.requestId = null;
          this.status = 'FAILED';
          finalReply = "We encountered a system recording issue. Please stay on the line while we connect you with an emergency operator.";
        }
      } else {
        console.error('[ConversationManager] No emergencyService provided to persist real emergency request.');
        this.requestId = null;
        this.status = 'FAILED';
        finalReply = "We encountered a system recording issue. Please stay on the line while we connect you with an emergency operator.";
      }
    }

    // 4. Record assistant reply in transcript
    this.transcript.push({
      role: 'assistant',
      text: finalReply,
      timestamp: new Date().toISOString()
    });

    // 5. Synthesize speech for telephony transmission
    let audioBuffer = null;
    try {
      audioBuffer = await this.ttsProvider.synthesize(finalReply, { sampleRate: 8000 });
    } catch (err) {
      console.warn('[ConversationManager] Audio synthesis error:', err.message);
    }

    return {
      replyText: finalReply,
      audioBuffer,
      stage: this.stage,
      status: this.status,
      requestId: this.requestId,
      language: this.language
    };
  }
}

// Active session registry for in-flight calls
const activeSessions = new Map();

export const conversationRegistry = {
  createSession(options) {
    const session = new ConversationSession(options);
    activeSessions.set(session.id, session);
    activeSessions.set(session.callSid, session);
    if (session.streamSid) {
      activeSessions.set(session.streamSid, session);
    }
    return session;
  },

  getSession(sid) {
    return activeSessions.get(sid);
  },

  removeSession(sid) {
    const session = activeSessions.get(sid);
    if (session) {
      activeSessions.delete(session.id);
      activeSessions.delete(session.callSid);
      activeSessions.delete(session.streamSid);
    }
  },

  getAllActiveSessions() {
    // Unique sessions
    const unique = new Set(activeSessions.values());
    const now = Date.now();

    return Array.from(unique)
      .filter(s => {
        // Must be in-progress real telephony session
        if (s.status !== 'IN_PROGRESS') return false;
        if (s.isSimulator) return false;
        if (!s.isRealTelephony) return false;

        // Reject test callers / synthetic IDs
        if (s.callSid && (s.callSid.startsWith('test_') || s.callSid.startsWith('exo_test_'))) return false;
        if (['+919876543210', '+919944332211', '+919988776655'].includes(s.callerPhone)) return false;

        // Auto-clean stale sessions older than 20 minutes (1200 seconds)
        const ageSec = Math.floor((now - new Date(s.startedAt).getTime()) / 1000);
        if (ageSec > 1200) {
          activeSessions.delete(s.id);
          activeSessions.delete(s.callSid);
          if (s.streamSid) activeSessions.delete(s.streamSid);
          return false;
        }

        return true;
      })
      .map(s => ({
        id: s.id,
        callSid: s.callSid,
        streamSid: s.streamSid,
        callerPhone: s.callerPhone,
        language: s.language,
        stage: s.stage,
        status: s.status,
        startedAt: s.startedAt,
        durationSec: Math.floor((now - new Date(s.startedAt).getTime()) / 1000),
        requestId: s.requestId,
        lastUtterance: s.transcript[s.transcript.length - 1]?.text || ''
      }));
  }
};

