import fs from 'node:fs';
import path from 'node:path';
import { conversationRegistry } from '../ai/conversationManager.js';
import { emergencyService } from '../services/emergencyService.js';
import { callService } from '../services/callService.js';
import { getSTTProvider } from '../ai/sttProvider.js';
import { getTTSProvider } from '../ai/ttsProvider.js';
import { eventBus } from './eventBus.js';
import { mulawToPcm16, pcm16ToMulaw, calculateRms, createWav } from '../utils/audioCodec.js';

// Exact greeting message required by Resource AI
export const GREETING_TEXT = "Hi, I’m Resource AI. Tell me your query.";
export const CLOSING_TEXT = "Thank you. Your query has been recorded. Goodbye.";

// Memory pre-warming for zero-latency greeting playback (sub-millisecond start)
let prewarmedGreetingPcm8k = null;
let prewarmedGreetingMulaw8k = null;
let prewarmedClosingPcm8k = null;
let prewarmedClosingMulaw8k = null;
let isPrewarming = false;

export async function prewarmAudioBuffers() {
  if (prewarmedGreetingPcm8k && prewarmedGreetingMulaw8k) {
    return { greetingPcm: prewarmedGreetingPcm8k, greetingMulaw: prewarmedGreetingMulaw8k };
  }
  if (isPrewarming) return null;
  isPrewarming = true;

  try {
    const tts = getTTSProvider();
    if (tts) {
      const greetingPcm = await tts.synthesize(GREETING_TEXT, { sampleRate: 8000 });
      if (greetingPcm && greetingPcm.length > 0) {
        prewarmedGreetingPcm8k = greetingPcm;
        prewarmedGreetingMulaw8k = pcm16ToMulaw(greetingPcm);
        console.log(`[ExotelStream:Prewarm] Greeting audio pre-warmed: ${greetingPcm.length} bytes PCM, ${prewarmedGreetingMulaw8k.length} bytes Mu-Law`);
      }

      const closingPcm = await tts.synthesize(CLOSING_TEXT, { sampleRate: 8000 });
      if (closingPcm && closingPcm.length > 0) {
        prewarmedClosingPcm8k = closingPcm;
        prewarmedClosingMulaw8k = pcm16ToMulaw(closingPcm);
        console.log(`[ExotelStream:Prewarm] Closing audio pre-warmed: ${closingPcm.length} bytes PCM, ${prewarmedClosingMulaw8k.length} bytes Mu-Law`);
      }
    }
  } catch (err) {
    console.warn('[ExotelStream:Prewarm] Audio pre-warming notice:', err.message);
  } finally {
    isPrewarming = false;
  }

  return { greetingPcm: prewarmedGreetingPcm8k, greetingMulaw: prewarmedGreetingMulaw8k };
}

// Pre-warm immediately on module load
prewarmAudioBuffers().catch(() => {});

