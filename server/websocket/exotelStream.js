import fs from 'node:fs';
import path from 'node:path';
import { conversationRegistry } from '../ai/conversationManager.js';
import { emergencyService } from '../services/emergencyService.js';
import { callService } from '../services/callService.js';
import { getSTTProvider } from '../ai/sttProvider.js';
import { eventBus } from './eventBus.js';
import { mulawToPcm16, pcm16ToMulaw, calculateRms, createWav } from '../utils/audioCodec.js';

export function handleExotelStream(ws, req) {
  const clientIp = req.socket?.remoteAddress || 'unknown';
  console.log(`[ExotelStream] New WebSocket connection from ${clientIp}`);

  let currentSession = null;
  let streamSid = null;
  let callSid = null;
  let isMuLaw = false;
  let sampleRate = 8000;

  // Complete call audio preservation for authoritative recording
  let allCallerAudioChunks = [];
  let exotelRecordingUrl = null;

  // Audio buffering and Voice Activity Detection (VAD) state
  let accumulatedPcmChunks = [];
  let speechFramesCount = 0;
  let silenceFramesCount = 0;
  let isSpeaking = false;
  let isProcessingUtterance = false;
  let echoMuteUntil = 0; // Timestamp to suppress echo while AI is speaking

  const VAD_RMS_THRESHOLD = parseInt(process.env.VAD_RMS_THRESHOLD || '350', 10);
  const SILENCE_FRAMES_TRIGGER = Math.floor(parseInt(process.env.VAD_SILENCE_MS || '350', 10) / 20); // ~350ms of silence for snappy turn-taking
  const MIN_SPEECH_FRAMES = 4; // ~80ms minimum speech
  const MAX_SPEECH_FRAMES = 350; // ~7 seconds max continuous speech frame limit

  const stt = getSTTProvider();

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
      const payloadBuffer = asMuLaw ? pcm16ToMulaw(audioBuffer) : audioBuffer;
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

      // Compute playback duration to suppress line echo while AI speaks (100ms grace padding)
      const durationMs = Math.ceil(payloadBuffer.length / (asMuLaw ? 8 : 16));
      echoMuteUntil = Date.now() + durationMs + 100;
      console.log(`[ExotelStream:Outbound] Dispatched ${payloadBuffer.length} bytes audio (${Math.round(durationMs)}ms) in ${FRAME_SIZE}-byte frames (echo mute until +100ms)`);

      // Mark event for Exotel playback synchronization
      sendEvent({
        event: 'mark',
        stream_sid: sid,
        mark: { name: `response_${Date.now()}` }
      });
    } catch (err) {
      console.error('[ExotelStream] Error sending audio chunks to Exotel:', err.message);
    }
  }

  // Process gathered speech accumulation through STT, AI dialogue, and TTS
  async function processAccumulatedSpeech() {
    if (accumulatedPcmChunks.length === 0 || isProcessingUtterance || !currentSession) return;
    isProcessingUtterance = true;
    isSpeaking = false;

    const fullPcm = Buffer.concat(accumulatedPcmChunks);
    accumulatedPcmChunks = [];
    speechFramesCount = 0;
    silenceFramesCount = 0;

    console.log(`[ExotelStream:VAD] Speech utterance complete. Full audio length: ${fullPcm.length} bytes (~${Math.round(fullPcm.length / 16)}ms)`);

    try {
      const wavBuffer = createWav(fullPcm, sampleRate, 1);
      const transcription = await stt.transcribe(wavBuffer, currentSession.language);

      if (transcription && transcription.trim()) {
        console.log(`[ExotelStream:STT] Transcribed: "${transcription}"`);

        const result = await currentSession.processUtterance(transcription, emergencyService);
        console.log(`[ExotelStream:AI] AI Reply: "${result.replyText.slice(0, 70)}..."`);

        // Stream AI response audio back to caller
        if (result.audioBuffer) {
          sendAudioInChunks(result.audioBuffer, streamSid, isMuLaw);
        }

        // Broadcast live progress to dashboard
        eventBus.broadcast('CALL_UPDATED', {
          id: currentSession.id,
          callSid,
          stage: currentSession.stage,
          status: currentSession.status,
          language: currentSession.language,
          lastUtterance: transcription,
          lastReply: result.replyText,
          requestId: result.requestId
        });

        // If call reached submission stage, finalize and persist
        if (result.status === 'COMPLETED') {
          await finalizeCall('conversation_completed');
        }
      }
    } catch (err) {
      console.error('[ExotelStream] Error processing speech utterance:', err.message);
    } finally {
      isProcessingUtterance = false;
    }
  }

  // Finalize call: safely persist original recording, transcript, and session to SQLite, then run async AI classification
  async function finalizeCall(reason = 'stop_event') {
    if (!currentSession || currentSession._isFinalized) return;
    currentSession._isFinalized = true;

    console.log(`[ExotelStream] Finalizing call call_sid=${callSid} (reason=${reason})`);
    currentSession.status = 'COMPLETED';
    currentSession.endedAt = new Date().toISOString();

    // Source IP of the telephony connection (Telephony Source IP, NOT caller IP)
    const telephonySourceIp = (clientIp && clientIp !== 'unknown') ? clientIp : 'Not available';
    currentSession.telephony_source_ip = telephonySourceIp;

    // 1. Preserve original voice recording
    let recordingRef = exotelRecordingUrl || currentSession.recording_url || null;
    if (!recordingRef && allCallerAudioChunks.length > 0) {
      try {
        const recordingsDir = path.resolve(process.cwd(), 'server', 'data', 'recordings');
        if (!fs.existsSync(recordingsDir)) {
          fs.mkdirSync(recordingsDir, { recursive: true });
        }
        const filename = `${callSid || currentSession.id}.wav`;
        const filepath = path.join(recordingsDir, filename);
        const fullAudio = Buffer.concat(allCallerAudioChunks);
        const wav = createWav(fullAudio, sampleRate, 1);
        fs.writeFileSync(filepath, wav);
        recordingRef = `/api/calls/${currentSession.id}/recording`;
        console.log(`[ExotelStream] Preserved original caller voice recording (${wav.length} bytes) at ${filepath}`);
      } catch (recErr) {
        console.warn('[ExotelStream] Failed to preserve local call audio recording:', recErr.message);
      }
    }
    currentSession.recording_url = recordingRef;
    currentSession.classification_status = 'pending';

    const durationSec = Math.floor((Date.now() - new Date(currentSession.startedAt).getTime()) / 1000);

    // Initial instant analysis to guarantee immediate availability in database and metadata
    const instantAnalysis = {
      caller_intent: currentSession.summary || currentSession.query || (currentSession.data?.category ? `Reported ${currentSession.data.category} emergency` : 'Emergency assistance request'),
      classification: currentSession.data?.category ? 'EMERGENCY' : 'NON_EMERGENCY',
      urgency: currentSession.data?.urgency || 'HIGH',
      entities: {
        category: currentSession.data?.category || 'other',
        location: currentSession.data?.location || 'Unspecified',
        landmark: currentSession.data?.landmark || '',
        affectedPeople: currentSession.data?.affectedPeople || 1,
        requirements: currentSession.data?.requirements || [],
        immediateDanger: Boolean(currentSession.data?.immediateDanger)
      },
      summary: currentSession.summary || currentSession.aiSummary || `Emergency call processed in ${currentSession.language}`,
      recommended_action: 'Dispatch emergency response team'
    };

    currentSession.metadata = {
      ...(currentSession.metadata || {}),
      analysis: currentSession.analysis || instantAnalysis,
      telephony_source_ip: telephonySourceIp,
      endedReason: reason,
      durationSec
    };

    // 2. Persist full call session & transcript safely to SQLite FIRST
    try {
      callService.saveCallSession(currentSession);
      console.log(`[ExotelStream] Saved completed call session to database: ${currentSession.id} (${currentSession.callSid})`);
    } catch (err) {
      console.error('[ExotelStream] Failed to save call session to SQLite:', err.message);
    }

    // Remove from in-flight memory registry
    conversationRegistry.removeSession(currentSession.callSid);
    conversationRegistry.removeSession(currentSession.id);
    if (currentSession.streamSid) conversationRegistry.removeSession(currentSession.streamSid);

    // Broadcast call completion event to dashboard
    eventBus.broadcast('CALL_ENDED', {
      id: currentSession.id,
      callSid,
      streamSid,
      callerPhone: currentSession.callerPhone,
      recordingUrl: currentSession.recording_url,
      requestId: currentSession.requestId || null,
      status: currentSession.status,
      durationSec,
      summary: currentSession.summary || currentSession.aiSummary || `Emergency call processed in ${currentSession.language}`,
      classification_status: 'pending'
    });

    // 3. Asynchronously run post-call Ollama analysis without blocking caller termination
    runPostCallAnalysis(currentSession, telephonySourceIp, reason, durationSec).catch((err) => {
      console.error('[ExotelStream] Background post-call analysis error:', err.message);
    });
  }

  async function runPostCallAnalysis(session, telephonySourceIp, reason, durationSec) {
    try {
      // Step A: Conversation analysis
      try {
        const analysis = await session.aiProvider.analyzeConversation(session);
        session.analysis = analysis;
        if (!session.aiSummary) {
          session.aiSummary = analysis.summary;
        }
      } catch (err) {
        console.warn('[ExotelStream] Post-call conversation analysis fallback:', err.message);
      }

      // Step B: AI Query Understanding & Department Classification from existing department taxonomy
      const classification = await session.aiProvider.classifyCallQuery(session);
      session.query = classification.query;
      session.summary = classification.summary;
      session.department = classification.department;
      session.required_service = classification.required_service;
      session.required_resources = classification.required_resources;
      session.priority = classification.priority;
      session.location = classification.location;
      session.affected_people = classification.affected_people;
      session.classification_confidence = classification.confidence;
      session.classification_status = 'completed';

      session.metadata = {
        ...(session.metadata || {}),
        analysis: session.analysis,
        classification,
        telephony_source_ip: telephonySourceIp,
        endedReason: reason,
        durationSec
      };

      // Persist updated classification to SQLite
      callService.saveCallSession(session);
      console.log(`[ExotelStream] Post-call AI analysis stored: department="${session.department}", confidence=${session.classification_confidence}`);

      // Broadcast classification update to dashboard
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
      console.error('[ExotelStream] Post-call classification error:', err.message);
      session.classification_status = 'failed';
      try {
        callService.saveCallSession(session);
      } catch (saveErr) {
        console.error('[ExotelStream] Error updating classification failure status:', saveErr.message);
      }
    }
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

          // Create or retrieve session in registry (strictly marked as real telephony)
          currentSession = conversationRegistry.createSession({
            callSid,
            streamSid,
            callerPhone,
            exotelNumber,
            language: message.custom_parameters?.language || 'English',
            isRealTelephony: true,
            isSimulator: false
          });

          // Broadcast active call to dashboard
          eventBus.broadcast('CALL_STARTED', {
            id: currentSession.id,
            callSid,
            streamSid,
            callerPhone,
            language: currentSession.language,
            stage: currentSession.stage
          });

          // Deliver initial greeting
          const greetingText = currentSession.getGreeting();
          try {
            const greetingAudio = await currentSession.ttsProvider.synthesize(greetingText, {
              sampleRate
            });

            sendAudioInChunks(greetingAudio, streamSid, isMuLaw);
            sendEvent({
              event: 'mark',
              stream_sid: streamSid,
              mark: { name: 'greeting_dispatched' }
            });
          } catch (greetErr) {
            console.warn('[ExotelStream] Failed to synthesize initial greeting audio:', greetErr.message);
          }
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
            // Accumulate continuous caller audio for authoritative recording preservation without gaps
            allCallerAudioChunks.push(pcmChunk);

            // Suppress inbound speech processing while AI voice is being delivered to avoid self-echo loop
            if (Date.now() < echoMuteUntil) {
              accumulatedPcmChunks = [];
              speechFramesCount = 0;
              silenceFramesCount = 0;
              isSpeaking = false;
              break;
            }

            const rms = calculateRms(pcmChunk);

            if (rms > VAD_RMS_THRESHOLD) {
              isSpeaking = true;
              speechFramesCount++;
              silenceFramesCount = 0;
              accumulatedPcmChunks.push(pcmChunk);

              if (speechFramesCount >= MAX_SPEECH_FRAMES && !isProcessingUtterance) {
                await processAccumulatedSpeech();
              }
            } else {
              if (isSpeaking) {
                silenceFramesCount++;
                accumulatedPcmChunks.push(pcmChunk);

                if (silenceFramesCount >= SILENCE_FRAMES_TRIGGER && speechFramesCount >= MIN_SPEECH_FRAMES && !isProcessingUtterance) {
                  await processAccumulatedSpeech();
                }
              }
            }
          } catch (mediaErr) {
            console.warn('[ExotelStream] Error processing media chunk:', mediaErr.message);
          }
          break;
        }

        case 'simulate_text': {
          // Strictly disabled for external telephony calls. Permitted for test environments and test streams.
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
              language: message.language || 'English',
              isRealTelephony: false,
              isSimulator: true
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
            await finalizeCall('test_completed');
          }
          break;
        }

        case 'stop': {
          console.log(`[ExotelStream] STOP event for call_sid=${callSid}`);
          if (message.recording_url || message.stop?.recording_url || message.RecordingUrl) {
            exotelRecordingUrl = message.recording_url || message.stop?.recording_url || message.RecordingUrl;
          }
          // Flush any pending speech buffer before closing
          if (accumulatedPcmChunks.length > 0 && speechFramesCount >= MIN_SPEECH_FRAMES) {
            await processAccumulatedSpeech();
          }
          await finalizeCall('stop_event');
          break;
        }

        case 'mark': {
          // Acknowledged mark event from Exotel indicating playback has finished on caller handset
          echoMuteUntil = Date.now();
          break;
        }

        default:
          console.log(`[ExotelStream] Unhandled event type: ${eventType}`);
      }
    } catch (err) {
      console.error('[ExotelStream] Unexpected error in WebSocket message handler:', err.message);
    }
  });

  ws.on('close', async () => {
    console.log(`[ExotelStream] WebSocket closed for call_sid=${callSid}`);
    if (currentSession && !currentSession._isFinalized) {
      await finalizeCall('client_disconnect');
    }
  });

  ws.on('error', (err) => {
    console.error(`[ExotelStream] WebSocket socket error:`, err.message);
  });
}
