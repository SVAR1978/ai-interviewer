import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AssemblyAI } from 'assemblyai';
import { Score, QA, Qno, ImageModel } from '../models';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import { retrieveRelevantChunks, retrieveChunksForJD } from '../services/rag.service';

const genAI = new GoogleGenerativeAI(config.geminiKey);
const model = genAI.getGenerativeModel({ model: config.geminiModel });
const assemblyClient = new AssemblyAI({ apiKey: config.assemblyAIKey });

export const getScore = async (req: Request, res: Response) => {
  try {
    const username = req.headers['username'] as string;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    let lastscore = await Score.findOne({ username });
    if (!lastscore) {
      lastscore = new Score({ username, lastscore: '' });
      await lastscore.save();
    }

    let q = await QA.findOne({ username }).select('questionanswer');
    if (!q || !q.questionanswer || q.questionanswer.trim() === '') {
      return res.status(404).json({ error: 'No interview responses found. Please complete at least one Q&A before generating a score.' });
    }

    // Verify that there is at least one answer in the Q&A record
    const answerCount = (q.questionanswer.match(/\nA\d+:/g) || []).length;
    if (answerCount === 0) {
      return res.status(400).json({ error: 'No answers found in your interview session. Please answer at least one question before generating a score.' });
    }

    // Retrieve JD context for grounded scoring
    let jdContext = '';
    try {
      const relevantChunks = await retrieveRelevantChunks(q.questionanswer, username, 5);
      if (relevantChunks.length > 0) {
        jdContext = `\n\nJob Description Requirements (evaluate answers against these):\n` +
          relevantChunks.map((c, i) => `[${c.section}]: ${c.chunkText}`).join('\n');
      }
    } catch {
      // If RAG retrieval fails, continue without JD context
    }

    const feedbackPrompt = `You are an expert interview evaluator. Analyze the following interview Q&A responses and provide detailed, constructive feedback.

Interview Responses:
${q.questionanswer}
${jdContext}

Return ONLY a valid JSON object with exactly this structure (no markdown, no commentary, no code fences):
{
  "overall_score": "7",
  "overall_feedback": "A detailed 3-5 sentence assessment of the candidate's overall interview performance, communication clarity, and technical depth.",
  "strengths": "A detailed paragraph describing 3-4 specific strengths demonstrated during the interview, with concrete examples from their answers.",
  "improvement_points": [
    "First specific area for improvement with actionable advice",
    "Second specific area for improvement with actionable advice",
    "Third specific area for improvement with actionable advice"
  ]
}

Rules:
- "overall_score" must be a single number from 1-10 as a string
- "overall_feedback" must be a detailed paragraph (not a list)
- "strengths" must be a detailed paragraph (not a list)
- "improvement_points" must be an array of 3-5 specific, actionable strings
- Return ONLY the JSON object, nothing else`;

    // Retry with exponential backoff for transient API errors
    const MAX_RETRIES = 3;
    let result: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent(feedbackPrompt);
        break;
      } catch (apiError: any) {
        const isRetryable = apiError?.status === 503 || apiError?.status === 429;
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Gemini API returned ${apiError.status} during scoring, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw apiError;
        }
      }
    }

    let feedbackJson: string = '';
    try {
      feedbackJson = await result.response.text();
    } catch {
      feedbackJson = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }
    feedbackJson = feedbackJson.trim();

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    feedbackJson = feedbackJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // If the model returned extra text around the JSON, extract just the JSON object
    const jsonMatch = feedbackJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      feedbackJson = jsonMatch[0];
    }

    console.log('Score raw output:', feedbackJson.substring(0, 200));

    let parsed: any;
    try {
      parsed = JSON.parse(feedbackJson);
    } catch (e) {
      console.error('Failed to parse score JSON:', feedbackJson);
      throw new Error('Failed to parse model output as JSON. The AI returned an invalid response.');
    }

    // Normalize the parsed data to ensure expected fields exist
    parsed = {
      overall_score: String(parsed.overall_score || parsed.score || parsed.overallScore || '0'),
      overall_feedback: parsed.overall_feedback || parsed.feedback || parsed.overallFeedback || parsed.summary || 'No detailed feedback available.',
      strengths: parsed.strengths || parsed.key_strengths || parsed.keyStrengths || 'No strengths analysis available.',
      improvement_points: Array.isArray(parsed.improvement_points) ? parsed.improvement_points
        : Array.isArray(parsed.improvements) ? parsed.improvements
        : Array.isArray(parsed.areas_for_improvement) ? parsed.areas_for_improvement
        : Array.isArray(parsed.weaknesses) ? parsed.weaknesses
        : typeof parsed.improvement_points === 'string' ? [parsed.improvement_points]
        : ['No specific improvement areas identified.']
    };

    const numericScore = parsed.overall_score?.match(/\d+/)?.[0] || '0';
    lastscore.lastscore += lastscore.lastscore ? `_${numericScore}` : numericScore;
    await lastscore.save();

    q.questionanswer = '';
    await q.save();

    let qnoRecord = await Qno.findOne({ username });
    if (qnoRecord) {
      qnoRecord.qno = '1';
      await qnoRecord.save();
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Score Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};

