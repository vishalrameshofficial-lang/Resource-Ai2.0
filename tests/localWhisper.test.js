import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LocalWhisperSTTProvider,
  OpenAISTTProvider,
  MockSTTProvider,
  getSTTProvider,
  ISO_LANGUAGES
} from '../server/ai/sttProvider.js';
import { createWav } from '../server/utils/audioCodec.js';

test('LocalWhisperSTTProvider - Language Mapping Preservation', () => {
  const expectedLanguages = [
    'english',
    'hindi',
    'tamil',
    'telugu',
    'kannada',
    'malayalam',
    'bengali',
    'odia'
  ];

  for (const lang of expectedLanguages) {
    assert.ok(ISO_LANGUAGES[lang], `ISO code mapping must exist for ${lang}`);
  }

  assert.equal(ISO_LANGUAGES.english, 'en');
  assert.equal(ISO_LANGUAGES.hindi, 'hi');
  assert.equal(ISO_LANGUAGES.tamil, 'ta');
  assert.equal(ISO_LANGUAGES.telugu, 'te');
  assert.equal(ISO_LANGUAGES.kannada, 'kn');
  assert.equal(ISO_LANGUAGES.malayalam, 'ml');
  assert.equal(ISO_LANGUAGES.bengali, 'bn');
  assert.equal(ISO_LANGUAGES.odia, 'or');
});

test('LocalWhisperSTTProvider - Provider Selection and Capabilities', () => {
  const originalEnv = process.env.STT_PROVIDER;
  process.env.STT_PROVIDER = 'local';

  const provider = getSTTProvider();
  assert.ok(provider instanceof LocalWhisperSTTProvider, 'getSTTProvider() should return LocalWhisperSTTProvider when STT_PROVIDER=local');

  const caps = provider.getCapabilities();
  assert.ok(caps.supportedSampleRates.includes(8000));
  assert.ok(caps.supportedCodecs.includes('audio/wav'));
  assert.ok(caps.supportedCodecs.includes('audio/l16'));

  // Test optional OpenAI STT remains selectable
  process.env.STT_PROVIDER = 'openai';
  const openaiProvider = getSTTProvider();
  assert.ok(openaiProvider instanceof OpenAISTTProvider || openaiProvider instanceof MockSTTProvider);

  // Restore env
  process.env.STT_PROVIDER = originalEnv;
});

test('LocalWhisperSTTProvider - Raw 8kHz PCM to WAV Packaging', () => {
  const rawPcm = Buffer.alloc(1600); // 100ms of 8kHz 16-bit mono PCM (1600 bytes)
  rawPcm.fill(0);

  const wav = createWav(rawPcm, 8000, 1);
  assert.equal(wav.length, 1644); // 44 bytes header + 1600 bytes PCM
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 8000); // Sample rate: 8000 Hz
  assert.equal(wav.readUInt16LE(22), 1);    // Channels: 1 (mono)
  assert.equal(wav.readUInt16LE(34), 16);   // 16-bit PCM
});

test('LocalWhisperSTTProvider - Transcription Interface with Empty/Zero Audio', async () => {
  const provider = new LocalWhisperSTTProvider();
  const resEmpty = await provider.transcribe(Buffer.alloc(0));
  assert.equal(resEmpty, '');

  const resNull = await provider.transcribe(null);
  assert.equal(resNull, '');
});

test('LocalWhisperSTTProvider - Transcription Interface Returns String', async () => {
  const provider = new LocalWhisperSTTProvider();
  // 0.5s of silence PCM at 8kHz (8000 bytes)
  const silentPcm = Buffer.alloc(8000);
  const result = await provider.transcribe(silentPcm, 'Hindi');
  assert.equal(typeof result, 'string');
});

test('LocalWhisperSTTProvider - Error Handling on Invalid Script or Command', async () => {
  const invalidProvider = new LocalWhisperSTTProvider({
    pythonCmd: 'non_existent_python_binary_xyz',
    daemonUrl: 'http://127.0.0.1:59999'
  });

  const rawPcm = Buffer.alloc(1600);
  const result = await invalidProvider.transcribe(rawPcm, 'English');
  // Must catch error gracefully and return empty string without crashing
  assert.equal(result, '');
});
