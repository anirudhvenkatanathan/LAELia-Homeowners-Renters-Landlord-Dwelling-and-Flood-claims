import { Router } from 'express';
import { listEvents, getSummary } from '../controllers/complianceController';

const router = Router();
const guard = (fn: typeof listEvents) => (req: Parameters<typeof listEvents>[0], res: Parameters<typeof listEvents>[1]) => {
  fn(req, res).catch(() => { res.status(500).json({ success: false, message: 'Unexpected server error.' }); });
};

router.get('/events', guard(listEvents));
router.get('/summary', guard(getSummary));

export default router;
