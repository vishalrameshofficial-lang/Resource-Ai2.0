import { Router } from 'express';
import { getDatabase } from '../db/database.js';
import { exotelService } from '../services/exotelService.js';
import { conversationRegistry } from '../ai/conversationManager.js';

const router = Router();

// GET /api/health - Detailed platform health and subsystem readiness
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const dbCheck = db.prepare('SELECT 1 as healthy').get();
    const exotelStatus = exotelService.getStatus();
    const activeCalls = conversationRegistry.getAllActiveSessions();

    // 1. Check Local Whisper daemon / CLI readiness
    let whisperStatus = 'ready (cli fallback)';
    const whisperDaemonUrl = process.env.WHISPER_DAEMON_URL || 'http://127.0.0.1:5056';
    try {
      const wCtrl = new AbortController();
      const wTimeout = setTimeout(() => wCtrl.abort(), 600);
      const wRes = await fetch(`${whisperDaemonUrl}/health`, { signal: wCtrl.signal });
      clearTimeout(wTimeout);
      if (wRes.ok) {
        whisperStatus = 'online (daemon http)';
      }
    } catch {
      // Daemon offline, CLI fallback active
    }

    // 2. Check Ollama local service readiness
    let ollamaStatus = 'offline';
    const ollamaUrl = (process.env.AI_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    try {
      const oCtrl = new AbortController();
      const oTimeout = setTimeout(() => oCtrl.abort(), 800);
      const oRes = await fetch(`${ollamaUrl}/api/tags`, { signal: oCtrl.signal });
      clearTimeout(oTimeout);
      if (oRes.ok) {
        const oData = await oRes.json();
        const modelNames = (oData.models || []).map(m => m.name);
        const configuredModel = process.env.AI_MODEL || 'qwen2.5:3b';
        const hasModel = modelNames.some(m => m.includes(configuredModel));
        ollamaStatus = hasModel ? `online (${configuredModel})` : `online (available models: ${modelNames.slice(0, 3).join(', ')})`;
      }
    } catch {
      ollamaStatus = 'offline (rule engine fallback active)';
    }

    // 3. TTS Provider status
    const ttsProviderSetting = (process.env.TTS_PROVIDER || 'local').toLowerCase();
    let ttsStatus = `active (${ttsProviderSetting})`;
    if (ttsProviderSetting === 'openai' && !process.env.TTS_API_KEY && !process.env.AI_API_KEY) {
      ttsStatus = 'fallback to local (no OpenAI key)';
    }

    res.json({
      status: 'healthy',
      app: 'ResourceAI',
      version: '1.0.0',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbCheck?.healthy === 1 ? 'connected (native node:sqlite)' : 'unhealthy',
      exotel: {
        configured: exotelStatus.configured,
        virtualNumberConfigured: exotelStatus.virtualNumberConfigured,
        virtualNumber: exotelStatus.virtualNumber,
        endpoint: exotelStatus.streamEndpoint,
        publicWssUrl: exotelStatus.publicWssUrl
      },
      ai: {
        provider: process.env.AI_PROVIDER || 'ollama',
        model: process.env.AI_MODEL || 'qwen2.5:3b',
        ollamaStatus,
        sttProvider: process.env.STT_PROVIDER || 'local',
        whisperStatus,
        ttsProvider: ttsProviderSetting,
        ttsStatus,
        keyConfigured: Boolean(process.env.AI_API_KEY && process.env.AI_API_KEY.trim().length > 0)
      },
      activeCallsCount: activeCalls.length
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
