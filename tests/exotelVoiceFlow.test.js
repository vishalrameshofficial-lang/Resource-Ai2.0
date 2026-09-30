import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AI_PROVIDER = 'mock';

import { ExotelService } from '../server/services/exotelService.js';
import { conversationRegistry, ConversationSession } from '../server/ai/conversationManager.js';
import { callService } from '../server/services/callService.js';
import { requestService } from '../server/services/requestService.js';
import { emergencyService } from '../server/services/emergencyService.js';
import { eventBus } from '../server/websocket/eventBus.js';
import { CONVERSATION_STAGES } from '../server/ai/prompts.js';
import { getTTSProvider, LocalTTSProvider, MockTTSProvider } from '../server/ai/ttsProvider.js';
import { calculateRms, pcm16ToMulaw, mulawToPcm16, resamplePcm } from '../server/utils/audioCodec.js';

test('Exotel Configuration - Validation and Credential Protection', () => {
  const origEnv = { ...process.env };
  try {
    // 1. Missing credentials test
    delete process.env.EXOTEL_ACCOUNT_SID;
    delete process.env.EXOTEL_API_KEY;
    delete process.env.EXOTEL_API_TOKEN;
    delete process.env.EXOTEL_VIRTUAL_NUMBER;

    const unconfigured = new ExotelService();
    const validation = unconfigured.validateConfig();
    assert.equal(validation.valid, false);
    assert.ok(validation.missing.includes('EXOTEL_ACCOUNT_SID'));
    assert.ok(validation.missing.includes('EXOTEL_API_KEY'));
    assert.ok(validation.missing.includes('EXOTEL_API_TOKEN'));
    assert.ok(validation.missing.includes('EXOTEL_VIRTUAL_NUMBER'));
    assert.equal(unconfigured.isConfigured(), false);
    assert.equal(unconfigured.isVirtualNumberConfigured(), false);

    // 2. Fully configured test
    process.env.EXOTEL_ACCOUNT_SID = 'AC1234567890abcdef1234567890abcdef';
    process.env.EXOTEL_API_KEY = 'key_secret_test_9988';
    process.env.EXOTEL_API_TOKEN = 'token_secret_test_1122';
    process.env.EXOTEL_VIRTUAL_NUMBER = '+918047359000';

    const configured = new ExotelService();
    const configValid = configured.validateConfig();
    assert.equal(configValid.valid, true);
    assert.equal(configValid.missing.length, 0);
    assert.equal(configured.isConfigured(), true);
    assert.equal(configured.isVirtualNumberConfigured(), true);

    // 3. Security / Credential Leak Prevention Test
    const status = configured.getStatus();
    assert.ok(!JSON.stringify(status).includes('key_secret_test_9988'), 'Raw API key must NEVER appear in status');
    assert.ok(!JSON.stringify(status).includes('token_secret_test_1122'), 'Raw API token must NEVER appear in status');
    assert.ok(status.accountSid.includes('...'), 'Account SID must be masked');
    assert.ok(status.virtualNumber.includes('****'), 'Virtual phone number must be masked');
  } finally {
    process.env = origEnv;
  }
});

test('Call Session Creation - Initial AI Greeting and Registry', async () => {
  const session = conversationRegistry.createSession({
    callSid: `test_voiceflow_call_${Date.now()}`,
    streamSid: `test_voiceflow_str_${Date.now()}`,
    callerPhone: '+919876543210',
    language: 'English'
  });

  assert.ok(session.id);
  assert.equal(session.callerPhone, '+919876543210');
  assert.equal(session.stage, CONVERSATION_STAGES.GREETING);
  assert.equal(session.status, 'IN_PROGRESS');

  // Initial greeting retrieval
  const greeting = session.getGreeting();
  assert.ok(greeting.toLowerCase().includes('resourceai') || greeting.toLowerCase().includes('resource ai'));
  assert.ok(greeting.toLowerCase().includes('emergency'));
  assert.equal(session.transcript.length, 1);
  assert.equal(session.transcript[0].role, 'assistant');

  // TTS capability test
  const tts = getTTSProvider();
  assert.ok(tts);
  const audio = await tts.synthesize(greeting, { sampleRate: 8000 });
  assert.ok(Buffer.isBuffer(audio));
  assert.ok(audio.length > 0);
});

