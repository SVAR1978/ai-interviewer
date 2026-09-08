import { GoogleGenerativeAI } from '@google/generative-ai';
import { JobDescription, JDChunk, IJobDescription, IJDChunk } from '../models';
import { config } from '../config/env';

const genAI = new GoogleGenerativeAI(config.geminiKey);
const embeddingModel = genAI.getGenerativeModel({ model: config.geminiEmbeddingModel });
const generativeModel = genAI.getGenerativeModel({ model: config.geminiModel });

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChunkResult {
  chunkText: string;
  section: string;
  chunkIndex: number;
}

export interface GapAnalysis {
  missingSkills: string[];
  weakAreas: string[];
  strengthAreas: string[];
  overallFit: string;
  recommendations: string;
}

// ─── Embedding ───────────────────────────────────────────────────────────────

/**
 * Generate a 768-dimensional embedding vector using Gemini's text-embedding-004 model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Section header patterns commonly found in job descriptions.
 */
const SECTION_PATTERNS: { pattern: RegExp; section: string }[] = [
  { pattern: /\b(requirements?|required|must\s+have|minimum\s+qualifications?)\b/i, section: 'requirements' },
  { pattern: /\b(responsibilities|duties|what\s+you.?ll\s+do|role)\b/i, section: 'responsibilities' },
  { pattern: /\b(qualifications?|preferred|nice\s+to\s+have|bonus|desired)\b/i, section: 'qualifications' },
  { pattern: /\b(skills?|tech\s*stack|technologies|tools)\b/i, section: 'skills' },
  { pattern: /\b(about\s+the\s+company|who\s+we\s+are|about\s+us)\b/i, section: 'about' },
  { pattern: /\b(benefits?|perks|compensation|salary)\b/i, section: 'benefits' },
  { pattern: /\b(experience|years?\s+of\s+experience)\b/i, section: 'experience' },
];

/**
 * Detect the section type of a text chunk based on keyword matching.
 */
function detectSection(text: string): string {
  for (const { pattern, section } of SECTION_PATTERNS) {
    if (pattern.test(text)) return section;
  }
  return 'general';
}

/**
 * Split job description text into semantic chunks.
 * First attempts section-based splitting (by common JD headings),
 * then falls back to overlapping window chunking for unstructured text.
 */
export function chunkJobDescription(rawText: string): ChunkResult[] {
  const chunks: ChunkResult[] = [];

  // Try splitting by common section delimiters (lines that look like headers)
  const headerRegex = /^(?:#{1,3}\s+|[A-Z][A-Za-z\s&/,]+:\s*$|\*{2}[A-Za-z\s&/,]+\*{2}\s*$)/gm;
  const sections = rawText.split(headerRegex).filter(s => s.trim().length > 30);

  if (sections.length >= 3) {
    // Section-based chunking worked well
    let idx = 0;
    for (const section of sections) {
      const trimmed = section.trim();
      if (trimmed.length < 30) continue;

      // If a section is too long, sub-chunk it with overlapping windows
      if (trimmed.length > 800) {
        const subChunks = windowChunk(trimmed, 500, 100);
        for (const sub of subChunks) {
          chunks.push({
            chunkText: sub,
            section: detectSection(sub),
            chunkIndex: idx++,
          });
        }
      } else {
        chunks.push({
          chunkText: trimmed,
          section: detectSection(trimmed),
          chunkIndex: idx++,
        });
      }
    }
  }

  // Fallback: overlapping window chunking
  if (chunks.length === 0) {
    const windows = windowChunk(rawText, 500, 100);
    windows.forEach((text, idx) => {
      chunks.push({
        chunkText: text,
        section: detectSection(text),
        chunkIndex: idx,
      });
    });
  }

  return chunks;
}

/**
 * Split text into overlapping windows of `size` characters with `overlap` character overlap.
 */
function windowChunk(text: string, size: number, overlap: number): string[] {
  const results: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) results.push(chunk);
    start += size - overlap;
  }
  return results;
}

// ─── Ingestion ───────────────────────────────────────────────────────────────

/**
 * Full ingestion pipeline: chunk the JD text, generate embeddings, store everything in MongoDB.
 */
