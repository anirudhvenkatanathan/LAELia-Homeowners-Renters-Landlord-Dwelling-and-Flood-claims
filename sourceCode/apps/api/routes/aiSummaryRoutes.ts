import { Router } from 'express';
import { generateClaimSummary } from '../controllers/aiSummaryController';
import { generateVendorIntelligence } from '../controllers/aiVendorIntelligenceController';

const router = Router();

// POST /api/ai/claim-summary
router.post('/claim-summary', (req, res) => {
  generateClaimSummary(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// POST /api/ai/vendor-intelligence
router.post('/vendor-intelligence', (req, res) => {
  generateVendorIntelligence(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

export default router;