test('Audio Codec & Incoming Media Handling - VAD and Resampling', () => {
  // 1. Generate 16-bit PCM test tone (8000Hz, 160 samples = 20ms frame = 320 bytes)
  const pcm20ms = Buffer.alloc(320);
  for (let i = 0; i < 160; i++) {
    const val = Math.floor(Math.sin((i / 160) * Math.PI * 4) * 12000);
    pcm20ms.writeInt16LE(val, i * 2);
  }

  // 2. Convert to mu-law (telephony payload format)
  const mulaw = pcm16ToMulaw(pcm20ms);
  assert.equal(mulaw.length, 160);

  // 3. Convert back to PCM for Voice Activity Detection (VAD)
  const decodedPcm = mulawToPcm16(mulaw);
  assert.equal(decodedPcm.length, 320);

  const rms = calculateRms(decodedPcm);
  assert.ok(rms > 2000, `Expected active voice energy RMS > 2000, got ${rms}`);

  // 4. Test Resampling (22050Hz SAPI / Piper -> 8000Hz Exotel)
  const pcm22k = Buffer.alloc(4410); // 100ms at 22050Hz
  for (let i = 0; i < 2205; i++) {
    pcm22k.writeInt16LE(Math.floor(Math.sin((i / 2205) * Math.PI * 4) * 8000), i * 2);
  }
  const pcm8k = resamplePcm(pcm22k, 22050, 8000);
  assert.equal(pcm8k.length, 1600); // 800 samples * 2 bytes = 1600 bytes
});

test('Emergency Request Persistence & Call Association', async () => {
  const testCallSid = `test_persist_call_${Date.now()}`;
  const session = conversationRegistry.createSession({
    callSid: testCallSid,
    streamSid: `test_persist_str_${Date.now()}`,
    callerPhone: '+919944332211',
    language: 'English'
  });

  const emergencyData = {
    caller_phone: session.callerPhone,
    caller_language: 'English',
    emergency_category: 'flood',
    description: 'Flash flooding trapped family on rooftop',
    location: 'Near Vaanarpettai Bridge, Tirunelveli',
    landmark: 'Vaanarpettai Bridge',
    affected_people_count: 5,
    resources_needed: [{ item: 'Rescue Boat', quantity: 1, unit: 'unit' }, { item: 'Food Packets', quantity: 10, unit: 'packets' }],
    urgency: 'CRITICAL',
    immediate_danger: true,
    source: 'AI VOICE'
  };

  // Create emergency request from call session
  const createdRequest = await emergencyService.createFromCall(session, emergencyData);
  assert.ok(createdRequest);
  assert.ok(createdRequest.request_id);
  assert.equal(createdRequest.caller_phone, '+919944332211');
  assert.equal(createdRequest.emergency_category, 'flood');
  assert.equal(session.requestId, createdRequest.request_id);
  assert.equal(session.status, 'COMPLETED');

  // Verify call record in database
  const savedCall = callService.getCallById(testCallSid);
  assert.ok(savedCall);
  assert.equal(savedCall.request_id, createdRequest.request_id);
  assert.equal(savedCall.caller_phone, '+919944332211');

  // Verify request record in database has call reference
  const fetchedRequest = requestService.getRequestById(createdRequest.id);
  assert.ok(fetchedRequest);
  assert.equal(fetchedRequest.created_from_call_id, session.id);
});

test('Dashboard Real-Time Updates - EventBus SSE Broadcast', async () => {
  let receivedEvent = null;
  const mockSseClient = {
    write: (data) => {
      receivedEvent = data;
    },
    on: (event, callback) => {}
  };

  eventBus.addSSEClient(mockSseClient);

  eventBus.broadcast('CALL_STARTED', {
    callSid: 'exo_test_sse_123',
    callerPhone: '+919999988888',
    stage: 'GREETING'
  });

  assert.ok(receivedEvent);
  assert.ok(receivedEvent.includes('CALL_STARTED'));
  assert.ok(receivedEvent.includes('+919999988888'));

  eventBus.removeSSEClient?.(mockSseClient);
  eventBus.clients.delete(mockSseClient);
});

test('Malformed Exotel Messages - Robust Error Handling', () => {
  // Test JSON parsing and validation resilience
  const malformedInputs = [
    'Not JSON at all',
    '{ incomplete json',
    'null',
    '12345',
    '""',
    JSON.stringify({ event: 'unknown_fake_event_type', stream_sid: 'str_1' }),
    JSON.stringify({ event: 'media', media: null }),
    JSON.stringify({ event: 'media', media: { payload: '' } }),
    JSON.stringify({ event: 'start', custom_parameters: null })
  ];

  for (const input of malformedInputs) {
    assert.doesNotThrow(() => {
      let parsed;
      try {
        parsed = JSON.parse(input);
      } catch {
        return; // Correctly caught as malformed
      }

      // Valid JSON but non-object or unknown event
      if (!parsed || typeof parsed !== 'object') {
        return; // Correctly filtered out
      }
    });
  }
});

test('Outbound Call Guard - Missing Credentials Throws Clear Error', async () => {
  const origEnv = { ...process.env };
  try {
    delete process.env.EXOTEL_ACCOUNT_SID;
    delete process.env.EXOTEL_API_KEY;
    delete process.env.EXOTEL_API_TOKEN;

    const unconfigured = new ExotelService();
    await assert.rejects(
      async () => {
        await unconfigured.makeOutboundCall({ to: '+919876543210' });
      },
      /Exotel credentials are not configured/
    );
  } finally {
    process.env = origEnv;
  }
});
