import { Router } from 'express';
import {
  listVendorServiceRequests,
  getVendorServiceRequest,
  createVendorServiceRequest,
  updateVendorServiceRequest,
  getServiceCategories,
} from '../controllers/vendorServiceRequestController';

const router = Router();

router.get('/categories', (req, res) => {
  getServiceCategories(req, res).catch(() => {
    res.status(500).json({ error: 'Unexpected server error.', code: 'SERVER_ERROR' });
  });
});

router.get('/', (req, res) => {
  listVendorServiceRequests(req, res).catch(() => {
    res.status(500).json({ error: 'Unexpected server error.', code: 'SERVER_ERROR' });
  });
});

router.get('/:id', (req, res) => {
  getVendorServiceRequest(req, res).catch(() => {
    res.status(500).json({ error: 'Unexpected server error.', code: 'SERVER_ERROR' });
  });
});

router.post('/', (req, res) => {
  createVendorServiceRequest(req, res).catch(() => {
    res.status(500).json({ error: 'Unexpected server error.', code: 'SERVER_ERROR' });
  });
});

router.patch('/:id', (req, res) => {
  updateVendorServiceRequest(req, res).catch(() => {
    res.status(500).json({ error: 'Unexpected server error.', code: 'SERVER_ERROR' });
  });
});

export default router;
