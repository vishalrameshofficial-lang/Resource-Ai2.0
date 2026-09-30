import { Router } from 'express';
import { exotelService } from '../services/exotelService.js';
import { getDatabase } from '../db/database.js';
import { eventBus } from '../websocket/eventBus.js';

const router = Router();

// GET /api/exotel/status
router.get('/status', (req, res) => {
  const status = exotelService.getStatus();
  const validation = exotelService.validateConfig();

  res.json({
    success: true,
    data: status,
    validation,
    setupGuide: {
      step1: "In your Exotel Dashboard, navigate to App Bazaar / Flows -> Voicebot Integration.",
      step2: "Select 'AgentStream' or 'Bidirectional Voicebot WebSocket' as the bot provider.",
      step3: `Enter the WebSocket URL: ${status.publicWssUrl}`,
      step4: `Set Audio Encoding to '${status.codec}' and Sample Rate to '${status.sampleRate} Hz'.`,
      step5: "Assign your incoming ExoPhone virtual number (+91...) to this Voicebot Applet.",
      step6: "For local testing, run ngrok (e.g., `ngrok http 5055`) and set PUBLIC_HOST to your ngrok forwarding domain in .env."
    }
  });
});

// POST /api/exotel/webhook (Inbound call trigger / status callback)
router.post('/webhook', (req, res) => {
  if (!exotelService.verifyWebhookSignature(req)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  const payload = req.body || {};
  const callSid = payload.CallSid || payload.call_sid || payload.CustomField;
  const recordingUrl = payload.RecordingUrl || payload.recording_url;

  if (callSid && recordingUrl) {
    try {
      const db = getDatabase();
      db.prepare('UPDATE call_sessions SET recording_url = ? WHERE call_sid = ?').run(recordingUrl, callSid);
      console.log(`[ExotelWebhook] Attached carrier recording ${recordingUrl} to call ${callSid}`);
      eventBus.broadcast('CALL_UPDATED', { callSid, recordingUrl });
    } catch (err) {
      console.warn('[ExotelWebhook] Warning storing carrier recording:', err.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Webhook received',
    timestamp: new Date().toISOString()
  });
});

// POST /api/exotel/call (Outbound call dispatch via Exotel REST API)
router.post('/call', async (req, res) => {
  const { to, from, flowId, customData } = req.body || {};

  if (!to) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: to' });
  }

  if (!exotelService.isConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'Exotel API credentials are not configured. Set EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in .env'
    });
  }

  try {
    const result = await exotelService.makeOutboundCall({ to, from, flowId, customData });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
