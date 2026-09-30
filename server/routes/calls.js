import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { callService } from '../services/callService.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { sanitizeObject } from '../middleware/security.js';

const router = Router();

// GET /api/calls - List calls with optional department/priority/status filters
router.get('/', optionalAuthenticate, (req, res, next) => {
  try {
    const isAuthorizedAdmin = req.user && ['ADMIN', 'OPERATOR'].includes(req.user.role);
    const filters = {
      department: req.query.department,
      priority: req.query.priority,
      language: req.query.language,
      status: req.query.status,
      location: req.query.location
    };
    const calls = callService.getAllCalls(filters);
    const sanitized = sanitizeObject(calls, isAuthorizedAdmin);
    res.json({
      success: true,
      count: sanitized.length,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/calls/departments/stats - Aggregate real department and resource stats
router.get('/departments/stats', (req, res, next) => {
  try {
    const stats = callService.getDepartmentStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/calls/active - Active live telephony sessions
router.get('/active', (req, res) => {
  const activeCalls = callService.getActiveLiveCalls();
  res.json({
    success: true,
    count: activeCalls.length,
    data: activeCalls
  });
});

// GET /api/calls/:id/recording - Serve original caller voice recording
router.get('/:id/recording', optionalAuthenticate, (req, res, next) => {
  try {
    const call = callService.getCallById(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call session not found' });
    }

    const recordingsDir = path.resolve(process.cwd(), 'server', 'data', 'recordings');
    const filename = `${call.call_sid || call.id}.wav`;
    const filepath = path.join(recordingsDir, filename);

    if (fs.existsSync(filepath)) {
      res.setHeader('Content-Type', 'audio/wav');
      return fs.createReadStream(filepath).pipe(res);
    }

    if (call.recording_url && call.recording_url.startsWith('http')) {
      return res.redirect(call.recording_url);
    }

    return res.status(404).json({ success: false, error: 'Voice recording not found' });
  } catch (err) {
    next(err);
  }
});

// GET /api/calls/:id - Get specific call details
router.get('/:id', optionalAuthenticate, (req, res, next) => {
  try {
    const isAuthorizedAdmin = req.user && ['ADMIN', 'OPERATOR'].includes(req.user.role);
    const call = callService.getCallById(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call session not found' });
    }
    const sanitized = sanitizeObject(call, isAuthorizedAdmin);
    res.json({
      success: true,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/calls/:id/analyze - AI Query Understanding & Department Classification
router.post('/:id/analyze', optionalAuthenticate, async (req, res, next) => {
  try {
    const call = callService.getCallById(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call session not found' });
    }

    const { getAIProvider } = await import('../ai/aiProvider.js');
    const ai = getAIProvider();

    // Allow custom transcript override from request body if provided
    let transcriptToAnalyze = call.transcript || [];
    if (req.body && req.body.transcript) {
      if (typeof req.body.transcript === 'string') {
        transcriptToAnalyze = [{ role: 'caller', text: req.body.transcript }];
      } else if (Array.isArray(req.body.transcript)) {
        transcriptToAnalyze = req.body.transcript;
      }
    }

    const sessionState = {
      id: call.id,
      callSid: call.call_sid,
      callerPhone: call.caller_phone,
      language: call.language || 'English',
      transcript: transcriptToAnalyze,
      query: typeof req.body?.transcript === 'string' ? req.body.transcript : call.query,
      data: call.metadata?.extractedData || {}
    };

    // Run AI Query Understanding & Department Classification
    const classification = await ai.classifyCallQuery(sessionState);

    // Also run general conversation analysis
    let analysis = null;
    try {
      analysis = await ai.analyzeConversation(sessionState);
    } catch (err) {
      console.warn('[CallsRoute] analyzeConversation fallback:', err.message);
    }

    // Persist classification against existing call record
    const updatedCall = {
      ...call,
      query: classification.query,
      summary: classification.summary,
      department: classification.department,
      required_service: classification.required_service,
      required_resources: classification.required_resources,
      priority: classification.priority,
      location: classification.location,
      affected_people: classification.affected_people,
      classification_confidence: classification.confidence,
      classification_status: 'completed',
      aiSummary: classification.summary,
      metadata: {
        ...(call.metadata || {}),
        classification,
        analysis: analysis || call.metadata?.analysis,
        analyzedAt: new Date().toISOString()
      }
    };

    callService.saveCallSession(updatedCall);

    // Return exact schema required by assignment
    res.json({
      query: classification.query,
      summary: classification.summary,
      department: classification.department,
      required_service: classification.required_service,
      required_resources: classification.required_resources,
      priority: classification.priority,
      location: classification.location,
      affected_people: classification.affected_people,
      confidence: classification.confidence
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/calls/:id/classification - Allow admin to manually correct department/resources/priority
router.patch('/:id/classification', optionalAuthenticate, (req, res, next) => {
  try {
    const call = callService.getCallById(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call session not found' });
    }

    const updated = callService.updateCallClassification(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Call classification updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
