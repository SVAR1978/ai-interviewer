import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { JobDescription, JDChunk } from '../models';
import {
  ingestJobDescription,
  analyzeResumeGaps,
} from '../services/rag.service';

/**
 * POST /api/rag/ingest
 * Ingest a job description: chunk it, embed it, and store in MongoDB.
 * Body: { title: string, company?: string, rawText: string }
 */
export const ingestJD = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username;
    const { title, company, rawText } = req.body as any;

    if (!title || !rawText) {
      return res.status(400).json({ error: 'Title and rawText are required' });
    }

    if (rawText.length < 50) {
      return res.status(400).json({ error: 'Job description is too short. Please provide a complete JD.' });
    }

    const jd = await ingestJobDescription(username!, title, company || '', rawText);

    res.json({
      message: 'Job description ingested successfully',
      jobDescription: {
        id: jd._id,
        title: jd.title,
        company: jd.company,
        chunkCount: jd.chunkCount,
        createdAt: jd.createdAt,
      },
    });
  } catch (error: any) {
    console.error('JD Ingestion Error:', error);
    res.status(500).json({ error: error.message || 'Failed to ingest job description' });
  }
};

/**
 * GET /api/rag/job-descriptions
 * List all job descriptions for the authenticated user.
 */
export const listJobDescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username;
    const jds = await JobDescription.find({ username })
      .select('title company chunkCount createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ jobDescriptions: jds });
  } catch (error: any) {
    console.error('List JDs Error:', error);
    res.status(500).json({ error: 'Failed to fetch job descriptions' });
  }
};

/**
 * DELETE /api/rag/job-descriptions/:id
 * Delete a job description and all its associated chunks.
 */
export const deleteJobDescription = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username;
    const { id } = req.params;

    const jd = await JobDescription.findOne({ _id: id, username });
    if (!jd) {
      return res.status(404).json({ error: 'Job description not found' });
    }

    // Delete all associated chunks first
    await JDChunk.deleteMany({ jobDescriptionId: id });

    // Delete the parent JD
    await JobDescription.deleteOne({ _id: id });

    res.json({ message: 'Job description deleted successfully' });
  } catch (error: any) {
    console.error('Delete JD Error:', error);
    res.status(500).json({ error: 'Failed to delete job description' });
  }
};

/**
 * POST /api/rag/gap-analysis
 * Analyze gaps between a resume and stored job descriptions.
 * Body: { resumeText: string }
 */
export const resumeGapAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const username = req.username;
    const { resumeText } = req.body as any;

    if (!resumeText || resumeText.length < 30) {
      return res.status(400).json({ error: 'Resume text is required (minimum 30 characters)' });
    }

    const analysis = await analyzeResumeGaps(resumeText, username!);
    res.json({ analysis });
  } catch (error: any) {
    console.error('Gap Analysis Error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform gap analysis' });
  }
};
