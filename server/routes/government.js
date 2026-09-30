import { Router } from 'express';
import { requestService } from '../services/requestService.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Require authenticated Admin or Operator for all government dispatch actions
router.use(authenticate, requireRole('ADMIN', 'OPERATOR'));

// Verify request
router.post('/verify/:id', (req, res, next) => {
  try {
    const { adminNotes } = req.body;
    const updated = requestService.updateRequestStatus(
      req.params.id,
      'VERIFIED',
      adminNotes || 'Request verified by relief operations officer',
      null,
      req.user.name || 'ADMIN'
    );
    res.json({ success: true, message: 'Emergency request verified', data: updated });
  } catch (err) {
    next(err);
  }
});

// Forward to Government
router.post('/forward/:id', (req, res, next) => {
  try {
    const { governmentReference, agencyName, notes } = req.body;
    if (!governmentReference) {
      return res.status(400).json({ success: false, error: 'Government reference code is required' });
    }

    const noteText = `Forwarded to ${agencyName || 'Disaster Management Authority'}. Ref: ${governmentReference}. ${notes || ''}`;
    const updated = requestService.updateRequestStatus(
      req.params.id,
      'FORWARDED_TO_GOVERNMENT',
      noteText,
      governmentReference,
      req.user.name || 'ADMIN'
    );
    res.json({ success: true, message: 'Forwarded to Government Emergency Command', data: updated });
  } catch (err) {
    next(err);
  }
});

// Mark resource allocated
router.post('/allocate/:id', (req, res, next) => {
  try {
    const { allocationDetails, governmentReference } = req.body;
    const noteText = `Resources Allocated: ${allocationDetails || 'Rescue units and relief kits deployed'}.`;
    const updated = requestService.updateRequestStatus(
      req.params.id,
      'RESOURCE_ALLOCATED',
      noteText,
      governmentReference,
      req.user.name || 'ADMIN'
    );
    res.json({ success: true, message: 'Resources allocated', data: updated });
  } catch (err) {
    next(err);
  }
});

// Mark delivery in progress
router.post('/transit/:id', (req, res, next) => {
  try {
    const { trackingNotes, governmentReference } = req.body;
    const updated = requestService.updateRequestStatus(
      req.params.id,
      'DELIVERY_IN_PROGRESS',
      trackingNotes || 'Relief units in transit to destination',
      governmentReference,
      req.user.name || 'ADMIN'
    );
    res.json({ success: true, message: 'Delivery in progress', data: updated });
  } catch (err) {
    next(err);
  }
});

// Mark delivered
router.post('/delivered/:id', (req, res, next) => {
  try {
    const { resolutionSummary, governmentReference } = req.body;
    const updated = requestService.updateRequestStatus(
      req.params.id,
      'DELIVERED',
      resolutionSummary || 'Relief assistance confirmed delivered. Situation stabilized.',
      governmentReference,
      req.user.name || 'ADMIN'
    );
    res.json({ success: true, message: 'Emergency request delivered / resolved', data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
