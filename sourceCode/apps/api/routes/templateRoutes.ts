import { Router } from 'express';
import { downloadTemplate } from '../controllers/templateController';

const router = Router();

// GET /api/templates/download/:templateName
router.get('/download/:templateName', downloadTemplate);

export default router;
