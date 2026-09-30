import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VALID_LANGUAGES } from './schemas.js';
import { createWav } from '../utils/audioCodec.js';

const execFileAsync = promisify(execFile);

export const ISO_LANGUAGES = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  telugu: 'te',
  kannada: 'kn',
  malayalam: 'ml',
  bengali: 'bn',
  odia: 'or'
};

export class SpeechToTextProvider {
  getCapabilities() {
    return {
      supportedLanguages: VALID_LANGUAGES,
      supportedCodecs: ['audio/l16', 'audio/x-mulaw', 'audio/wav'],
      supportedSampleRates: [8000, 16000]
    };
  }

  isLanguageSupported(language) {
    return this.getCapabilities().supportedLanguages.some(
      l => l.toLowerCase() === (language || '').toLowerCase()
    );
  }

  async transcribe(audioBuffer, language = 'English') {
    throw new Error('transcribe must be implemented by subclass');
  }
}

/**
 * Local STT Provider using faster-whisper.
 * Accepts 8kHz mono PCM or WAV audio, converts buffered PCM into standard WAV,
 * and passes to the faster-whisper service (daemon HTTP mode or on-demand CLI fallback).
 */
export class LocalWhisperSTTProvider extends SpeechToTextProvider {
  constructor(options = {}) {
    super();
    this.daemonUrl = options.daemonUrl || process.env.WHISPER_DAEMON_URL || 'http://127.0.0.1:5056';
    this.pythonCmd = options.pythonCmd || process.env.PYTHON_PATH || 'python';
    this.model = options.model || process.env.LOCAL_WHISPER_MODEL || 'base';
    this.scriptPath = options.scriptPath || path.resolve(process.cwd(), 'server/ai/whisper_service.py');
  }

  async transcribe(audioBuffer, language = 'English') {
    if (!audioBuffer) return '';
    if (typeof audioBuffer === 'string') return audioBuffer;
    if (audioBuffer.text) return audioBuffer.text;
    if (audioBuffer.length === 0) return '';

    // Convert/package incoming 8kHz mono PCM to WAV if not already a WAV buffer
    let wavBuffer = audioBuffer;
    const isWav = audioBuffer.length >= 12 &&
      audioBuffer.subarray(0, 4).toString() === 'RIFF' &&
      audioBuffer.subarray(8, 12).toString() === 'WAVE';

    if (!isWav) {
      wavBuffer = createWav(audioBuffer, 8000, 1);
    }

    // Resolve language mapping (preserves English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Odia)
    const langKey = (language || '').toLowerCase().trim();
    const isoCode = ISO_LANGUAGES[langKey] || (langKey !== 'auto' && langKey.length > 0 ? langKey : undefined);

    console.log(`[STT:LocalWhisper] Transcribing audio (${wavBuffer.length} bytes WAV, requested language: ${language || 'auto'}${isoCode ? ` -> ${isoCode}` : ''})`);

    // 1. Primary path: Fast HTTP Daemon (if running, pre-warmed in memory)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const headers = { 'Content-Type': 'audio/wav' };
      if (isoCode) {
        headers['X-Language'] = isoCode;
      }

      const response = await fetch(`${this.daemonUrl}/transcribe`, {
        method: 'POST',
        headers,
        body: wavBuffer,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const transcription = (data.text || '').trim();
        console.log(`[STT:LocalWhisper] Transcription result: "${transcription}"`);
        return transcription;
      }
    } catch {
      // Daemon not reachable; seamlessly fallback to on-demand CLI execution
    }

    // 2. Fallback path: Execute faster-whisper via Python CLI
    const tempFile = path.join(os.tmpdir(), `whisper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);
    try {
      await fs.writeFile(tempFile, wavBuffer);

      const args = [this.scriptPath, '--file', tempFile, '--model', this.model];
      if (isoCode) {
        args.push('--language', isoCode);
      }

      const { stdout } = await execFileAsync(this.pythonCmd, args, { timeout: 25000 });
      const data = JSON.parse(stdout.trim());
      if (data.error) {
        console.error('[STT:LocalWhisper] faster-whisper error:', data.error);
        return '';
      }
      const transcription = (data.text || '').trim();
      console.log(`[STT:LocalWhisper] CLI transcription result: "${transcription}"`);
      return transcription;
    } catch (err) {
      console.error('[STT:LocalWhisper] Speech transcription unavailable:', err.message);
      return '';
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}

export class OpenAISTTProvider extends SpeechToTextProvider {
  constructor(apiKey, baseUrl = 'https://api.openai.com/v1') {
    super();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async transcribe(audioBuffer, language = 'English') {
    if (!audioBuffer || audioBuffer.length === 0) return '';

    console.log(`[STT:OpenAI] Calling /v1/audio/transcriptions (audio: ${audioBuffer.length} bytes WAV, language: ${language})`);

    try {
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', blob, 'audio.wav');
      formData.append('model', 'whisper-1');

      const langKey = (language || '').toLowerCase().trim();
      const isoCode = ISO_LANGUAGES[langKey];
      if (isoCode) {
        formData.append('language', isoCode);
      }

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[STT:OpenAI] Transcription error HTTP ${response.status}: ${errorText.slice(0, 150)}`);
        throw new Error(`OpenAI STT failed (${response.status}): ${errorText.slice(0, 120)}`);
      }

      const data = await response.json();
      const transcription = (data.text || '').trim();
      console.log(`[STT:OpenAI] Whisper transcription success: "${transcription}"`);
      return transcription;
    } catch (err) {
      console.error('[STT:OpenAI] Transcription error:', err.message);
      return '';
    }
  }
}

export class MockSTTProvider extends SpeechToTextProvider {
  async transcribe(audioBuffer, language = 'English') {
    if (typeof audioBuffer === 'string') {
      return audioBuffer;
    }
    if (audioBuffer && audioBuffer.text) {
      return audioBuffer.text;
    }
    return '';
  }
}

export function getSTTProvider() {
  const provider = (process.env.STT_PROVIDER || 'mock').toLowerCase();
  const apiKey = process.env.STT_API_KEY || process.env.AI_API_KEY;

  if (provider === 'local') {
    return new LocalWhisperSTTProvider();
  }

  if (provider === 'openai') {
    if (!apiKey) {
      console.warn('[STT] WARNING: STT_PROVIDER=openai but AI_API_KEY is not configured in .env');
      return new MockSTTProvider();
    }
    return new OpenAISTTProvider(apiKey, process.env.AI_BASE_URL);
  }
  return new MockSTTProvider();
}
