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

/**
 * Retrieve the top-K most relevant JD chunks for a given query.
 * Embeds the query, then computes cosine similarity against all of the user's stored chunks.
 */
export async function retrieveRelevantChunks(
  query: string,
  username: string,
  topK: number = 5
): Promise<(IJDChunk & { similarity: number })[]> {
  // 1. Check if chunks exist before calling embedding API
  const allChunks = await JDChunk.find({ username }).lean();
  if (allChunks.length === 0) return [];

  // 2. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 3. Compute similarities
  const scored = allChunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // 4. Sort by similarity descending and take top-K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK) as any;
}

/**
 * Retrieve relevant chunks scoped to a specific job description ID.
 */
export async function retrieveChunksForJD(
  query: string,
  jobDescriptionId: string,
  topK: number = 5
): Promise<(IJDChunk & { similarity: number })[]> {
  const chunks = await JDChunk.find({ jobDescriptionId }).lean();
  if (chunks.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);

  const scored = chunks.map(chunk => ({
    ...chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK) as any;
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
