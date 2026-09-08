import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { redisService } from './redis.service';

const genAI = new GoogleGenerativeAI(config.geminiKey);
const model = genAI.getGenerativeModel({
  model: config.geminiModel,
  generationConfig: {
    temperature: 0.2, // Low temperature for high factual accuracy and concise distillation
    maxOutputTokens: 250, // Keep checkpoint very compact
  }
});

export interface Turn {
  qno: number;
  question: string;
  answer: string;
}

export interface OptimizedContextResult {
  promptContext: string;
  ragQuery: string;
  isSummarized: boolean;
  totalTurns: number;
}

class RollingContextService {
  /**
   * Parse raw transcript into structured Q&A turns.
   * Matches lines formatted as "Q1: ... \nA1: ..."
   */
  public parseTranscriptTurns(rawTranscript: string): Turn[] {
    if (!rawTranscript || rawTranscript.trim() === '') return [];

    const turns: Turn[] = [];
    const lines = rawTranscript.split('\n').map(l => l.trim()).filter(Boolean);

    let currentQno = 0;
    let currentQ = '';
    let currentA = '';

    for (const line of lines) {
      const qMatch = line.match(/^Q(\d+):\s*(.+)$/i);
      const aMatch = line.match(/^A(\d+):\s*(.+)$/i);

      if (qMatch) {
        // If we were already collecting a turn, commit it if it has an answer
        if (currentQno > 0 && currentA) {
          turns.push({
            qno: currentQno,
            question: currentQ,
            answer: currentA
          });
        }
        currentQno = parseInt(qMatch[1], 10);
        currentQ = qMatch[2].trim();
        currentA = '';
      } else if (aMatch) {
        const aNum = parseInt(aMatch[1], 10);
        if (aNum === currentQno) {
          currentA = aMatch[2].trim();
        } else {
          currentA = line.replace(/^A\d+:\s*/i, '').trim();
        }
      } else if (currentA) {
        currentA += ' ' + line;
      } else if (currentQ) {
        currentQ += ' ' + line;
      }
    }

    if (currentQno > 0 && currentA) {
      turns.push({
        qno: currentQno,
        question: currentQ,
        answer: currentA
      });
    }

    return turns;
  }

  /**
   * Generates a high-density semantic summary checkpoint for a set of historical Q&A turns.
   */
  private async summarizeHistoricalTurns(domain: string, historicalTurns: Turn[]): Promise<string> {
    if (historicalTurns.length === 0) return '';

    const formattedTurns = historicalTurns
      .map(t => `Q${t.qno}: ${t.question}\nA${t.qno}: ${t.answer}`)
      .join('\n\n');

    const prompt = `You are a technical interview state summarizer. Condense the following previous interview Q&A turns into a high-density, concise historical checkpoint for an interview in the domain of "${domain}".

Previous Q&A:
${formattedTurns}

Output exactly 3-4 bullet points in this format:
- Evaluated Topics: [comma-separated core topics covered]
- Key Demonstrated Strengths: [1-2 concise verified strengths]
- Unprobed/Weak Areas: [1-2 concepts where answers were surface-level or untested]
- Interview Momentum: [brief direction to probe next]

Do not include conversational pleasantries, markdown code fences, or extra text. Output only the bullet points.`;

    try {
      const result = await model.generateContent(prompt);
      const summaryText = result.response.text();
      return summaryText.trim();
    } catch (err) {
      console.warn('[RollingContextService] Error generating rolling summary, falling back to turn headlines:', err);
      return historicalTurns
        .map(t => `• Q${t.qno} covered: ${t.question.substring(0, 70)}...`)
        .join('\n');
    }
  }

  /**
   * Constructs an optimized, token-efficient context for next-question generation.
   * - Turns 1-2: Returns verbatim raw transcript (no summarization overhead).
   * - Turns 3+: Condenses turns 1 to N-1 into a high-density checkpoint, preserving Turn N verbatim.
   */
  public async getOptimizedInterviewContext(
    username: string,
    domain: string,
    fullTranscript: string
  ): Promise<OptimizedContextResult> {
    const turns = this.parseTranscriptTurns(fullTranscript);

    // If 2 or fewer turns, raw transcript is compact (<300 tokens); no summarization needed
    if (turns.length <= 2) {
      return {
        promptContext: fullTranscript,
        ragQuery: `${domain} ${fullTranscript}`.trim(),
        isSummarized: false,
        totalTurns: turns.length
      };
    }

    // Split into historical turns (1 to N-1) and immediate recent turn (N)
    const recentTurn = turns[turns.length - 1];
    const historicalTurns = turns.slice(0, turns.length - 1);

    // Check Redis for cached rolling summary checkpoint
    let historicalSummary = await redisService.getSessionSummary(username);

    if (!historicalSummary) {
      historicalSummary = await this.summarizeHistoricalTurns(domain, historicalTurns);
      if (historicalSummary) {
        await redisService.setSessionSummary(username, historicalSummary, 7200);
      }
    }

    // High-Density prompt structure
    const promptContext = `[HISTORICAL INTERVIEW STATE CHECKPOINT - TURNS 1-${historicalTurns.length} CONDENSED]
${historicalSummary}

[IMMEDIATE PRECEDING TURN]
Q${recentTurn.qno}: ${recentTurn.question}
A${recentTurn.qno}: ${recentTurn.answer}`;

    // Targeted RAG query focusing on domain, recent answer keywords, and active momentum
    const ragQuery = `${domain} ${recentTurn.question} ${recentTurn.answer}`.trim();

    return {
      promptContext,
      ragQuery,
      isSummarized: true,
      totalTurns: turns.length
    };
  }
}

export const rollingContextService = new RollingContextService();
