import { Router } from 'express';
import {
  handleUpload,
  handleList,
  handleDetails,
} from '../controllers/claimIntakeMasterController';

const router = Router();

// POST /api/claim-intake/upload
router.post('/upload', (req, res) => {
  handleUpload(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// GET /api/claim-intake/list
router.get('/list', (req, res) => {
  handleList(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// GET /api/claim-intake/details/:uploadId
router.get('/details/:uploadId', (req, res) => {
  handleDetails(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

export default router;
