import { Router } from 'express';
import {
  getAssignments,
  updateAssignmentStatus,
  getPerformance,
} from '../controllers/activeVendorController';

const router = Router();

router.get('/:vendorId/assignments', (req, res) => {
  getAssignments(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.put('/:vendorId/assignments/:assignmentId', (req, res) => {
  updateAssignmentStatus(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.get('/:vendorId/performance', (req, res) => {
  getPerformance(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

export default router;
