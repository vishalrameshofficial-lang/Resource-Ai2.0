import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';

import { mulawToPcm16, pcm16ToMulaw, calculateRms, createWav, resamplePcm24kTo8k } from '../server/utils/audioCodec.js';
import { getAIProvider } from '../server/ai/aiProvider.js';
import { getTTSProvider, OpenAITTSProvider } from '../server/ai/ttsProvider.js';
import { getSTTProvider, OpenAISTTProvider } from '../server/ai/sttProvider.js';
import { callService } from '../server/services/callService.js';
import { exotelService } from '../server/services/exotelService.js';

test('Audio Codec - G.711 Mu-Law and PCM Conversions', () => {
  // 1. Generate 16-bit PCM test buffer (100 samples)
  const pcmIn = Buffer.alloc(200);
  for (let i = 0; i < 100; i++) {
    const val = Math.floor(Math.sin((i / 100) * Math.PI * 2) * 15000);
    pcmIn.writeInt16LE(val, i * 2);
  }

  // 2. Convert PCM to mu-law
  const muLaw = pcm16ToMulaw(pcmIn);
  assert.equal(muLaw.length, 100);

  // 3. Convert mu-law back to PCM
  const pcmOut = mulawToPcm16(muLaw);
  assert.equal(pcmOut.length, 200);

  // 4. Verify RMS calculation
  const rms = calculateRms(pcmIn);
  assert.ok(rms > 5000, `Expected RMS > 5000, got ${rms}`);

  const silentPcm = Buffer.alloc(200, 0);
  const silenceRms = calculateRms(silentPcm);
  assert.equal(silenceRms, 0);
});

test('Audio Codec - WAV Header Generation', () => {
  const pcm = Buffer.alloc(1600); // 100ms at 8000Hz 16-bit
  const wav = createWav(pcm, 8000, 1);

  assert.equal(wav.length, 1600 + 44);
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.subarray(12, 16).toString(), 'fmt ');
  assert.equal(wav.subarray(36, 40).toString(), 'data');
  assert.equal(wav.readUInt32LE(24), 8000); // sampleRate
});

test('Audio Codec - 24kHz to 8kHz Resampling for OpenAI TTS -> Exotel Voicebot', () => {
  // 1. Generate 24kHz test buffer: 2400 samples (100ms) = 4800 bytes
  const pcm24k = Buffer.alloc(4800);
  for (let i = 0; i < 2400; i++) {
    const val = Math.floor(Math.sin((i / 2400) * Math.PI * 8) * 16000);
    pcm24k.writeInt16LE(val, i * 2);
  }

  // 2. Resample 24k -> 8k (3:1 ratio)
  const pcm8k = resamplePcm24kTo8k(pcm24k);

  // Output must be exactly 800 samples = 1600 bytes
  assert.equal(pcm8k.length, 1600);

  // Verify non-zero energy
  const rms = calculateRms(pcm8k);
  assert.ok(rms > 2000, `Expected RMS > 2000, got ${rms}`);
});

test('Speech Providers - OpenAI Architecture and Factory Methods', () => {
  const dummyKey = 'sk-test-dummy-key-for-unit-testing';
  const openAiTts = new OpenAITTSProvider(dummyKey);
  const openAiStt = new OpenAISTTProvider(dummyKey);

  assert.ok(openAiTts.getCapabilities().supportedSampleRates.includes(8000));
  assert.ok(openAiStt.isLanguageSupported('English'));
  assert.ok(openAiStt.isLanguageSupported('Hindi'));
  assert.ok(openAiStt.isLanguageSupported('Tamil'));
});

test('Conversation Analysis - Detailed Post-Call Assessment', async () => {
  const ai = getAIProvider();
  const mockSession = {
    id: 'test-sess-analysis',
    callSid: 'test-call-analysis',
    callerPhone: '+919876543210',
    language: 'English',
    data: {
      category: 'flood',
      location: 'Near Kurukkuthoorai Temple, Tirunelveli',
      affectedPeople: 30,
      requirements: [
        { item: 'Food & Meals', quantity: 30, unit: 'packets' },
        { item: 'Drinking Water', quantity: 60, unit: 'litres' }
      ],
      urgency: 'CRITICAL',
      immediateDanger: true
    },
    transcript: [
      { role: 'assistant', text: 'ResourceAI Emergency Assistance. Please state your emergency.' },
      { role: 'caller', text: 'Water is rising rapidly near Kurukkuthoorai Temple and 30 people are trapped.' }
    ]
  };

  const analysis = await ai.analyzeConversation(mockSession);

  assert.ok(analysis.caller_intent);
  assert.equal(analysis.classification, 'EMERGENCY');
  assert.ok(['HIGH', 'CRITICAL'].includes(analysis.urgency));
  assert.ok(analysis.entities);
  assert.equal(analysis.entities.category, 'flood');
  assert.ok(analysis.summary);
  assert.ok(analysis.recommended_action);
});

