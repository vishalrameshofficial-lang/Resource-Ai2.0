import { Router } from 'express';
import { conversationRegistry } from '../ai/conversationManager.js';
import { emergencyService } from '../services/emergencyService.js';
import { VALID_LANGUAGES } from '../ai/schemas.js';
import { getSTTProvider } from '../ai/sttProvider.js';
import { getTTSProvider } from '../ai/ttsProvider.js';

const router = Router();

// POST /api/voice/test (Interactive Voice Agent Simulator API)
router.post('/test', async (req, res, next) => {
  try {
    const { message, language = 'English', callerPhone = '+919876543210', sessionId } = req.body;

    let session = sessionId ? conversationRegistry.getSession(sessionId) : null;
    let isNew = false;

    if (!session) {
      session = conversationRegistry.createSession({
        callerPhone,
        language,
        isRealTelephony: false,
        isSimulator: true
      });
      isNew = true;
    }

    if (language && session.language !== language) {
      session.language = language;
    }

    let replyData;
    if (isNew && (!message || message.trim() === '')) {
      const greeting = session.getGreeting();
      replyData = {
        replyText: greeting,
        stage: session.stage,
        status: session.status,
        requestId: null,
        language: session.language
      };
    } else {
      replyData = await session.processUtterance(message, emergencyService);
    }

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        callSid: session.callSid,
        replyText: replyData.replyText,
        stage: replyData.stage,
        status: replyData.status,
        requestId: replyData.requestId,
        language: session.language,
        hasAudio: Boolean(replyData.audioBuffer),
        transcript: session.transcript,
        gatheredData: session.data
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/voice/languages
router.get('/languages', (req, res) => {
  const stt = getSTTProvider();
  const tts = getTTSProvider();

  res.json({
    success: true,
    languages: VALID_LANGUAGES,
    sttCapabilities: stt.getCapabilities(),
    ttsCapabilities: tts.getCapabilities()
  });
});

export default router;
