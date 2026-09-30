import { Router } from 'express';
import { requestService } from '../services/requestService.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.js';
import { sanitizeObject } from '../middleware/security.js';

const router = Router();

// GET /api/requests
router.get('/', optionalAuthenticate, (req, res, next) => {
  try {
    const isAuthorizedAdmin = req.user && ['ADMIN', 'OPERATOR'].includes(req.user.role);
    const requests = requestService.getAllRequests(req.query);
    const sanitized = sanitizeObject(requests, isAuthorizedAdmin);
    res.json({
      success: true,
      count: sanitized.length,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/requests/:id
router.get('/:id', optionalAuthenticate, (req, res, next) => {
  try {
    const isAuthorizedAdmin = req.user && ['ADMIN', 'OPERATOR'].includes(req.user.role);
    const request = requestService.getRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Emergency request not found' });
    }
    const sanitized = sanitizeObject(request, isAuthorizedAdmin);
    res.json({
      success: true,
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/requests (Citizen web intake or automated submission)
router.post('/', (req, res, next) => {
  try {
    const created = requestService.createRequest(req.body);
    res.status(201).json({
      success: true,
      message: 'Emergency request recorded in ResourceAI',
      data: {
        id: created.id,
        request_id: created.request_id,
        status: created.status,
        created_at: created.created_at
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/requests/:id/status (Admin status transition)
router.patch('/:id/status', authenticate, requireRole('ADMIN', 'OPERATOR'), (req, res, next) => {
  try {
    const { status, adminNotes, governmentReference } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const updated = requestService.updateRequestStatus(
      req.params.id,
      status,
      adminNotes,
      governmentReference,
      req.user.name || 'ADMIN'
    );

    res.json({
      success: true,
      message: `Emergency request status updated to ${status}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/requests/:id (Update request details)
router.patch('/:id', authenticate, requireRole('ADMIN', 'OPERATOR'), (req, res, next) => {
  try {
    const updated = requestService.updateRequest(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Emergency request updated',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

export default router;
