import { Router, Request, Response, NextFunction } from 'express';
import {
  getRoles,
  getKpiMetrics,
  getKpiMetricsForClaim,
  createKpiMetric,
  updateKpiMetric,
  toggleKpiMetric,
  deleteKpiMetric,
  setVendorKpiForRole,
  getAiRecommendations,
  acceptAiRecommendation,
} from '../controllers/kpiMetricsController';

const router = Router();

type Handler = (req: Request, res: Response) => Promise<void>;

const wrap = (fn: Handler) => (req: Request, res: Response, _next: NextFunction) => {
  fn(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
};

router.get('/roles',             wrap(getRoles));
router.get('/for-claim',         wrap(getKpiMetricsForClaim));
router.get('/ai-recommendations',wrap(getAiRecommendations));
router.post('/ai-recommendations/:id/accept', wrap(acceptAiRecommendation));
router.get('/',                  wrap(getKpiMetrics));
router.post('/',        wrap(createKpiMetric));
router.put('/vendor-toggle-role', wrap(setVendorKpiForRole));
router.put('/:id',      wrap(updateKpiMetric));
router.put('/:id/toggle', wrap(toggleKpiMetric));
router.delete('/:id',   wrap(deleteKpiMetric));

export default router;
