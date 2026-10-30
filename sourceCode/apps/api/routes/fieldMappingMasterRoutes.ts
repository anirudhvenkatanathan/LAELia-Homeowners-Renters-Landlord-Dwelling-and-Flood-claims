import { Router } from 'express';
import {
  handleFieldMappingUpload,
  handleGetUploadedFiles,
  handleGetFieldMappingDetails,
  handleSaveMapping,
  handleDownloadTemplate,
} from '../controllers/fieldMappingMasterController';

const router = Router();

// POST /api/field-mapping/upload
router.post('/upload', (req, res) => {
  handleFieldMappingUpload(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// GET /api/field-mapping/files
router.get('/files', (req, res) => {
  handleGetUploadedFiles(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// GET /api/field-mapping/details/:uploadId
router.get('/details/:uploadId', (req, res) => {
  handleGetFieldMappingDetails(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// POST /api/field-mapping/save-mapping
router.post('/save-mapping', (req, res) => {
  handleSaveMapping(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

// GET /api/field-mapping/download-template
router.get('/download-template', (req, res) => {
  handleDownloadTemplate(req, res).catch(() => {
    res.status(500).json({ success: false, message: 'Unexpected server error.' });
  });
});

export default router;
