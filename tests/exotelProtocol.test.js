import test from 'node:test';
import assert from 'node:assert/strict';
import { exotelService } from '../server/services/exotelService.js';
import { getSTTProvider } from '../server/ai/sttProvider.js';
import { getTTSProvider, MockTTSProvider } from '../server/ai/ttsProvider.js';

test('Exotel Service - Configuration and Protocol Parameters', () => {
  const status = exotelService.getStatus();
  assert.equal(status.streamEndpoint, '/api/voice/exotel/stream');
  assert.ok(status.publicWssUrl.includes('/api/voice/exotel/stream'));
  assert.equal(status.sampleRate, 8000);
  assert.ok(status.codec.includes('audio/'));
  assert.ok(status.tunnelWarning.includes('ngrok'));
});

test('Speech and Audio Provider Capabilities', () => {
  const stt = getSTTProvider();
  const tts = getTTSProvider();

  const sttCaps = stt.getCapabilities();
  const ttsCaps = tts.getCapabilities();

  // Must support key Indian languages
  assert.ok(stt.isLanguageSupported('Tamil'));
  assert.ok(stt.isLanguageSupported('Hindi'));
  assert.ok(stt.isLanguageSupported('Telugu'));
  assert.ok(stt.isLanguageSupported('English'));

  // Must support telephony 8kHz PCM/mu-law
  assert.ok(sttCaps.supportedSampleRates.includes(8000));
  assert.ok(ttsCaps.supportedSampleRates.includes(8000));
});

test('Mock TTS Provider Generates Valid Telephony Audio Buffer', async () => {
  const tts = new MockTTSProvider();
  const buffer = await tts.synthesize('Test audio synthesis', { sampleRate: 8000 });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  // 8000 samples * 0.5 sec * 2 bytes = 8000 bytes
  assert.equal(buffer.length, 8000);
});
