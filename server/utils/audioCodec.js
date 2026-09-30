// Pure Node.js audio codec utilities for telephony streams (G.711 mu-law, Linear PCM 16-bit, WAV)

// ITU-T G.711 Mu-law decoding table
const MULAW_TO_PCM = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mu = ~i & 0xFF;
  let sign = (mu & 0x80) ? -1 : 1;
  let exponent = (mu >> 4) & 0x07;
  let mantissa = mu & 0x0F;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  MULAW_TO_PCM[i] = sign * sample;
}

/**
 * Converts 8-bit ITU-T G.711 mu-law buffer into 16-bit linear PCM buffer
 * @param {Buffer} muLawBuffer
 * @returns {Buffer} 16-bit linear PCM buffer (LE)
 */
export function mulawToPcm16(muLawBuffer) {
  if (!muLawBuffer || muLawBuffer.length === 0) return Buffer.alloc(0);
  const pcmBuffer = Buffer.alloc(muLawBuffer.length * 2);
  for (let i = 0; i < muLawBuffer.length; i++) {
    const sample = MULAW_TO_PCM[muLawBuffer[i]];
    pcmBuffer.writeInt16LE(sample, i * 2);
  }
  return pcmBuffer;
}

/**
 * Encodes a single 16-bit linear PCM sample into 8-bit mu-law sample
 * @param {number} sample -16-bit signed integer (-32768 to 32767)
 * @returns {number} 8-bit mu-law value (0-255)
 */
export function pcm16SampleToMuLaw(sample) {
  const CLIP = 32635;
  const BIAS = 0x84;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  let mantissa = (sample >> (exponent + 3)) & 0x0F;
  let mu = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return mu;
}

/**
 * Converts 16-bit linear PCM buffer into 8-bit ITU-T G.711 mu-law buffer
 * @param {Buffer} pcmBuffer
 * @returns {Buffer} mu-law buffer
 */
export function pcm16ToMulaw(pcmBuffer) {
  if (!pcmBuffer || pcmBuffer.length === 0) return Buffer.alloc(0);
  const numSamples = Math.floor(pcmBuffer.length / 2);
  const muBuffer = Buffer.alloc(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    muBuffer[i] = pcm16SampleToMuLaw(sample);
  }
  return muBuffer;
}

/**
 * Calculates the Root Mean Square (RMS) energy of a 16-bit linear PCM audio chunk
 * Used for Voice Activity Detection (VAD) / Silence detection
 * @param {Buffer} pcmBuffer
 * @returns {number} RMS energy level
 */
export function calculateRms(pcmBuffer) {
  if (!pcmBuffer || pcmBuffer.length < 2) return 0;
  const numSamples = Math.floor(pcmBuffer.length / 2);
  let sumSquares = 0;
  for (let i = 0; i < numSamples; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / numSamples);
}

/**
 * Wraps 16-bit linear PCM buffer with standard 44-byte RIFF/WAV header
 * @param {Buffer} pcmBuffer
 * @param {number} sampleRate Default 8000 Hz
 * @param {number} channels Default 1 (mono)
 * @returns {Buffer} Valid WAV audio file buffer
 */
export function createWav(pcmBuffer, sampleRate = 8000, channels = 1) {
  const dataLength = pcmBuffer ? pcmBuffer.length : 0;
  const bitsPerSample = 16;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20);  // AudioFormat = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // ByteRate
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return pcmBuffer ? Buffer.concat([header, pcmBuffer]) : header;
}

/**
 * High-fidelity 3:1 integer downsampling from 24kHz to 8kHz 16-bit linear PCM (mono)
 * Standard downsampler for OpenAI tts-1 (24kHz PCM) -> Exotel Voicebot (8kHz PCM)
 * @param {Buffer} pcm24kBuffer
 * @returns {Buffer} 8kHz 16-bit linear PCM buffer
 */
export function resamplePcm24kTo8k(pcm24kBuffer) {
  if (!pcm24kBuffer || pcm24kBuffer.length < 6) return Buffer.alloc(0);
  const numSamples24k = Math.floor(pcm24kBuffer.length / 2);
  const numSamples8k = Math.floor(numSamples24k / 3);
  const pcm8kBuffer = Buffer.alloc(numSamples8k * 2);

  for (let i = 0; i < numSamples8k; i++) {
    const idx = i * 3;
    const s0 = pcm24kBuffer.readInt16LE(idx * 2);
    const s1 = pcm24kBuffer.readInt16LE((idx + 1) * 2);
    const s2 = pcm24kBuffer.readInt16LE((idx + 2) * 2);

    // Triangular weighted anti-aliasing filter: 25% s0 + 50% s1 + 25% s2
    const sample = Math.round((s0 * 0.25) + (s1 * 0.5) + (s2 * 0.25));
    const clamped = Math.max(-32768, Math.min(32767, sample));
    pcm8kBuffer.writeInt16LE(clamped, i * 2);
  }

  return pcm8kBuffer;
}

/**
 * High-quality linear interpolation resampling between any two sample rates for 16-bit linear PCM (mono)
 * @param {Buffer} pcmBuffer
 * @param {number} fromRate Source sample rate (e.g. 22050, 16000, 24000)
 * @param {number} toRate Target sample rate (e.g. 8000)
 * @returns {Buffer} Resampled 16-bit linear PCM buffer
 */
export function resamplePcm(pcmBuffer, fromRate, toRate = 8000) {
  if (!pcmBuffer || pcmBuffer.length < 2) return Buffer.alloc(0);
  if (fromRate === toRate) return pcmBuffer;

  const srcSamples = Math.floor(pcmBuffer.length / 2);
  const ratio = fromRate / toRate;
  const dstSamples = Math.floor(srcSamples / ratio);
  const out = Buffer.alloc(dstSamples * 2);

  for (let i = 0; i < dstSamples; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, srcSamples - 1);
    const frac = srcIdx - idx0;

    const s0 = pcmBuffer.readInt16LE(idx0 * 2);
    const s1 = pcmBuffer.readInt16LE(idx1 * 2);
    const sample = Math.round(s0 + frac * (s1 - s0));
    const clamped = Math.max(-32768, Math.min(32767, sample));
    out.writeInt16LE(clamped, i * 2);
  }
  return out;
}

