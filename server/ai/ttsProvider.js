import { VALID_LANGUAGES } from './schemas.js';
import { resamplePcm24kTo8k, resamplePcm } from '../utils/audioCodec.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class TextToSpeechProvider {
  getCapabilities() {
    return {
      supportedLanguages: VALID_LANGUAGES,
      supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'default'],
      supportedCodecs: ['audio/l16', 'audio/x-mulaw', 'audio/mp3', 'audio/wav'],
      supportedSampleRates: [8000, 16000, 22050, 24000]
    };
  }

  isLanguageSupported(language) {
    return this.getCapabilities().supportedLanguages.some(
      l => l.toLowerCase() === (language || '').toLowerCase()
    );
  }

  async synthesize(text, options = {}) {
    throw new Error('synthesize must be implemented by subclass');
  }
}

// Module-level in-memory cache for synthesized telephony audio (0ms repeated latency)
const ttsAudioCache = new Map();

/**
 * Local TTS Provider using python pyttsx3 or Piper.
 * Generates local speech offline and resamples to 8000Hz 16-bit linear PCM for Exotel telephony.
 */
export class LocalTTSProvider extends TextToSpeechProvider {
  constructor(options = {}) {
    super();
    this.pythonCmd = options.pythonCmd || process.env.PYTHON_PATH || 'python';
    this.scriptPath = options.scriptPath || path.resolve(process.cwd(), 'server/ai/tts_service.py');
    this.speechRate = options.speechRate || parseInt(process.env.LOCAL_TTS_RATE || '175', 10);
  }

  async synthesize(text, options = {}) {
    if (!text || !text.trim()) {
      return Buffer.alloc(0);
    }

    const targetRate = options.sampleRate || 8000;
    const cleanText = text.trim();
    const cacheKey = `${cleanText}_${targetRate}_${this.speechRate}`;

    // Return instant cached telephony audio for standard questions & greetings
    if (ttsAudioCache.has(cacheKey)) {
      console.log(`[TTS:Local] Cache hit for "${cleanText.slice(0, 40)}..." (0ms)`);
      return ttsAudioCache.get(cacheKey);
    }

    const tempWav = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);

    try {
      const args = [
        this.scriptPath,
        '--text', cleanText,
        '--output', tempWav,
        '--rate', String(this.speechRate)
      ];

      await execFileAsync(this.pythonCmd, args, { timeout: 15000 });

      const wavBuffer = await fs.readFile(tempWav);
      if (wavBuffer.length < 44) {
        throw new Error('TTS output file is empty or corrupted');
      }

      // Parse source sample rate from standard WAV header (offset 24, 4 bytes LE)
      const srcSampleRate = wavBuffer.readUInt32LE(24) || 22050;
      const rawPcm = wavBuffer.subarray(44);

      // Resample to target rate (default 8000Hz for Exotel)
      const pcmTarget = resamplePcm(rawPcm, srcSampleRate, targetRate);
      if (pcmTarget && pcmTarget.length > 0) {
        ttsAudioCache.set(cacheKey, pcmTarget);
      }
      console.log(`[TTS:Local] Synthesized ${pcmTarget.length} bytes (${targetRate}Hz PCM, from ${srcSampleRate}Hz) for "${cleanText.slice(0, 40)}..."`);
      return pcmTarget;
    } catch (err) {
      console.warn(`[TTS:Local] Synthesis failed: ${err.message}. Falling back to comfort tone.`);
      const mock = new MockTTSProvider();
      return mock.synthesize(text, options);
    } finally {
      fs.unlink(tempWav).catch(() => {});
    }
  }
}

export class OpenAITTSProvider extends TextToSpeechProvider {
  constructor(apiKey, baseUrl = null) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  async synthesize(text, options = {}) {
    const targetRate = options.sampleRate || 8000;
    console.log(`[TTS:OpenAI] Calling /v1/audio/speech (voice: ${options.voice || 'nova'}, targetRate: ${targetRate}Hz, length: ${text.length} chars)`);

    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: options.voice || 'nova',
          input: text,
          response_format: 'pcm' // OpenAI returns 24kHz 16-bit mono signed PCM
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TTS:OpenAI] Synthesis error HTTP ${response.status}: ${errorText.slice(0, 150)}`);
        throw new Error(`OpenAI TTS API returned HTTP ${response.status}: ${errorText.slice(0, 120)}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const raw24kPcm = Buffer.from(arrayBuffer);

      // Resample from OpenAI's 24kHz PCM to Exotel's telephony 8000Hz PCM
      if (targetRate === 8000) {
        const pcm8k = resamplePcm24kTo8k(raw24kPcm);
        return pcm8k;
      }
      return raw24kPcm;
    } catch (err) {
      console.error('[TTS:OpenAI] Speech synthesis failed:', err.message);
      throw err;
    }
  }
}

export class MockTTSProvider extends TextToSpeechProvider {
  /**
   * Generates a 0.5s gentle silence/comfort buffer for automated testing
   */
  async synthesize(text, options = {}) {
    const sampleRate = options.sampleRate || 8000;
    const durationSec = 0.5;
    const totalSamples = Math.floor(sampleRate * durationSec);
    return Buffer.alloc(totalSamples * 2, 0);
  }
}

export function getTTSProvider() {
  const provider = (process.env.TTS_PROVIDER || 'local').toLowerCase();
  const apiKey = process.env.TTS_API_KEY || process.env.AI_API_KEY;

  if (provider === 'local') {
    return new LocalTTSProvider();
  }

  if (provider === 'openai') {
    if (!apiKey) {
      console.warn('[TTS] WARNING: TTS_PROVIDER=openai but AI_API_KEY is not configured in .env; falling back to local TTS');
      return new LocalTTSProvider();
    }
    return new OpenAITTSProvider(apiKey);
  }

  if (provider === 'mock') {
    return new MockTTSProvider();
  }

  return new LocalTTSProvider();
}
