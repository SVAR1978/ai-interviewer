import { Router } from 'express';
import * as interviewController from '../controllers/interview.controller';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/score', interviewController.getScore);
router.post('/interview', interviewController.startInterview);
router.post('/addanswer', interviewController.addAnswer);
router.post('/home', interviewController.resetInterview);
router.post('/checkscore', authenticate, interviewController.checkScoreHistory);
router.post('/checkresume', upload.single('resume'), interviewController.resumeAnalysis);
router.post('/getimage', interviewController.getImage);
router.post('/addimage', interviewController.addImage);
router.post('/transcribe', upload.single('audio'), interviewController.transcribeAudio);

export default router;
