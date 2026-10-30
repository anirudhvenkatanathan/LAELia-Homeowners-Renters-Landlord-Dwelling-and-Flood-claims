import { Router } from 'express';
import {
  getOnboardingList,
  getOnboardingDetails,
  uploadDocument,
  getDocument,
  removeDraftDocument,
  submitDraftDocument,
  approveDocument,
  rejectDocument,
  recallDocument,
  sendBackDocument,
  resubmitApplication,
  finalApprove,
  suspendVendor,
  disqualifyVendor,
  setAvailability,
  getWaiveReasons,
  waiveConfirmation,
  clearWaive,
  getPendingApprovalDetails,
  approveVendorRequest,
  rejectVendorRequest,
  updateServiceRoles,
  updateVendorProfile,
  getVendorStatusHistory,
  applyPriorityBoost,
} from '../controllers/vendorOnboardingController';

const router = Router();

router.get('/', (req, res) => {
  getOnboardingList(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.get('/waive-reasons', (req, res) => {
  getWaiveReasons(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.get('/pending/:vendorId', (req, res) => {
  getPendingApprovalDetails(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/approve-request', (req, res) => {
  approveVendorRequest(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/reject-request', (req, res) => {
  rejectVendorRequest(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.get('/document/:docId', (req, res) => {
  getDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/remove-draft', (req, res) => {
  removeDraftDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/submit-draft', (req, res) => {
  submitDraftDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.get('/history/:vendorId', (req, res) => {
  getVendorStatusHistory(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.get('/:vendorId', (req, res) => {
  getOnboardingDetails(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/upload', (req, res) => {
  uploadDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/approve', (req, res) => {
  approveDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/reject', (req, res) => {
  rejectDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/send-back', (req, res) => {
  sendBackDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/resubmit', (req, res) => {
  resubmitApplication(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/recall', (req, res) => {
  recallDocument(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/final-approve', (req, res) => {
  finalApprove(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/apply-priority-boost', (req, res) => {
  applyPriorityBoost(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/suspend', (req, res) => {
  suspendVendor(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/disqualify', (req, res) => {
  disqualifyVendor(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/set-availability', (req, res) => {
  setAvailability(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/waive', (req, res) => {
  waiveConfirmation(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/clear-waive', (req, res) => {
  clearWaive(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.post('/update-service-roles', (req, res) => {
  updateServiceRoles(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

router.put('/:vendorId/profile', (req, res) => {
  updateVendorProfile(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

export default router;
