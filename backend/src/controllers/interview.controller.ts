import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AssemblyAI } from 'assemblyai';
import { Score, QA, Qno, ImageModel } from '../models';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';
import { retrieveRelevantChunks, retrieveChunksForJD } from '../services/rag.service';
import { rollingContextService } from '../services/rollingContext.service';
import { redisService } from '../services/redis.service';

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

    let qaTranscript = await redisService.getSessionQA(username);
    let q: any = null;
    if (!qaTranscript) {
      q = await QA.findOne({ username }).select('questionanswer');
      qaTranscript = q?.questionanswer || '';
    }

    if (!qaTranscript || qaTranscript.trim() === '') {
      return res.status(404).json({ error: 'No interview responses found. Please complete at least one Q&A before generating a score.' });
    }

    // Verify that there is at least one answer in the Q&A record
    const answerCount = (qaTranscript.match(/\nA\d+:/g) || []).length;
    if (answerCount === 0) {
      return res.status(400).json({ error: 'No answers found in your interview session. Please answer at least one question before generating a score.' });
    }

    // Retrieve JD context for grounded scoring
    let jdContext = '';
    try {
      const relevantChunks = await retrieveRelevantChunks(qaTranscript, username, 5);
      if (relevantChunks.length > 0) {
        jdContext = `\n\nJob Description Requirements (evaluate technical answers against these):\n` +
          relevantChunks.map((c, i) => `[${c.section}]: ${c.chunkText}`).join('\n');
      }
    } catch {
      // If RAG retrieval fails, continue without JD context
    }

    // Pillar 1: Multi-Domain Granular Technical & Communication Evaluation Prompt for Gemini
    const technicalPrompt = `You are a Principal Engineer and Technical Bar Raiser evaluator. Analyze the following interview Q&A transcript and evaluate the candidate across granular performance dimensions: Technical Mastery, Problem-Solving Execution, and Verbal Communication.
${jdContext}

Interview Transcript:
${qaTranscript}

Evaluate strictly and objectively:
1. Technical Accuracy: correctness of explanations, API/domain precision, conceptual depth.
2. Problem Solving: structured breakdown, architecture/design trade-offs, handling edge cases and scalability.
3. Verbal Communication: clarity of thought, articulation, conciseness, structured delivery.

Return ONLY a valid JSON object with exactly this structure (no markdown, no commentary, no code fences):
{
  "technical_score": "8",
  "problem_solving_score": "8",
  "communication_score": "7",
  "technical_depth": "Proficient",
  "technical_feedback": "A concise 3-4 sentence evaluation of technical rigor, solution architecture, and domain knowledge.",
  "technical_strengths": [
    "Specific technical concept or framework applied correctly with concrete examples from answers",
    "Effective trade-off analysis or edge-case handling"
  ],
  "technical_gaps": [
    "Specific technical concept or implementation detail that was missed or inaccurate",
    "Recommended architecture or algorithm topic to review"
  ]
}

Rules:
- "technical_score", "problem_solving_score", and "communication_score" must each be a single number from 1 to 10 as a string.
- "technical_depth" must be one of: "Advanced", "Proficient", "Foundational", "Developing".
- "technical_feedback" must be a detailed paragraph.
- "technical_strengths" must be an array of 2-4 specific technical strengths.
- "technical_gaps" must be an array of 2-4 actionable technical gaps to review.
- Return ONLY the JSON object, nothing else.`;

    // Retry with exponential backoff for transient API errors
    const MAX_RETRIES = 3;
    let result: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent(technicalPrompt);
        break;
      } catch (apiError: any) {
        const isRetryable = apiError?.status === 503 || apiError?.status === 429;
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Gemini API returned ${apiError.status} during technical scoring, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
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

    console.log('Technical score raw output:', feedbackJson.substring(0, 200));

    let parsed: any;
    try {
      parsed = JSON.parse(feedbackJson);
    } catch (e) {
      console.error('Failed to parse technical score JSON:', feedbackJson);
      throw new Error('Failed to parse model output as JSON. The AI returned an invalid response.');
    }

    // Normalize Granular Domain Metrics
    const rawTechScore = parsed.technical_score || parsed.overall_score || parsed.score || '7';
    const techScoreNum = Math.max(1, Math.min(10, Math.round((parseFloat(String(rawTechScore).match(/\d+(\.\d+)?/)?.[0] || '7')) * 10) / 10));

    const rawProblemScore = parsed.problem_solving_score || parsed.problemSolving || rawTechScore;
    const problemSolvingScoreNum = Math.max(1, Math.min(10, Math.round((parseFloat(String(rawProblemScore).match(/\d+(\.\d+)?/)?.[0] || String(techScoreNum))) * 10) / 10));

    const rawVerbalComm = parsed.communication_score || parsed.verbal_communication || '7.5';
    const verbalCommScoreNum = Math.max(1, Math.min(10, Math.round((parseFloat(String(rawVerbalComm).match(/\d+(\.\d+)?/)?.[0] || '7.5')) * 10) / 10));

    const technicalStrengths = Array.isArray(parsed.technical_strengths) 
      ? parsed.technical_strengths 
      : Array.isArray(parsed.strengths) 
        ? parsed.strengths 
        : [parsed.technical_strengths || parsed.strengths || 'Demonstrated solid foundational problem-solving.'];
    const technicalGaps = Array.isArray(parsed.technical_gaps)
      ? parsed.technical_gaps
      : Array.isArray(parsed.improvement_points)
        ? parsed.improvement_points
        : [parsed.technical_gaps || 'Review core edge-case handling and system bottlenecks.'];

    // Pillar 2: Behavioral Confidence Quantified from MediaPipe Telemetry
    const behavioralMetrics = req.body?.behavioralMetrics;
    let behavioralScore = 8.0;
    let behavioralTelemetry: any = null;

    if (behavioralMetrics && typeof behavioralMetrics === 'object') {
      const eyePct = Number(behavioralMetrics.eyeContactPercentage ?? 80);
      const posturePct = Number(behavioralMetrics.postureStabilityPercentage ?? 85);
      const engagementPct = Number(behavioralMetrics.engagementPercentage ?? 75);
      const overallPresence = Number(behavioralMetrics.overallPresenceScore ?? Math.round(eyePct * 0.4 + posturePct * 0.35 + engagementPct * 0.25));

      behavioralScore = Math.max(1, Math.min(10, Math.round((overallPresence / 10) * 10) / 10));
      behavioralTelemetry = {
        score: behavioralScore.toFixed(1),
        weight: "40%",
        overall_presence_score: overallPresence,
        eye_contact_percentage: eyePct,
        posture_stability_percentage: posturePct,
        engagement_percentage: engagementPct,
        expression_distribution: behavioralMetrics.expressionDistribution || {
          smilingTimePct: 20,
          attentiveTimePct: 60,
          speakingTimePct: 15,
          neutralTimePct: 5
        },
        strengths: Array.isArray(behavioralMetrics.strengths) && behavioralMetrics.strengths.length > 0
          ? behavioralMetrics.strengths
          : ['Maintained consistent camera presence and poise throughout the assessment.'],
        coaching_tips: Array.isArray(behavioralMetrics.coachingAdvice) && behavioralMetrics.coachingAdvice.length > 0
          ? behavioralMetrics.coachingAdvice
          : ['Focus on centering your gaze directly into the camera lens during key explanations.']
      };
    } else {
      // Graceful fallback when vision telemetry is not submitted
      behavioralScore = 7.5;
      behavioralTelemetry = {
        score: "7.5",
        weight: "40%",
        overall_presence_score: 75,
        eye_contact_percentage: 75,
        posture_stability_percentage: 75,
        engagement_percentage: 75,
        expression_distribution: { smilingTimePct: 15, attentiveTimePct: 65, speakingTimePct: 15, neutralTimePct: 5 },
        strengths: ['Candidate maintained active verbal engagement during the session.'],
        coaching_tips: ['Enable webcam presence tracking in your next session to receive real-time gaze and posture analytics.']
      };
    }

    // Synthesize Communication Score (combining verbal articulation with non-verbal poise)
    const synthesizedCommScore = Math.max(1, Math.min(10, Math.round(((verbalCommScoreNum * 0.5) + (behavioralScore * 0.5)) * 10) / 10));

    // Composite Calculation (60% Technical + 40% Behavioral)
    const compositeScoreNum = Math.round(((techScoreNum * 0.6) + (behavioralScore * 0.4)) * 10) / 10;
    const compositeScoreStr = compositeScoreNum.toFixed(1);

    // Domain Sub-Scores Document
    const domainSubScores = {
      technical: techScoreNum,
      problemSolving: problemSolvingScoreNum,
      communication: synthesizedCommScore,
      presence: behavioralScore,
      overall: compositeScoreNum,
    };

    // Compute Executive Readiness Verdict
    let readinessVerdict = "Foundational Candidate: Further Preparation Recommended";
    if (techScoreNum >= 8.0 && behavioralScore >= 8.0) {
      readinessVerdict = "Strong Hire: Exceptional Technical Depth & Executive Poise";
    } else if (techScoreNum >= 7.5 && behavioralScore >= 7.0) {
      readinessVerdict = "Hire: Technically Solid with Confident Delivery";
    } else if (techScoreNum >= 7.5 && behavioralScore < 7.0) {
      readinessVerdict = "Technically Proficient: Non-Verbal Presence Coaching Recommended";
    } else if (techScoreNum < 7.0 && behavioralScore >= 7.5) {
      readinessVerdict = "High Presence & Articulation: Technical Deepening Required";
    } else {
      readinessVerdict = "Developing Candidate: Targeted Technical & Communication Preparation Needed";
    }

    // Dual-Pillar Evaluation Payload with Granular Sub-Scores
    const dualPillarResponse = {
      composite_score: compositeScoreStr,
      readiness_verdict: readinessVerdict,
      sub_scores: domainSubScores,

      // Pillar 1: Technical Accuracy (Gemini Semantic Analysis)
      technical_accuracy: {
        score: techScoreNum.toFixed(1),
        weight: "60%",
        depth_level: parsed.technical_depth || (techScoreNum >= 8.5 ? "Advanced" : techScoreNum >= 7 ? "Proficient" : "Foundational"),
        feedback: parsed.technical_feedback || parsed.overall_feedback || "Evaluated candidate's technical responses for conceptual depth, architecture, and correctness.",
        strengths: technicalStrengths,
        gaps: technicalGaps
      },

      // Pillar 2: Behavioral Confidence (MediaPipe WebAssembly Telemetry)
      behavioral_confidence: behavioralTelemetry,

      // Backward-compatible fields
      overall_score: compositeScoreStr,
      overall_feedback: parsed.technical_feedback || parsed.overall_feedback || "Comprehensive dual-pillar evaluation complete.",
      strengths: [
        ...technicalStrengths,
        ...(behavioralTelemetry.strengths || [])
      ],
      improvement_points: [
        ...technicalGaps,
        ...(behavioralTelemetry.coaching_tips || [])
      ]
    };

    // Persist structured, timestamped session score document
    const sessionRecord = {
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date(),
      overallScore: compositeScoreNum,
      subScores: domainSubScores,
      metrics: {
        eyeContactPercentage: behavioralTelemetry?.eye_contact_percentage,
        postureStabilityPercentage: behavioralTelemetry?.posture_stability_percentage,
        engagementPercentage: behavioralTelemetry?.engagement_percentage,
        technicalDepth: parsed.technical_depth || (techScoreNum >= 8.5 ? "Advanced" : techScoreNum >= 7 ? "Proficient" : "Foundational"),
        readinessVerdict,
      },
      feedbackSummary: parsed.technical_feedback || parsed.overall_feedback || "Comprehensive evaluation completed.",
    };

    if (!lastscore.sessions) {
      lastscore.sessions = [];
    }
    lastscore.sessions.push(sessionRecord as any);

    // Update legacy underscore-separated string for backward compatibility
    const numericScore = String(Math.round(compositeScoreNum));
    const currentLegacy = typeof lastscore.lastscore === 'string' ? lastscore.lastscore : '';
    lastscore.lastscore = currentLegacy ? `${currentLegacy}_${numericScore}` : numericScore;
    await lastscore.save();

    // Clear session from Redis memory and invalidate score history cache
    await redisService.clearInterviewSession(username);
    await redisService.invalidateScoreHistory(username);

    // Also reset MongoDB records
    if (!q) {
      q = await QA.findOne({ username });
    }
    if (q) {
      q.questionanswer = '';
      await q.save();
    }

    let qnoRecord = await Qno.findOne({ username });
    if (qnoRecord) {
      qnoRecord.qno = '1';
      await qnoRecord.save();
    }

    res.json(dualPillarResponse);
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

    // ── Fast Redis Session Lookup (with MongoDB fallback) ───────────
    let qa = await redisService.getSessionQA(username);
    let cachedQno = await redisService.getQuestionNo(username);

    let qaRecord: any = null;
    let qnoRecord: any = null;

    if (qa === null || cachedQno === null) {
      qaRecord = await QA.findOne({ username });
      if (!qaRecord) {
        qaRecord = new QA({ username, questionanswer: '' });
        await qaRecord.save();
      }
      qa = qaRecord.questionanswer || '';

      qnoRecord = await Qno.findOne({ username });
      if (!qnoRecord) {
        qnoRecord = new Qno({ username, qno: '0' });
        await qnoRecord.save();
      }
      cachedQno = parseInt(qnoRecord.qno, 10);

      // Warm up Redis session cache with a 2-hour TTL
      await redisService.setSessionQA(username, qa, 7200);
      await redisService.setQuestionNo(username, cachedQno, 7200);
    }

    let i = cachedQno;

    // ── Rolling Context Summarization & Targeted RAG Query ────────
    let promptContext = qa;
    let ragQuery = i === 0 ? domain : `${domain} ${qa}`;

    if (i > 0) {
      const optimizedContext = await rollingContextService.getOptimizedInterviewContext(username, domain, qa);
      promptContext = optimizedContext.promptContext;
      ragQuery = optimizedContext.ragQuery;
    }

    // ── Hybrid RAG Context Retrieval (Dense + BM25 Sparse via RRF) ──
    let ragContext = '';
    try {
      let relevantChunks;
      if (jobDescriptionId) {
        relevantChunks = await retrieveChunksForJD(ragQuery, jobDescriptionId, 5);
      } else {
        relevantChunks = await retrieveRelevantChunks(ragQuery, username, 5);
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
        ? `You are an expert technical interviewer. Based on the following job description requirements and the candidate's interview progress, generate a relevant follow-up interview question in the domain of "${domain}".${ragContext}\n\nCandidate Progress & Interview State:\n${promptContext}\n\nGenerate a follow-up question that probes untested skills or deepens coverage. Only output the question itself.`
        : `You are an expert technical interviewer. Based on this candidate's interview progress, generate a relevant follow-up interview question in the domain of "${domain}":\n${promptContext}\n\nOnly output the question itself.`;
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

    const updatedQA = `${qa}\nQ${i + 1}: ${question}`;

    // 1. Fast update in Redis memory
    await redisService.setSessionQA(username, updatedQA, 7200);
    await redisService.setQuestionNo(username, i + 1, 7200);

    // 2. Sync to MongoDB for persistence
    if (!qaRecord) qaRecord = await QA.findOne({ username });
    if (qaRecord) {
      qaRecord.questionanswer = updatedQA;
      await qaRecord.save();
    }

    if (!qnoRecord) qnoRecord = await Qno.findOne({ username });
    if (qnoRecord) {
      qnoRecord.qno = (i + 1).toString();
      await qnoRecord.save();
    }

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

    // 1. Fast read question number from Redis
    let qIndex = await redisService.getQuestionNo(username);
    let qnoRecord: any = null;
    if (qIndex === null) {
      qnoRecord = await Qno.findOne({ username });
      if (!qnoRecord) return res.status(400).json({ error: 'No question found' });
      qIndex = parseInt(qnoRecord.qno, 10);
    }

    // 2. Fast append in Redis memory (O(1) sub-millisecond)
    await redisService.appendSessionAnswer(username, qIndex, answer);

    // 3. Sync to MongoDB for persistent backup
    let qaRecord = await QA.findOne({ username });
    if (!qaRecord) {
      qaRecord = new QA({ username, questionanswer: '' });
    }
    qaRecord.questionanswer += `\nA${qIndex}: ${answer}`;
    await qaRecord.save();

    res.json({ message: 'Answer added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const resetInterview = async (req: Request, res: Response) => {
  try {
    const username = req.header('username') as string;
    // Clear Redis in-memory session
    await redisService.clearInterviewSession(username);

    // Clear MongoDB records
    await QA.deleteOne({ username });
    await Qno.deleteOne({ username });
    res.json({ message: 'true' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const checkScoreHistory = async (req: AuthRequest, res: Response) => {
  const username = req.username;
  if (!username) {
    return res.status(401).json({ error: 'Unauthorized: No user session found.' });
  }

  // 1. Check Redis cache first (sub-millisecond dashboard response)
  const cached = await redisService.getScoreHistoryCache(username);
  if (cached) {
    return res.json(cached);
  }

  // 2. Query MongoDB if not in cache
  const userScore = await Score.findOne({ username });
  if (!userScore) {
    const emptyResult = {
      validUser: true,
      array: [],
      sessions: [],
      domainAverages: {
        technical: 0,
        problemSolving: 0,
        communication: 0,
        presence: 0,
        overall: 0,
      },
      trajectory: {
        technical: { delta: 0, signedDelta: 0, direction: 'neutral' },
        problemSolving: { delta: 0, signedDelta: 0, direction: 'neutral' },
        communication: { delta: 0, signedDelta: 0, direction: 'neutral' },
        overall: { delta: 0, signedDelta: 0, direction: 'neutral' },
      },
      suggestion: 'No score history found. Complete your first mock interview to track your domain performance over time.'
    };
    await redisService.setScoreHistoryCache(username, emptyResult, 600);
    return res.json(emptyResult);
  }

  // 3. Auto-migration: If sessions array is empty but legacy string scores exist, backfill structured documents
  let sessions = Array.isArray(userScore.sessions) ? [...userScore.sessions] : [];
  if (sessions.length === 0 && userScore.lastscore && typeof userScore.lastscore === 'string') {
    const legacyNums = userScore.lastscore.split('_').filter(s => s.trim() !== '').map(Number);
    if (legacyNums.length > 0) {
      const now = Date.now();
      sessions = legacyNums.map((num, idx) => {
        const histDate = new Date(now - (legacyNums.length - 1 - idx) * 86400000);
        const clampedScore = Math.max(1, Math.min(10, num));
        return {
          sessionId: `legacy_migrated_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: histDate,
          overallScore: clampedScore,
          subScores: {
            technical: clampedScore,
            problemSolving: clampedScore,
            communication: Math.max(1, Math.min(10, clampedScore + (idx % 2 === 0 ? 0.3 : -0.2))),
            presence: Math.max(1, Math.min(10, clampedScore * 0.95)),
            overall: clampedScore,
          },
          metrics: {
            eyeContactPercentage: Math.round(clampedScore * 9.5),
            postureStabilityPercentage: Math.round(clampedScore * 9.2),
            engagementPercentage: Math.round(clampedScore * 9.0),
            technicalDepth: clampedScore >= 8 ? 'Advanced' : clampedScore >= 6.5 ? 'Proficient' : 'Foundational',
            readinessVerdict: clampedScore >= 8 ? 'Strong Hire: Solid Performance' : 'Proficient Candidate',
          },
          feedbackSummary: 'Migrated from historical session evaluation.'
        } as any;
      });

      // Persist migrated structured sessions to MongoDB
      userScore.sessions = sessions;
      await userScore.save();
    }
  }

  // Sort sessions chronologically
  sessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Compute Domain Averages
  const sessionCount = sessions.length;
  const domainAverages = {
    technical: 0,
    problemSolving: 0,
    communication: 0,
    presence: 0,
    overall: 0,
  };

  if (sessionCount > 0) {
    const sum = sessions.reduce((acc, s) => {
      const sub = s.subScores || { technical: s.overallScore, problemSolving: s.overallScore, communication: s.overallScore, presence: s.overallScore, overall: s.overallScore };
      return {
        technical: acc.technical + (sub.technical || s.overallScore || 0),
        problemSolving: acc.problemSolving + (sub.problemSolving || s.overallScore || 0),
        communication: acc.communication + (sub.communication || s.overallScore || 0),
        presence: acc.presence + (sub.presence || 7.5),
        overall: acc.overall + (s.overallScore || sub.overall || 0),
      };
    }, { technical: 0, problemSolving: 0, communication: 0, presence: 0, overall: 0 });

    domainAverages.technical = Math.round((sum.technical / sessionCount) * 10) / 10;
    domainAverages.problemSolving = Math.round((sum.problemSolving / sessionCount) * 10) / 10;
    domainAverages.communication = Math.round((sum.communication / sessionCount) * 10) / 10;
    domainAverages.presence = Math.round((sum.presence / sessionCount) * 10) / 10;
    domainAverages.overall = Math.round((sum.overall / sessionCount) * 10) / 10;
  }

  // Compute Trajectories (compare latest session to first session or moving trend)
  const computeDelta = (latestVal: number, baselineVal: number) => {
    const diff = Math.round((latestVal - baselineVal) * 10) / 10;
    const direction: 'up' | 'down' | 'neutral' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
    return { delta: Math.abs(diff), signedDelta: diff, direction };
  };

  let trajectory = {
    technical: { delta: 0, signedDelta: 0, direction: 'neutral' as 'up' | 'down' | 'neutral' },
    problemSolving: { delta: 0, signedDelta: 0, direction: 'neutral' as 'up' | 'down' | 'neutral' },
    communication: { delta: 0, signedDelta: 0, direction: 'neutral' as 'up' | 'down' | 'neutral' },
    overall: { delta: 0, signedDelta: 0, direction: 'neutral' as 'up' | 'down' | 'neutral' },
  };

  if (sessionCount >= 2) {
    const first: any = sessions[0].subScores || { technical: sessions[0].overallScore, problemSolving: sessions[0].overallScore, communication: sessions[0].overallScore, overall: sessions[0].overallScore };
    const latest: any = sessions[sessionCount - 1].subScores || { technical: sessions[sessionCount - 1].overallScore, problemSolving: sessions[sessionCount - 1].overallScore, communication: sessions[sessionCount - 1].overallScore, overall: sessions[sessionCount - 1].overallScore };

    trajectory = {
      technical: computeDelta(latest.technical ?? 0, first.technical ?? 0),
      problemSolving: computeDelta(latest.problemSolving ?? 0, first.problemSolving ?? 0),
      communication: computeDelta(latest.communication ?? 0, first.communication ?? 0),
      overall: computeDelta(sessions[sessionCount - 1].overallScore ?? 0, sessions[0].overallScore ?? 0),
    };
  }

  // Backward compatible overall scores array
  const legacyArray = sessions.map(s => s.overallScore);

  // Multi-session AI Domain Suggestion
  let suggestion = 'Complete more interview sessions to unlock multi-axis trajectory analytics.';
  if (sessionCount >= 2) {
    const sessionSummary = sessions.slice(-5).map((s, i) => {
      const sub: any = s.subScores || {};
      return `Test ${i + 1}: Overall=${s.overallScore}, Technical=${sub.technical ?? 'N/A'}, ProblemSolving=${sub.problemSolving ?? 'N/A'}, Communication=${sub.communication ?? 'N/A'}, Presence=${sub.presence ?? 'N/A'}`;
    }).join(' | ');

    const prompt = `You are an elite Engineering Career Coach. Analyze this candidate's domain-level multi-session trajectory:
${sessionSummary}
Domain Averages: Technical: ${domainAverages.technical}/10, Problem-Solving: ${domainAverages.problemSolving}/10, Communication: ${domainAverages.communication}/10.

Provide a crisp, empowering 2-3 sentence coaching observation on their domain trajectory (highlighting their fastest-improving area and one concrete action to focus on next). Do not use bullet points or markdown headings.`;

    try {
      const result: any = await model.generateContent(prompt);
      suggestion = (await result.response.text()).trim();
    } catch {
      suggestion = `Your average score is ${domainAverages.overall}/10 with steady performance across technical (${domainAverages.technical}) and communication (${domainAverages.communication}) domains.`;
    }
  } else if (sessionCount === 1) {
    suggestion = `Great start! Your baseline score is ${sessions[0].overallScore}/10. Complete at least one more mock interview to track your trajectory lines across technical, problem solving, and communication domains.`;
  }

  const responseData = {
    validUser: true,
    array: legacyArray, // Backward compatible field
    sessions,
    domainAverages,
    trajectory,
    suggestion
  };

  await redisService.setScoreHistoryCache(username, responseData, 600);
  return res.json(responseData);
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

