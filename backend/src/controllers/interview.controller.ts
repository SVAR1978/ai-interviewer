import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AssemblyAI } from 'assemblyai';
import { Score, QA, Qno, ImageModel } from '../models';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth.middleware';

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
    if (!q) return res.status(404).json({ error: 'No interview responses found' });

    const feedbackPrompt = `Analyze the following interview responses: ${q.questionanswer}\nProvide a structured JSON object with the following format: ... Only return valid JSON. Do not add commentary.`;

    const result: any = await model.generateContent(feedbackPrompt);
    let feedbackJson: string = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';

    if (feedbackJson.startsWith('```json')) {
      feedbackJson = feedbackJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(feedbackJson);
    } catch (e) {
      throw new Error('Failed to parse model output as JSON.');
    }

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
    const { domain } = req.body as any;

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
    let promptText = i === 0 
      ? `Generate a professional interview question in the domain of "${domain}".` 
      : `Based on this previous Q&A history, generate a relevant follow-up interview question in the domain of "${domain}":\n${qaRecord.questionanswer}Only output the question itself.`;

    const result: any = await model.generateContent(promptText);
    const question: string = await result.response.text();

    qaRecord.questionanswer += `\nQ${i + 1}: ${question}`;
    await qaRecord.save();

    qnoRecord.qno = (i + 1).toString();
    await qnoRecord.save();

    res.json({ qno: i + 1, question });
  } catch (error) {
    console.error('Interview Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
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

export const resumeAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const { resume, profile } = req.body as any;
    if (!resume || !profile) return res.status(400).json({ error: 'Resume and profile are required' });

    const prompts = [
      `${resume} Score my resume for ${profile} out of 10.`,
      `${resume} Good things about my resume for ${profile} (50-70 words).`,
      `${resume} Improvement points for ${profile} (50-70 words).`
    ];

    const results = await Promise.all(prompts.map(p => model.generateContent(p)));
    
    res.json({
      score: results[0].response.text(),
      goodPoints: results[1].response.text(),
      improvementPoints: results[2].response.text(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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