// Helper to transcribe with automatic retries for background job reliability
async function transcribeWithRetry(sttProvider, wavBuffer, language, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    try {
      const text = await sttProvider.transcribe(wavBuffer, language);
      if (typeof text === 'string') {
        return text;
      }
      return '';
    } catch (err) {
      console.warn(`[PostCallJob] STT attempt ${attempt}/${maxRetries + 1} error:`, err.message);
      if (attempt > maxRetries) break;
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  return '';
}

// Asynchronous background job for post-call processing (Transcription -> Understanding -> Classification -> DB -> Dashboard)
async function enqueuePostCallJob({
  session,
  audioChunks,
  sampleRate,
  exotelRecordingUrl,
  clientIp,
  reason
}) {
  const stt = getSTTProvider();
  const telephonySourceIp = (clientIp && clientIp !== 'unknown') ? clientIp : 'Not available';
  session.telephony_source_ip = telephonySourceIp;
  const durationSec = Math.max(1, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));

  // 1. Preserve original voice recording
  let recordingRef = exotelRecordingUrl || session.recording_url || null;
  if (audioChunks && audioChunks.length > 0) {
    try {
      const recordingsDir = path.resolve(process.cwd(), 'server', 'data', 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      const fullAudio = Buffer.concat(audioChunks);
      const wav = createWav(fullAudio, sampleRate, 1);

      const fileId = path.join(recordingsDir, `${session.id}.wav`);
      const fileSid = path.join(recordingsDir, `${session.callSid}.wav`);
      fs.writeFileSync(fileId, wav);
      if (session.callSid && session.callSid !== session.id) {
        fs.writeFileSync(fileSid, wav);
      }
      recordingRef = `/api/calls/${session.id}/recording`;
      console.log(`[PostCallJob] Preserved original caller voice recording (${wav.length} bytes, ~${Math.round(wav.length / 16000)}s) at ${fileId}`);
    } catch (recErr) {
      console.warn('[PostCallJob] Failed to save local audio recording:', recErr.message);
    }
  }
  session.recording_url = recordingRef;
  session.classification_status = 'pending';

  // 2. Initial instant analysis to guarantee immediate availability in database and metadata
  const instantAnalysis = {
    caller_intent: session.summary || session.query || (session.data?.category ? `Reported ${session.data.category} query` : 'Citizen query recorded'),
    classification: session.data?.category ? 'EMERGENCY' : 'NON_EMERGENCY',
    urgency: session.data?.urgency || 'HIGH',
    entities: {
      category: session.data?.category || 'other',
      location: session.data?.location || 'Unspecified',
      landmark: session.data?.landmark || '',
      affectedPeople: session.data?.affectedPeople || 1,
      requirements: session.data?.requirements || [],
      immediateDanger: Boolean(session.data?.immediateDanger)
    },
    summary: session.summary || session.aiSummary || `Resource AI call processed in ${session.language}`,
    recommended_action: 'Process citizen request for relief or department action'
  };

  session.metadata = {
    ...(session.metadata || {}),
    analysis: session.analysis || instantAnalysis,
    telephony_source_ip: telephonySourceIp,
    endedReason: reason,
    durationSec,
    recording_started_at: session.recordingStartedAt || session.startedAt
  };

  // 3. Persist call session safely to SQLite FIRST
  try {
    callService.saveCallSession(session);
    console.log(`[PostCallJob] Saved initial call session to database: ${session.id} (${session.callSid})`);
  } catch (err) {
    console.error('[PostCallJob] Failed to save call session to SQLite:', err.message);
  }

  // 4. Broadcast call completion event to dashboard
  eventBus.broadcast('CALL_ENDED', {
    id: session.id,
    callSid: session.callSid,
    streamSid: session.streamSid,
    callerPhone: session.callerPhone,
    recordingUrl: session.recording_url,
    requestId: session.requestId || null,
    status: session.status,
    durationSec,
    summary: session.summary || session.aiSummary || `Resource AI call processed in ${session.language}`,
    classification_status: 'pending'
  });

  // 5. Asynchronously transcribe original recording with automatic retry
  try {
    const recordingsDir = path.resolve(process.cwd(), 'server', 'data', 'recordings');
    const wavCandidates = [
      path.join(recordingsDir, `${session.id}.wav`),
      path.join(recordingsDir, `${session.callSid}.wav`)
    ];

    let audioTranscript = '';
    for (const cand of wavCandidates) {
      if (fs.existsSync(cand)) {
        try {
          const wavData = fs.readFileSync(cand);
          if (wavData.length > 44) {
            console.log(`[PostCallJob] Transcribing original caller recording (${wavData.length} bytes)...`);
            audioTranscript = await transcribeWithRetry(stt, wavData, session.language, 2);
            if (audioTranscript && audioTranscript.trim()) {
              console.log(`[PostCallJob] Transcribed audio: "${audioTranscript.trim()}"`);
              const hasCallerTurn = session.transcript.some(t => t.role === 'caller' && t.text && t.text.trim());
              if (!hasCallerTurn || !session.query) {
                session.transcript.push({
                  role: 'caller',
                  text: audioTranscript.trim(),
                  timestamp: new Date().toISOString()
                });
                session.query = audioTranscript.trim();
              }
            }
          }
        } catch (sttErr) {
          console.warn('[PostCallJob] Recording transcription notice:', sttErr.message);
        }
        break;
      }
    }

    // 6. Conversation analysis
    try {
      const analysis = await session.aiProvider.analyzeConversation(session);
      session.analysis = analysis;
      if (!session.aiSummary) {
        session.aiSummary = analysis.summary;
      }
    } catch (err) {
      console.warn('[PostCallJob] Post-call conversation analysis fallback:', err.message);
    }

    // 7. AI Query Understanding & Department Classification from 12-department taxonomy
    const classification = await session.aiProvider.classifyCallQuery(session);
    session.query = classification.query || session.query || 'Citizen query recorded';
    session.summary = classification.summary || session.summary || 'Municipal service request';
    session.department = classification.department || 'Other / Unclassified';
    session.required_service = classification.required_service || '';
    session.required_resources = classification.required_resources || [];
    session.priority = classification.priority || 'Medium';
    session.location = classification.location || 'Not mentioned';
    session.affected_people = classification.affected_people || 'Not mentioned';
    session.classification_confidence = classification.confidence || 0.85;
    session.classification_status = 'completed';

    session.metadata = {
      ...(session.metadata || {}),
      analysis: session.analysis,
      classification,
      telephony_source_ip: telephonySourceIp,
      endedReason: reason,
      durationSec,
      recording_started_at: session.recordingStartedAt || session.startedAt
    };

    // Update SQLite database with complete classification and metadata
    callService.saveCallSession(session);
    console.log(`[PostCallJob] Post-call classification complete: department="${session.department}", priority="${session.priority}", confidence=${session.classification_confidence}`);

    // 8. Broadcast classification update to update department dashboard in real time
    eventBus.broadcast('CALL_POST_ANALYZED', {
      id: session.id,
      callSid: session.callSid,
      department: session.department,
      summary: session.summary,
      priority: session.priority,
      required_resources: session.required_resources,
      classification_status: 'completed',
      classification: {
        query: session.query,
        summary: session.summary,
        department: session.department,
        required_service: session.required_service,
        required_resources: session.required_resources,
        priority: session.priority,
        location: session.location,
        affected_people: session.affected_people,
        confidence: session.classification_confidence
      }
    });
  } catch (err) {
    console.error('[PostCallJob] Post-call classification error:', err.message);
    session.classification_status = 'failed';
    try {
      callService.saveCallSession(session);
    } catch (saveErr) {
      console.error('[PostCallJob] Error updating classification failure status:', saveErr.message);
    }
  }
}

export function handleExotelStream(ws, req) {
  const clientIp = req.socket?.remoteAddress || 'unknown';
  console.log(`[ExotelStream] New incoming telephony connection from ${clientIp}`);

  let currentSession = null;
  let streamSid = null;
  let callSid = null;
  let isMuLaw = false;
  let sampleRate = 8000;

  // Complete call audio capture for authoritative original recording
  let allCallerAudioChunks = [];
  let exotelRecordingUrl = null;
  let isRecordingActive = false;
  let recordingStartedAt = null;
  let recordingTimeoutHandle = null;

  // Voice activity tracking
  let hasCallerSpoken = false;
  let lastSpeechTimestamp = 0;
  let silenceCheckTimer = null;
  let echoMuteUntil = 0; // Timestamp to suppress echo while greeting is being sent

  const VAD_RMS_THRESHOLD = parseInt(process.env.VAD_RMS_THRESHOLD || '250', 10);

  // Helper to send a JSON event object to Exotel safely
  function sendEvent(eventObj) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(eventObj));
      } catch (err) {
        console.warn('[ExotelStream] Failed to send JSON event:', err.message);
      }
    }
  }

  // Helper to send synthesized audio back to Exotel in 20ms frames
  function sendAudioInChunks(audioBuffer, sid, asMuLaw = false) {
    if (!audioBuffer || !sid || ws.readyState !== ws.OPEN) return;

    try {
      const payloadBuffer = asMuLaw ? (prewarmedGreetingMulaw8k && audioBuffer === prewarmedGreetingPcm8k ? prewarmedGreetingMulaw8k : pcm16ToMulaw(audioBuffer)) : audioBuffer;
      // Frame size: 160 bytes for 8kHz mu-law (20ms), 320 bytes for 8kHz 16-bit PCM (20ms)
      const FRAME_SIZE = asMuLaw ? 160 : 320;

      for (let offset = 0; offset < payloadBuffer.length; offset += FRAME_SIZE) {
        const chunk = payloadBuffer.subarray(offset, Math.min(offset + FRAME_SIZE, payloadBuffer.length));
        sendEvent({
          event: 'media',
          stream_sid: sid,
          media: {
            payload: chunk.toString('base64')
          }
        });
      }

      // Compute playback duration to suppress line echo while audio plays
      const durationMs = Math.ceil(payloadBuffer.length / (asMuLaw ? 8 : 16));
      echoMuteUntil = Date.now() + durationMs + 80;
      console.log(`[ExotelStream:Outbound] Dispatched ${payloadBuffer.length} bytes audio (~${Math.round(durationMs)}ms) in ${FRAME_SIZE}-byte frames`);

      return durationMs;
    } catch (err) {
      console.error('[ExotelStream] Error sending audio chunks to Exotel:', err.message);
      return 0;
    }
  }

  // Finalize call: release caller line immediately (0ms delay), then process in background
  function finalizeCall(reason = 'stop_event') {
    if (silenceCheckTimer) {
      clearInterval(silenceCheckTimer);
      silenceCheckTimer = null;
    }
    if (recordingTimeoutHandle) {
      clearTimeout(recordingTimeoutHandle);
      recordingTimeoutHandle = null;
    }

    if (!currentSession || currentSession._isFinalized) return;
    currentSession._isFinalized = true;

    console.log(`[ExotelStream] Finalizing call call_sid=${callSid} (reason=${reason})`);
    currentSession.status = 'COMPLETED';
    currentSession.endedAt = new Date().toISOString();

    // Release from in-memory active registry immediately
    conversationRegistry.removeSession(currentSession.callSid);

    // Release telephony line immediately so caller does not wait
    if (ws.readyState === ws.OPEN) {
      try {
        ws.close(1000, 'Call completed');
      } catch {}
    }

    // Capture state snapshot for asynchronous background processing
    const sessionToProcess = currentSession;
    const audioChunksSnapshot = allCallerAudioChunks;
    const recordingUrlSnapshot = exotelRecordingUrl;
    const rateSnapshot = sampleRate;
    const clientIpSnapshot = clientIp;
    const endedReason = reason;

    // Dispatch background job asynchronously without blocking caller termination
    setImmediate(() => {
      enqueuePostCallJob({
        session: sessionToProcess,
        audioChunks: audioChunksSnapshot,
        sampleRate: rateSnapshot,
        exotelRecordingUrl: recordingUrlSnapshot,
        clientIp: clientIpSnapshot,
        reason: endedReason
      }).catch((err) => {
        console.error('[ExotelStream] Background post-call job uncaught error:', err.message);
      });
    });
  }

  ws.on('message', async (data) => {
    try {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (parseErr) {
        console.warn('[ExotelStream] Ignored malformed non-JSON WebSocket frame');
        return;
      }

      if (!message || typeof message !== 'object') {
        console.warn('[ExotelStream] Ignored non-object WebSocket frame');
        return;
      }

      const eventType = message.event;

      switch (eventType) {
        case 'connected':
          console.log('[ExotelStream] Received connected handshake from Exotel AgentStream');
          break;

        case 'start': {
          streamSid = message.stream_sid || message.start?.stream_sid || message.streamSid;
          callSid = message.call_sid || message.start?.call_sid || message.callSid || streamSid;
          const callerPhone = message.from || message.start?.from || message.custom_parameters?.caller || null;
          const exotelNumber = message.to || message.start?.to || process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_PHONE_NUMBER || '+914447615477';
          const mediaFormat = message.media_format || message.start?.media_format || {};
          exotelRecordingUrl = message.recording_url || message.start?.recording_url || null;

          // Detect audio encoding
          const encoding = (mediaFormat.encoding || process.env.EXOTEL_AUDIO_CODEC || 'audio/l16').toLowerCase();
          isMuLaw = encoding.includes('mulaw') || encoding.includes('ulaw');
          sampleRate = parseInt(mediaFormat.sample_rate || process.env.EXOTEL_SAMPLE_RATE || '8000', 10);

          console.log(`[ExotelStream] START call_sid=${callSid}, stream_sid=${streamSid}, from=${callerPhone || 'Unknown'}, format=${encoding}, rate=${sampleRate}Hz`);

          // 1. Instant Call Connection: create session immediately
          currentSession = conversationRegistry.createSession({
            callSid,
            streamSid,
            callerPhone,
            exotelNumber,
            language: message.custom_parameters?.language || 'English'
          });

          // Non-blocking real-time broadcast to dashboard
          eventBus.broadcast('CALL_STARTED', {
            id: currentSession.id,
            callSid,
            streamSid,
            callerPhone,
            language: currentSession.language,
            stage: currentSession.stage
          });

          // Reset recording state: caller must hear complete greeting before recording begins
          isRecordingActive = false;
          recordingStartedAt = null;
          allCallerAudioChunks = [];
          hasCallerSpoken = false;

          // 2. Immediate Greeting: Play exact message: “Hi, I’m Resource AI. Tell me your query.”
          currentSession.transcript.push({
            role: 'assistant',
            text: GREETING_TEXT,
            timestamp: new Date().toISOString()
          });

          // Retrieve pre-warmed audio buffer (0ms latency)
          let greetingAudio = isMuLaw ? prewarmedGreetingMulaw8k : prewarmedGreetingPcm8k;
          if (!greetingAudio) {
            try {
              const tts = getTTSProvider();
              greetingAudio = await tts.synthesize(GREETING_TEXT, { sampleRate });
              if (isMuLaw) greetingAudio = pcm16ToMulaw(greetingAudio);
            } catch (synthErr) {
              console.warn('[ExotelStream] Live greeting synthesis fallback:', synthErr.message);
            }
          }

          if (greetingAudio && greetingAudio.length > 0) {
            const durationMs = sendAudioInChunks(greetingAudio, streamSid, isMuLaw);
            echoMuteUntil = Date.now() + durationMs + 80;
            console.log(`[ExotelStream:Greeting] Delivering greeting message in 0ms: "${GREETING_TEXT}" (~${Math.round(durationMs)}ms)`);

            // Send mark for synchronized Exotel playback tracking
            sendEvent({
              event: 'mark',
              stream_sid: streamSid,
              mark: { name: 'greeting_complete' }
            });

            // 3. Recording: After greeting finishes, start recording immediately.
            recordingTimeoutHandle = setTimeout(() => {
              if (!isRecordingActive && currentSession && !currentSession._isFinalized) {
                isRecordingActive = true;
                recordingStartedAt = new Date().toISOString();
                currentSession.recordingStartedAt = recordingStartedAt;
                console.log(`[ExotelStream:Recording] >>> GREETING FINISHED. AUTOMATIC RECORDING STARTED FOR CALL ${callSid} <<<`);
              }
            }, durationMs + 80);
          } else {
            // Immediate fallback to recording if no audio synthesized
            isRecordingActive = true;
            recordingStartedAt = new Date().toISOString();
            currentSession.recordingStartedAt = recordingStartedAt;
          }

          // Inactivity monitor: if caller finishes speaking and remains silent for >8s, conclude gracefully
          silenceCheckTimer = setInterval(() => {
            if (!currentSession || currentSession._isFinalized || !isRecordingActive) return;
            const now = Date.now();
            if (hasCallerSpoken && (now - lastSpeechTimestamp > 8000)) {
              console.log(`[ExotelStream] Caller finished query and has been silent for >8s. Concluding call.`);
              finalizeCall('silence_after_speech');
            }
          }, 1000);

          break;
        }

        case 'media': {
          if (!currentSession) break;

          const mediaPayload = message.media?.payload;
          if (!mediaPayload) break;

          try {
            const rawChunk = Buffer.from(mediaPayload, 'base64');
            if (rawChunk.length === 0) break;

            const pcmChunk = isMuLaw ? mulawToPcm16(rawChunk) : rawChunk;

            // Sequence Rule: Do NOT record while greeting is playing to caller
            if (!isRecordingActive) {
              break;
            }

            // Suppress echo while audio is playing
            if (Date.now() < echoMuteUntil) {
              break;
            }

            // Capture caller's complete voice conversation until call ends!
            allCallerAudioChunks.push(pcmChunk);

            // Track caller speech activity (non-blocking)
            const rms = calculateRms(pcmChunk);
            if (rms > VAD_RMS_THRESHOLD) {
              hasCallerSpoken = true;
              lastSpeechTimestamp = Date.now();
            }
          } catch (mediaErr) {
            console.warn('[ExotelStream] Error processing media chunk:', mediaErr.message);
          }
          break;
        }

        case 'mark': {
          // Acknowledged mark event from Exotel indicating playback has finished on caller handset
          echoMuteUntil = Date.now();
          const markName = message.mark?.name;
          if (markName === 'greeting_complete' || !isRecordingActive) {
            if (recordingTimeoutHandle) {
              clearTimeout(recordingTimeoutHandle);
              recordingTimeoutHandle = null;
            }
            if (!isRecordingActive) {
              isRecordingActive = true;
              recordingStartedAt = new Date().toISOString();
              if (currentSession) currentSession.recordingStartedAt = recordingStartedAt;
              console.log(`[ExotelStream:Recording] >>> GREETING CONFIRMED PLAYED ON HANDSET. RECORDING STARTED FOR CALL ${callSid} <<<`);
            }
          }
          break;
        }

        case 'simulate_text': {
          // Strictly disabled for external telephony calls. Permitted for test environments only.
          const isTestCall = (message.stream_sid && message.stream_sid.startsWith('test_')) || 
                             (currentSession && currentSession.streamSid && currentSession.streamSid.startsWith('test_')) ||
                             process.env.NODE_ENV === 'test';
          if (!isTestCall) {
            console.warn('[ExotelStream] simulate_text is disabled for real telephony calls.');
            sendEvent({
              event: 'error',
              message: 'Simulation disabled in production mode'
            });
            break;
          }

          if (!currentSession && message.stream_sid) {
            currentSession = conversationRegistry.getSession(message.stream_sid);
          }
          if (!currentSession) {
            currentSession = conversationRegistry.createSession({
              callSid: `test_call_${Date.now()}`,
              streamSid: message.stream_sid || `test_str_${Date.now()}`,
              callerPhone: message.from || null,
              language: message.language || 'English'
            });
            streamSid = currentSession.streamSid;
            callSid = currentSession.callSid;
          }

          const callerText = message.text || '';
          const result = await currentSession.processUtterance(callerText, emergencyService);

          if (result.audioBuffer) {
            sendAudioInChunks(result.audioBuffer, streamSid, isMuLaw);
          }

          sendEvent({
            event: 'test_response',
            stream_sid: streamSid,
            replyText: result.replyText,
            stage: result.stage,
            status: result.status,
            language: result.language,
            requestId: result.requestId,
            hasAudio: Boolean(result.audioBuffer)
          });

          if (result.status === 'COMPLETED') {
            finalizeCall('test_completed');
          }
          break;
        }

        case 'stop': {
          console.log(`[ExotelStream] STOP event received for call_sid=${callSid}`);
          if (message.recording_url || message.stop?.recording_url || message.RecordingUrl) {
            exotelRecordingUrl = message.recording_url || message.stop?.recording_url || message.RecordingUrl;
          }
          finalizeCall('stop_event');
          break;
        }

        default:
          console.log(`[ExotelStream] Unhandled event type: ${eventType}`);
      }
    } catch (err) {
      console.error('[ExotelStream] Unexpected error in WebSocket message handler:', err.message);
    }
  });

  ws.on('close', () => {
    console.log(`[ExotelStream] WebSocket closed for call_sid=${callSid}`);
    if (currentSession && !currentSession._isFinalized) {
      finalizeCall('client_disconnect');
    }
  });

  ws.on('error', (err) => {
    console.error(`[ExotelStream] WebSocket socket error:`, err.message);
  });
}
