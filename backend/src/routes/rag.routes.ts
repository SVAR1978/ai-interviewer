import { Router } from 'express';
import * as ragController from '../controllers/rag.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All RAG routes require authentication
router.post('/rag/ingest', authenticate, ragController.ingestJD);
router.get('/rag/job-descriptions', authenticate, ragController.listJobDescriptions);
router.delete('/rag/job-descriptions/:id', authenticate, ragController.deleteJobDescription);
router.post('/rag/gap-analysis', authenticate, ragController.resumeGapAnalysis);

export default router;