export async function ingestJobDescription(
  username: string,
  title: string,
  company: string,
  rawText: string
): Promise<IJobDescription> {
  // 1. Create the parent JD document
  const jd = new JobDescription({
    username,
    title,
    company: company || '',
    rawText,
    chunkCount: 0,
  });
  await jd.save();

  // 2. Chunk the text
  const chunks = chunkJobDescription(rawText);

  // 3. Generate embeddings for each chunk (batched sequentially to respect rate limits)
  const chunkDocs: any[] = [];
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.chunkText);
    chunkDocs.push({
      jobDescriptionId: jd._id,
      username,
      chunkText: chunk.chunkText,
      chunkIndex: chunk.chunkIndex,
      embedding,
      section: chunk.section,
    });
  }

  // 4. Bulk insert all chunks
  if (chunkDocs.length > 0) {
    await JDChunk.insertMany(chunkDocs);
  }

  // 5. Update chunk count on parent
  jd.chunkCount = chunkDocs.length;
  await jd.save();

  return jd;
}

// ─── Retrieval ───────────────────────────────────────────────────────────────

// ─── BM25 Sparse Keyword Retrieval Engine ─────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

export class BM25Index {
  private k1: number;
  private b: number;
  private docCount: number = 0;
  private avgDocLength: number = 0;
  private docTermFreqs: Map<string, Map<string, number>> = new Map();
  private docLengths: Map<string, number> = new Map();
  private docFreqs: Map<string, number> = new Map();

  constructor(k1: number = 1.2, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  public addDocuments(docs: { id: string; text: string }[]): void {
    this.docCount = docs.length;
    let totalLength = 0;

    for (const doc of docs) {
      const tokens = tokenizeText(doc.text);
      const docLen = tokens.length;
      totalLength += docLen;
      this.docLengths.set(doc.id, docLen);

      const tfMap = new Map<string, number>();
      const seenTerms = new Set<string>();

      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
        if (!seenTerms.has(token)) {
          seenTerms.add(token);
          this.docFreqs.set(token, (this.docFreqs.get(token) || 0) + 1);
        }
      }

      this.docTermFreqs.set(doc.id, tfMap);
    }

    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 0;
  }

  public score(query: string, docId: string): number {
    const queryTokens = tokenizeText(query);
    const tfMap = this.docTermFreqs.get(docId);
    if (!tfMap) return 0;

    const docLen = this.docLengths.get(docId) || 0;
    let score = 0;

    for (const term of queryTokens) {
      const tf = tfMap.get(term) || 0;
      if (tf === 0) continue;

      const df = this.docFreqs.get(term) || 0;
      const idf = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);

      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (this.avgDocLength || 1)));

      score += Math.max(0, idf) * (numerator / denominator);
    }

    return score;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export interface HybridSearchResult extends IJDChunk {
  similarity: number;
  denseSimilarity: number;
  bm25Score: number;
  rrfScore: number;
}

/**
 * Executes Hybrid Retrieval combining Dense Vector Embeddings and BM25 Sparse Keyword Matching
 * using Reciprocal Rank Fusion (RRF) with constant k=60.
 */