export const startInterview = async (req: Request, res: Response) => {
  try {
    const username = req.header('username') as string;
    const { domain, jobDescriptionId } = req.body as any;

    if (!domain) return res.status(400).json({ error: 'Domain is required' });

    let qaRecord = await QA.findOne({ username });
    if (!qaRecord) {
        qaRecord = new QA({ username, questionanswer: '' });
        await qaRecord.save();
    }

    let qnoRecord = await Qno.findOne({ username });
    if (!qnoRecord) {
      qnoRecord = new Qno({ username, qno: '0' });
      await qnoRecord.save();
    }

    let i = parseInt(qnoRecord.qno, 10);

    // ── RAG Context Retrieval ────────────────────────────────────────
    let ragContext = '';
    try {
      let relevantChunks;
      if (jobDescriptionId) {
        // Retrieve chunks scoped to a specific JD
        const query = i === 0 ? domain : `${domain} ${qaRecord.questionanswer}`;
        relevantChunks = await retrieveChunksForJD(query, jobDescriptionId, 5);
      } else {
        // Retrieve from all user's JDs
        const query = i === 0 ? domain : `${domain} ${qaRecord.questionanswer}`;
        relevantChunks = await retrieveRelevantChunks(query, username, 5);
      }

      if (relevantChunks && relevantChunks.length > 0) {
        ragContext = '\n\nRelevant job description requirements to base your question on:\n' +
          relevantChunks
            .map((c, idx) => `[${c.section}]: ${c.chunkText}`)
            .join('\n');
      }
    } catch {
      // If RAG retrieval fails, fall back to non-grounded generation
    }

    // ── Question Generation ──────────────────────────────────────────
    let promptText: string;

    if (i === 0) {
      promptText = ragContext
        ? `You are an expert technical interviewer. Based on the following job description requirements, generate a targeted interview question in the domain of "${domain}".${ragContext}\n\nGenerate a specific, role-relevant question that directly tests skills mentioned in the job description. Only output the question itself.`
        : `Generate a professional interview question in the domain of "${domain}".`;
    } else {
      promptText = ragContext
        ? `You are an expert technical interviewer. Based on the following job description requirements and the candidate's previous responses, generate a relevant follow-up interview question in the domain of "${domain}".${ragContext}\n\nPrevious Q&A:\n${qaRecord.questionanswer}\n\nGenerate a follow-up question that digs deeper into the job requirements or probes areas the candidate hasn't covered yet. Only output the question itself.`
        : `Based on this previous Q&A history, generate a relevant follow-up interview question in the domain of "${domain}":\n${qaRecord.questionanswer}Only output the question itself.`;
    }

    // Retry with exponential backoff for transient API errors (e.g. 503)
    const MAX_RETRIES = 3;
    let result: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent(promptText);
        break; // success
      } catch (apiError: any) {
        const isRetryable = apiError?.status === 503 || apiError?.status === 429;
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Gemini API returned ${apiError.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw apiError; // rethrow on final attempt or non-retryable error
        }
      }
    }

    const question: string = await result.response.text();

    qaRecord.questionanswer += `\nQ${i + 1}: ${question}`;
    await qaRecord.save();

    qnoRecord.qno = (i + 1).toString();
    await qnoRecord.save();

    res.json({
      qno: i + 1,
      question,
      ragGrounded: ragContext.length > 0,
    });
  } catch (error: any) {
    console.error('Interview Error:', error);
    if (error?.status === 503 || error?.status === 429) {
      res.status(503).json({ error: 'The AI model is currently experiencing high demand. Please try again in a few moments.' });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

export const addAnswer = async (req: Request, res: Response) => {
  try {
    const username = req.header('username') as string;
    const { answer } = req.body as any;

    let qaRecord = await QA.findOne({ username });
    if (!qaRecord) {
      qaRecord = new QA({ username, questionanswer: '' });
      await qaRecord.save();
    }

    let qnoRecord = await Qno.findOne({ username });
    if (!qnoRecord) return res.status(400).json({ error: 'No question found' });

    let i = parseInt(qnoRecord.qno, 10);
    qaRecord.questionanswer += `\nA${i}: ${answer}`;
    await qaRecord.save();

    res.json({ message: 'Answer added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const resetInterview = async (req: Request, res: Response) => {
  try {
    const username = req.header('username') as string;
    await QA.deleteOne({ username });
    await Qno.deleteOne({ username });
    res.json({ message: 'true' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const checkScoreHistory = async (req: AuthRequest, res: Response) => {
  const username = req.username;
  const userScore = await Score.findOne({ username });
  if (!userScore) return res.json({ validUser: true, array: [], suggestion: 'No score history found.' });

  const lastScores = userScore.lastscore.split('_').filter(s => s !== '').map(Number);
  const lastFive = lastScores.slice(-5);

  if (lastFive.length >= 5) {
    const prompt = `Analyze the progress of the user's last 5 scores: ${lastFive}`;
    let suggestion = '';
    try {
      const result: any = await model.generateContent(prompt);
      suggestion = await result.response.text();
    } catch {
      suggestion = 'Unable to generate suggestion.';
    }
    return res.json({ validUser: true, array: lastFive, suggestion });
  }
  return res.json({ validUser: true, array: lastFive, suggestion: 'Not enough scores to analyze.' });
};

export const resumeAnalysis = async (req: any, res: Response) => {
  try {
    const { profile } = req.body as any;
    let resumeText = '';

    // Handle PDF file upload
    if (req.file) {
      try {
        const pdfModule = require('pdf-parse');
        const parseFn = typeof pdfModule === 'function'
          ? pdfModule
          : (typeof pdfModule?.default === 'function' ? pdfModule.default : null);

        if (parseFn) {
          const pdfData = await parseFn(req.file.buffer);
          resumeText = pdfData?.text || '';
        } else if (pdfModule?.PDFParse) {
          const parser = new pdfModule.PDFParse();
          const pdfData = await parser.parse(req.file.buffer);
          resumeText = pdfData?.text || '';
        } else {
          throw new Error(`pdf-parse is neither a function nor contains PDFParse (type: ${typeof pdfModule})`);
        }
      } catch (pdfErr: any) {
        console.error('Failed to parse uploaded PDF buffer:', pdfErr);
        return res.status(400).json({ error: 'Could not parse the PDF file. Please verify it is a valid PDF and not password protected.' });
      }
    } else if (req.body.resume) {
      // Fallback: accept raw text in body
      resumeText = req.body.resume;
    }

    if (!resumeText || !profile) {
      return res.status(400).json({ error: 'Resume file and target profile are required.' });
    }

    if (resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract enough text from the resume. Please upload a valid PDF.' });
    }

    const feedbackPrompt = `You are an expert resume reviewer and career advisor. Analyze the following resume text for the target profile of "${profile}" and provide detailed, actionable feedback.

Resume Text:
${resumeText}

Return ONLY a valid JSON object with exactly this structure (no markdown, no code fences, no commentary):
{
  "score": "7",
  "summary": "A 2-3 sentence overall assessment of the resume quality and fit for the ${profile} role.",
  "strengths": [
    "First specific strength with explanation",
    "Second specific strength with explanation",
    "Third specific strength with explanation"
  ],
  "improvements": [
    "First specific improvement area with actionable advice",
    "Second specific improvement area with actionable advice",
    "Third specific improvement area with actionable advice"
  ],
  "missing_skills": [
    "Important skill/technology missing for the ${profile} role",
    "Another missing skill"
  ],
  "formatting_tips": [
    "Specific formatting or structure suggestion",
    "Another formatting tip"
  ],
  "ats_score": "6",
  "ats_feedback": "Brief assessment of how well this resume would perform with Applicant Tracking Systems."
}

Rules:
- "score" and "ats_score" must be single numbers from 1-10 as strings
- All array fields must contain 2-5 specific, detailed items
- Be constructive but honest
- Return ONLY the JSON object`;

    // Retry with exponential backoff
    const MAX_RETRIES = 3;
    let result: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent(feedbackPrompt);
        break;
      } catch (apiError: any) {
        const isRetryable = apiError?.status === 503 || apiError?.status === 429;
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw apiError;
        }
      }
    }

    let responseText = '';
    try {
      responseText = await result.response.text();
    } catch {
      responseText = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }
    responseText = responseText.trim();

    // Strip code fences
    responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Extract JSON object
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse resume analysis JSON:', responseText.substring(0, 300));
      return res.status(500).json({ error: 'AI returned an invalid response. Please try again.' });
    }

    // Normalize
    parsed = {
      score: String(parsed.score || '0'),
      summary: parsed.summary || 'No summary available.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [parsed.strengths || 'N/A'],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [parsed.improvements || 'N/A'],
      missing_skills: Array.isArray(parsed.missing_skills) ? parsed.missing_skills : [],
      formatting_tips: Array.isArray(parsed.formatting_tips) ? parsed.formatting_tips : [],
      ats_score: String(parsed.ats_score || '0'),
      ats_feedback: parsed.ats_feedback || 'No ATS feedback available.',
      resumeText
    };

    res.json(parsed);
  } catch (error: any) {
    console.error('Resume Analysis Error:', error);
    if (error?.status === 503 || error?.status === 429) {
      res.status(503).json({ error: 'The AI model is currently experiencing high demand. Please try again shortly.' });
    } else {
      res.status(500).json({ error: 'Failed to analyze resume. Please try again.' });
    }
  }
};

export const getImage = async (req: Request, res: Response) => {
  const username = req.headers['username'] as string;
  if (!username) return res.status(400).json({ error: 'Username required' });
  try {
    const img = await ImageModel.findOne({ username });
    res.json({ image: img?.image || null });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const addImage = async (req: Request, res: Response) => {
  const { username, image } = req.body as any;
  if (!username || !image) return res.status(400).json({ error: 'Username and image required' });
  try {
    const existing = await ImageModel.findOne({ username });
    if (existing) {
      existing.image = image;
      await existing.save();
    } else {
      await new ImageModel({ username, image }).save();
    }
    res.json({ message: 'Image processed' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
};

export const transcribeAudio = async (req: any, res: Response) => {
  try {
    const buffer = req.file.buffer;
    const transcript: any = await assemblyClient.transcripts.transcribe({ audio: buffer });
    res.json({ text: transcript.text });
  } catch (err: any) {
    res.status(500).send({ error: err.message });
  }
};

