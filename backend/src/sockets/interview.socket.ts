import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import { redisService } from '../services/redis.service';
import { retrieveRelevantChunks, retrieveChunksForJD } from '../services/rag.service';
import { QA, Qno } from '../models';
import { ttsService } from '../services/tts.service';
import { sttService } from '../services/stt.service';

const genAI = new GoogleGenerativeAI(config.geminiKey);
const model = genAI.getGenerativeModel({ model: config.geminiModel });

export const initSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Track active abort controllers per socket in case user interrupts stream
    let activeStreamAbort = false;

    // ── 1. Candidate joins their interview room ─────────────────────
    socket.on('interview:join', async (data: { username: string; domain?: string; jobDescriptionId?: string }) => {
      try {
        const { username, domain, jobDescriptionId } = data || {};
        if (!username) {
          return socket.emit('interview:error', { error: 'Username is required to join session' });
        }

        const roomName = `interview:${username}`;
        socket.join(roomName);
        console.log(`[Socket] User "${username}" joined room "${roomName}" (socket: ${socket.id})`);

        // Check Redis for active session state
        let qa = await redisService.getSessionQA(username);
        let qno = await redisService.getQuestionNo(username);

        // Fallback to MongoDB if Redis cache is empty
        if (qa === null || qno === null) {
          const qaRecord = await QA.findOne({ username });
          const qnoRecord = await Qno.findOne({ username });

          if (qaRecord && qnoRecord) {
            qa = qaRecord.questionanswer || '';
            qno = parseInt(qnoRecord.qno, 10) || 0;
            // Repopulate Redis
            await redisService.setSessionQA(username, qa, 7200);
            await redisService.setQuestionNo(username, qno, 7200);
          }
        }

        // Extract the last question from transcript if available
        let lastQuestion = '';
        if (qa) {
          const questionMatches = qa.match(/Q\d+:\s*(.*?)(?=\nA\d+:|$)/gs);
          if (questionMatches && questionMatches.length > 0) {
            const lastMatch = questionMatches[questionMatches.length - 1];
            lastQuestion = lastMatch.replace(/^Q\d+:\s*/, '').trim();
          }
        }

        // Emit sync state to client (handles reconnection seamlessly)
        socket.emit('interview:sync_state', {
          connected: true,
          username,
          qno: qno || 1,
          question: lastQuestion,
          hasExistingSession: Boolean(qa && qa.trim().length > 0),
        });
      } catch (err: any) {
        console.error('[Socket] Error in interview:join:', err);
        socket.emit('interview:error', { error: err.message || 'Failed to join interview room' });
      }
    });

    // ── 2. Handle candidate submitting an answer ────────────────────
    socket.on('interview:submit_answer', async (data: {
      username: string;
      answer: string;
      domain: string;
      jobDescriptionId?: string;
    }) => {
      try {
        const { username, answer, domain, jobDescriptionId } = data || {};

        if (!username || !answer) {
          return socket.emit('interview:error', { error: 'Username and answer are required' });
        }

        activeStreamAbort = false;

        // 1. Get current question number from Redis (fallback to Mongo)
        let qIndex = await redisService.getQuestionNo(username);
        let qnoRecord: any = null;
        if (qIndex === null) {
          qnoRecord = await Qno.findOne({ username });
          if (!qnoRecord) {
            return socket.emit('interview:error', { error: 'No active question found. Please start the interview again.' });
          }
          qIndex = parseInt(qnoRecord.qno, 10);
        }

        // 2. Append answer to Upstash Redis (O(1) memory append)
        await redisService.appendSessionAnswer(username, qIndex, answer);

        // 3. Sync to MongoDB for persistent backup
        let qaRecord = await QA.findOne({ username });
        if (!qaRecord) {
          qaRecord = new QA({ username, questionanswer: '' });
        }
        qaRecord.questionanswer += `\nA${qIndex}: ${answer}`;
        await qaRecord.save();

        // 4. Acknowledge answer saved
        socket.emit('interview:answer_saved', {
          qno: qIndex,
          message: 'Answer saved successfully',
        });

        // 5. Read complete transcript for generating the next question
        const fullTranscript = await redisService.getSessionQA(username) || qaRecord.questionanswer;
        const nextQno = qIndex + 1;

        // 6. RAG Context Retrieval for grounded follow-ups
        let ragContext = '';
        try {
          let relevantChunks;
          const query = `${domain} ${fullTranscript}`;
          if (jobDescriptionId) {
            relevantChunks = await retrieveChunksForJD(query, jobDescriptionId, 5);
          } else {
            relevantChunks = await retrieveRelevantChunks(query, username, 5);
          }

          if (relevantChunks && relevantChunks.length > 0) {
            ragContext = '\n\nRelevant job description requirements to base your question on:\n' +
              relevantChunks.map(c => `[${c.section}]: ${c.chunkText}`).join('\n');
          }
        } catch (ragErr) {
          console.warn('[Socket] RAG context retrieval notice:', ragErr);
        }

        // 7. Question Generation Prompt
        const promptText = ragContext
          ? `You are an expert technical interviewer. Based on the following job description requirements and the candidate's previous responses, generate a relevant follow-up interview question in the domain of "${domain}".${ragContext}\n\nPrevious Q&A:\n${fullTranscript}\n\nGenerate a follow-up question that digs deeper into the job requirements or probes areas the candidate hasn't covered yet. Only output the question itself.`
          : `Based on this previous Q&A history, generate a relevant follow-up interview question in the domain of "${domain}":\n${fullTranscript}\n\nOnly output the question itself.`;

        // 8. Emit stream start to client
        socket.emit('interview:stream_start', {
          qno: nextQno,
        });

        // 9. Call Gemini streamGenerateContent via Node SDK generateContentStream
        const responseStream = await model.generateContentStream(promptText);

        let streamedQuestion = '';
        for await (const chunk of responseStream.stream) {
          if (activeStreamAbort) {
            console.log(`[Socket] Stream aborted by client interruption for user "${username}"`);
            break;
          }
          const chunkText = chunk.text();
          streamedQuestion += chunkText;
          socket.emit('interview:chunk', {
            chunk: chunkText,
            currentText: streamedQuestion,
            qno: nextQno,
          });
        }

        if (activeStreamAbort) {
          return;
        }

        const finalQuestion = streamedQuestion.trim();
        const updatedQA = `${fullTranscript}\nQ${nextQno}: ${finalQuestion}`;

        // 10. Persist updated transcript & question index in Redis & Mongo
        await redisService.setSessionQA(username, updatedQA, 7200);
        await redisService.setQuestionNo(username, nextQno, 7200);

        if (qaRecord) {
          qaRecord.questionanswer = updatedQA;
          await qaRecord.save();
        }

        if (!qnoRecord) qnoRecord = await Qno.findOne({ username });
        if (qnoRecord) {
          qnoRecord.qno = nextQno.toString();
          await qnoRecord.save();
        }

        // 11. Final stream completion event
        socket.emit('interview:stream_end', {
          qno: nextQno,
          question: finalQuestion,
          ragGrounded: ragContext.length > 0,
        });

      } catch (err: any) {
        console.error('[Socket] Error in interview:submit_answer:', err);
        socket.emit('interview:error', {
          error: err.message || 'Failed to process answer and generate next question',
        });
      }
    });

    // ── 3. Start Interview / First Question Streaming via Socket ────
    socket.on('interview:start', async (data: {
      username: string;
      domain: string;
      jobDescriptionId?: string;
    }) => {
      try {
        const { username, domain, jobDescriptionId } = data || {};
        if (!username || !domain) {
          return socket.emit('interview:error', { error: 'Username and domain are required' });
        }

        activeStreamAbort = false;

        // Fast lookup: check if already has question 1
        let qa = await redisService.getSessionQA(username);
        let qno = await redisService.getQuestionNo(username);

        let qaRecord: any = null;
        let qnoRecord: any = null;

        if (qa === null || qno === null) {
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
          qno = parseInt(qnoRecord.qno, 10);

          await redisService.setSessionQA(username, qa, 7200);
          await redisService.setQuestionNo(username, qno, 7200);
        }

        // Retrieve RAG context if applicable
        let ragContext = '';
        try {
          let relevantChunks;
          const query = domain;
          if (jobDescriptionId) {
            relevantChunks = await retrieveChunksForJD(query, jobDescriptionId, 5);
          } else {
            relevantChunks = await retrieveRelevantChunks(query, username, 5);
          }

          if (relevantChunks && relevantChunks.length > 0) {
            ragContext = '\n\nRelevant job description requirements to base your question on:\n' +
              relevantChunks.map(c => `[${c.section}]: ${c.chunkText}`).join('\n');
          }
        } catch (ragErr) {
          console.warn('[Socket] RAG context retrieval notice:', ragErr);
        }

        const promptText = ragContext
          ? `You are an expert technical interviewer. Based on the following job description requirements, generate a targeted interview question in the domain of "${domain}".${ragContext}\n\nGenerate a specific, role-relevant question that directly tests skills mentioned in the job description. Only output the question itself.`
          : `Generate a professional interview question in the domain of "${domain}". Only output the question itself.`;

        socket.emit('interview:stream_start', { qno: 1 });

        const responseStream = await model.generateContentStream(promptText);
        let streamedQuestion = '';

        for await (const chunk of responseStream.stream) {
          if (activeStreamAbort) break;
          const chunkText = chunk.text();
          streamedQuestion += chunkText;
          socket.emit('interview:chunk', {
            chunk: chunkText,
            currentText: streamedQuestion,
            qno: 1,
          });
        }

        if (activeStreamAbort) return;

        const finalQuestion = streamedQuestion.trim();
        const updatedQA = `Q1: ${finalQuestion}`;

        await redisService.setSessionQA(username, updatedQA, 7200);
        await redisService.setQuestionNo(username, 1, 7200);

        if (!qaRecord) qaRecord = await QA.findOne({ username });
        if (qaRecord) {
          qaRecord.questionanswer = updatedQA;
          await qaRecord.save();
        }

        if (!qnoRecord) qnoRecord = await Qno.findOne({ username });
        if (qnoRecord) {
          qnoRecord.qno = '1';
          await qnoRecord.save();
        }

        socket.emit('interview:stream_end', {
          qno: 1,
          question: finalQuestion,
          ragGrounded: ragContext.length > 0,
        });

      } catch (err: any) {
        console.error('[Socket] Error in interview:start:', err);
        socket.emit('interview:error', { error: err.message || 'Failed to start interview' });
      }
    });

    // ── 4. Interrupt handling (Candidate speaks or stops AI) ─────────
    socket.on('interview:interrupt', (data: { username?: string; reason?: string }) => {
      console.log(`[Socket] Interruption received from ${socket.id} (${data?.username || 'candidate'})`);
      activeStreamAbort = true;
      socket.emit('interview:interrupted_ack', {
        interrupted: true,
        timestamp: Date.now(),
      });
    });

    // ── 5. Pro Audio: Deepgram Live STT Audio Stream ─────────────────
    socket.on('interview:audio_stream_start', async () => {
      try {
        const isLive = await sttService.startLiveSession(
          socket.id,
          (payload) => {
            socket.emit('interview:transcript_chunk', payload);
          },
          (err) => {
            socket.emit('interview:stt_error', {
              error: err?.message || 'Deepgram streaming unavailable',
              fallback: true,
            });
          }
        );

        socket.emit('interview:stt_ready', {
          provider: isLive ? 'deepgram' : 'browser_fallback',
          active: true,
        });
      } catch (err: any) {
        socket.emit('interview:stt_ready', {
          provider: 'browser_fallback',
          active: true,
        });
      }
    });

    socket.on('interview:audio_chunk', (chunk: any) => {
      sttService.sendAudioChunk(socket.id, chunk);
    });

    socket.on('interview:audio_stream_end', () => {
      sttService.closeSession(socket.id);
      socket.emit('interview:stt_ended', { active: false });
    });

    // ── 6. Pro Audio: ElevenLabs Realistic TTS Generation ─────────────
    socket.on('interview:tts_request', async (data: { text: string; voiceId?: string }) => {
      try {
        const { text, voiceId } = data || {};
        if (!text) return;
        const result = await ttsService.generateSpeech(text, voiceId);
        socket.emit('interview:tts_response', result);
      } catch (ttsErr: any) {
        console.warn('[Socket] TTS generation notice:', ttsErr?.message);
        socket.emit('interview:tts_response', { provider: 'browser_fallback', format: 'audio/mp3' });
      }
    });

    // ── 7. Disconnect handling ──────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (reason: ${reason})`);
      sttService.closeSession(socket.id);
    });
  });

  return io;
};