function performHybridRanking(
  chunks: any[],
  queryEmbedding: number[],
  query: string,
  topK: number = 5
): HybridSearchResult[] {
  if (chunks.length === 0) return [];

  // 1. Dense Cosine Similarity Ranking
  const denseScored = chunks.map(chunk => ({
    chunk,
    denseSimilarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  denseScored.sort((a, b) => b.denseSimilarity - a.denseSimilarity);

  const denseRankMap = new Map<string, number>();
  denseScored.forEach((item, index) => {
    denseRankMap.set(String(item.chunk._id), index + 1);
  });

  // 2. BM25 Sparse Keyword Ranking
  const bm25 = new BM25Index(1.2, 0.75);
  bm25.addDocuments(
    chunks.map(c => ({
      id: String(c._id),
      text: `${c.section} ${c.chunkText}`,
    }))
  );

  const bm25Scored = chunks.map(chunk => ({
    chunk,
    bm25Score: bm25.score(query, String(chunk._id)),
  }));
  bm25Scored.sort((a, b) => b.bm25Score - a.bm25Score);

  const bm25RankMap = new Map<string, number>();
  bm25Scored.forEach((item, index) => {
    bm25RankMap.set(String(item.chunk._id), index + 1);
  });

  // 3. Reciprocal Rank Fusion (RRF) with k=60 & Convex Score Normalization
  const maxDense = denseScored[0]?.denseSimilarity || 1;
  const minDense = denseScored[denseScored.length - 1]?.denseSimilarity || 0;
  const denseRange = maxDense - minDense || 1;

  const maxBM25 = bm25Scored[0]?.bm25Score || 1;
  const minBM25 = bm25Scored[bm25Scored.length - 1]?.bm25Score || 0;
  const bm25Range = maxBM25 - minBM25 || 1;

  const RRF_K = 60;
  const hybridResults: HybridSearchResult[] = chunks.map(chunk => {
    const chunkId = String(chunk._id);
    const denseRank = denseRankMap.get(chunkId) || chunks.length;
    const bm25Rank = bm25RankMap.get(chunkId) || chunks.length;

    const rrfScore = (1 / (RRF_K + denseRank)) + (1 / (RRF_K + bm25Rank));

    const denseSim = denseScored.find(d => String(d.chunk._id) === chunkId)?.denseSimilarity || 0;
    const bm25Val = bm25Scored.find(b => String(b.chunk._id) === chunkId)?.bm25Score || 0;

    const normDense = (denseSim - minDense) / denseRange;
    const normBM25 = (bm25Val - minBM25) / bm25Range;
    const normalizedHybrid = Math.round(((0.65 * normDense) + (0.35 * normBM25)) * 100) / 100;

    return {
      ...chunk,
      similarity: normalizedHybrid,
      denseSimilarity: Math.round(denseSim * 1000) / 1000,
      bm25Score: Math.round(bm25Val * 100) / 100,
      rrfScore: Math.round(rrfScore * 10000) / 10000,
    };
  });

  // Sort by RRF score descending
  hybridResults.sort((a, b) => b.rrfScore - a.rrfScore);
  return hybridResults.slice(0, topK);
}

/**
 * Retrieve the top-K most relevant JD chunks using Hybrid Search (Dense + BM25 via RRF).
 */
export async function retrieveRelevantChunks(
  query: string,
  username: string,
  topK: number = 5
): Promise<HybridSearchResult[]> {
  const allChunks = await JDChunk.find({ username }).lean();
  if (allChunks.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  return performHybridRanking(allChunks, queryEmbedding, query, topK);
}

/**
 * Retrieve relevant chunks scoped to a specific job description ID using Hybrid Search.
 */
export async function retrieveChunksForJD(
  query: string,
  jobDescriptionId: string,
  topK: number = 5
): Promise<HybridSearchResult[]> {
  const chunks = await JDChunk.find({ jobDescriptionId }).lean();
  if (chunks.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  return performHybridRanking(chunks, queryEmbedding, query, topK);
}

// ─── Gap Analysis ────────────────────────────────────────────────────────────

/**
 * Analyze gaps between a resume and stored job descriptions.
 * Retrieves the most relevant JD chunks for the resume content,
 * then asks Gemini to identify missing skills and weak areas.
 */
export async function analyzeResumeGaps(
  resumeText: string,
  username: string
): Promise<GapAnalysis> {
  // 1. Retrieve relevant JD chunks
  const relevantChunks = await retrieveRelevantChunks(resumeText, username, 10);

  if (relevantChunks.length === 0) {
    return {
      missingSkills: [],
      weakAreas: [],
      strengthAreas: [],
      overallFit: 'No job descriptions found. Upload a job description first to get gap analysis.',
      recommendations: '',
    };
  }

  // 2. Build context from retrieved chunks
  const jdContext = relevantChunks
    .map((c, i) => `[JD Chunk ${i + 1} (${c.section})]: ${c.chunkText}`)
    .join('\n\n');

  // 3. Ask Gemini for structured gap analysis
  const prompt = `You are an expert career advisor. Analyze the candidate's resume against the job description requirements and provide a structured gap analysis.

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION REQUIREMENTS:
${jdContext}

Respond with ONLY a valid JSON object in this exact format (no markdown, no commentary):
{
  "missingSkills": ["skill1", "skill2", "..."],
  "weakAreas": ["area where candidate is weak relative to JD requirements"],
  "strengthAreas": ["area where candidate is strong match for JD requirements"],
  "overallFit": "A 2-3 sentence assessment of how well the candidate fits",
  "recommendations": "A 2-3 sentence actionable recommendation for the candidate"
}`;

  const result: any = await generativeModel.generateContent(prompt);
  let responseText: string = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';

  // Strip markdown code fences if present
  if (responseText.startsWith('```json')) {
    responseText = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
  } else if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```\s*/, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(responseText) as GapAnalysis;
  } catch {
    return {
      missingSkills: [],
      weakAreas: [],
      strengthAreas: [],
      overallFit: responseText,
      recommendations: 'Unable to parse structured analysis. See overall fit for details.',
    };
  }
}
