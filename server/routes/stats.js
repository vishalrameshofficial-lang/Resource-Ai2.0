import { Router } from 'express';
import { requestService } from '../services/requestService.js';
import { callService } from '../services/callService.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const stats = requestService.getStats();
    const liveCalls = callService.getActiveLiveCalls();

    res.json({
      success: true,
      data: {
        ...stats,
        liveCallsCount: liveCalls.length,
        liveCalls
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