test('Public Host Configuration - Configurable WSS Endpoint', () => {
  const originalHost = process.env.PUBLIC_HOST;
  try {
    process.env.PUBLIC_HOST = 'resourceai-test.ngrok-free.app';
    const status = exotelService.getStatus();
    assert.equal(status.publicWssUrl, 'wss://resourceai-test.ngrok-free.app/api/voice/exotel/stream');
  } finally {
    if (originalHost !== undefined) {
      process.env.PUBLIC_HOST = originalHost;
    } else {
      delete process.env.PUBLIC_HOST;
    }
  }
});

test('Exotel AgentStream WebSocket - Complete Call Lifecycle & Database Persistence', async () => {
  const wsUrl = 'ws://localhost:5055/api/voice/exotel/stream';
  const testCallSid = `test_exo_call_${Date.now()}`;
  const testStreamSid = `test_exo_str_${Date.now()}`;

  const ws = new WebSocket(wsUrl);

  const receivedEvents = [];

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      receivedEvents.push(msg);
    } catch (e) {}
  });

  // 1. Send Exotel 'connected' event
  ws.send(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }));

  // 2. Send Exotel 'start' event
  ws.send(JSON.stringify({
    event: 'start',
    stream_sid: testStreamSid,
    call_sid: testCallSid,
    from: '+919988776655',
    to: '+914447615477',
    media_format: {
      encoding: 'audio/x-mulaw',
      sample_rate: 8000,
      channels: 1
    },
    custom_parameters: {
      language: 'English'
    }
  }));

  // Wait for initial greeting media chunks and mark
  await new Promise((r) => setTimeout(r, 600));

  // If speech provider succeeds (or mock), verify media chunks and mark
  const hasMedia = receivedEvents.some(e => e.event === 'media' && e.stream_sid === testStreamSid);
  const hasMark = receivedEvents.some(e => e.event === 'mark' && e.stream_sid === testStreamSid);
  if (hasMedia) {
    assert.ok(hasMark, 'Expected greeting mark event sent to Exotel');
  }

  // 3. Send text simulation turn to simulate speech interaction
  ws.send(JSON.stringify({
    event: 'simulate_text',
    stream_sid: testStreamSid,
    text: 'There is severe flooding near Tirunelveli railway station and 25 people need food and water'
  }));

  await new Promise((r) => setTimeout(r, 600));

  // 4. Send Exotel 'stop' event to conclude call
  ws.send(JSON.stringify({
    event: 'stop',
    stream_sid: testStreamSid,
    call_sid: testCallSid
  }));

  await new Promise((r) => setTimeout(r, 800));
  ws.close();

  // 5. Verify call session was persisted in SQLite database
  let savedCall = null;
  for (let i = 0; i < 50; i++) {
    savedCall = callService.getCallById(testCallSid);
    if (savedCall) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(savedCall, 'Call session must be persisted in SQLite call_sessions table');
  assert.equal(savedCall.caller_phone, '+919988776655');
  assert.equal(savedCall.status, 'COMPLETED');
  assert.ok(Array.isArray(savedCall.transcript));
  assert.ok(savedCall.transcript.length > 0, 'Transcript must contain conversation turns');
  assert.ok(savedCall.ai_summary, 'Call must have an AI summary');

  // 6. Verify conversation analysis in metadata
  assert.ok(savedCall.metadata?.analysis, 'Metadata must contain post-call AI analysis');
  assert.ok(savedCall.metadata.analysis.caller_intent);
  assert.ok(savedCall.metadata.analysis.classification);
  assert.ok(savedCall.metadata.analysis.recommended_action);
});
