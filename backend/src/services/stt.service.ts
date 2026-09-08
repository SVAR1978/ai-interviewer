import { DeepgramClient } from '@deepgram/sdk';
import { config } from '../config/env';

export interface STTTranscriptPayload {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

interface ActiveSession {
  socket: any;
  cleanup: () => void;
  isOpen: boolean;
}

class STTService {
  private activeSessions: Map<string, ActiveSession> = new Map();

  public isDeepgramConfigured(): boolean {
    const key = config.deepgramApiKey;
    return Boolean(key && key.trim().length > 0 && !key.includes('your_deepgram'));
  }

  /**
   * Starts a real-time live transcription connection with Deepgram.
   * Resolves to true ONLY when the WebSocket is confirmed OPEN.
   */
  public async startLiveSession(
    sessionId: string,
    onTranscript: (payload: STTTranscriptPayload) => void,
    onError: (err: any) => void
  ): Promise<boolean> {
    if (!this.isDeepgramConfigured()) {
      console.log('[STTService] DEEPGRAM_API_KEY not configured or placeholder. Operating with browser speech fallback.');
      return false;
    }

    // Clean up any stale session for this socket ID
    this.closeSession(sessionId);

    try {
      const deepgram = new DeepgramClient({ apiKey: config.deepgramApiKey });
      const socket = await deepgram.listen.v1.connect({
        model: 'nova-2',
        language: 'en-US',
        smart_format: 'true',
        interim_results: 'true',
        punctuate: 'true',
      });

      let isSessionActive = true;

      const sessionObj: ActiveSession = {
        socket,
        isOpen: false,
        cleanup: () => {
          isSessionActive = false;
          try {
            if (socket.readyState === 1) {
              socket.close();
            }
          } catch {}
          this.activeSessions.delete(sessionId);
        },
      };

      socket.on('open', () => {
        console.log(`[STTService] Deepgram live socket opened for session ${sessionId}`);
        sessionObj.isOpen = true;
      });

      socket.on('message', (data: any) => {
        const alternative = data?.channel?.alternatives?.[0];
        const transcript = alternative?.transcript || '';
        const isFinal = Boolean(data?.is_final);
        const confidence = alternative?.confidence;

        if (transcript.trim().length > 0) {
          onTranscript({
            transcript,
            isFinal,
            confidence,
          });
        }
      });

      socket.on('error', (err: any) => {
        console.warn(`[STTService] Deepgram notice for session ${sessionId}:`, err?.message || err);
        sessionObj.isOpen = false;
        onError(err);
      });

      socket.on('close', (event: any) => {
        console.log(`[STTService] Deepgram closed for session ${sessionId} (code: ${event?.code || 'none'}, reason: ${event?.reason || 'none'})`);
        sessionObj.isOpen = false;
        this.activeSessions.delete(sessionId);
      });

      // Wait for the WebSocket to genuinely open before accepting media
      const openPromise = socket.waitForOpen();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Deepgram connection timeout after 4000ms')), 4000)
      );

      await Promise.race([openPromise, timeoutPromise]);
      sessionObj.isOpen = true;
      this.activeSessions.set(sessionId, sessionObj);

      console.log(`[STTService] Deepgram live connection established successfully for ${sessionId}`);
      return true;
    } catch (err: any) {
      console.warn(`[STTService] Could not establish Deepgram session (${err?.message || 'Handshake failed'}). Falling back to browser speech.`);
      this.closeSession(sessionId);
      onError(err);
      return false;
    }
  }

  /**
   * Check if the active session is genuinely open and ready to accept audio.
   */
  public isSessionOpen(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return Boolean(session && session.isOpen && session.socket && session.socket.readyState === 1);
  }

  /**
   * Streams an incoming audio buffer chunk to the active Deepgram live connection.
   */
  public sendAudioChunk(sessionId: string, chunk: Buffer | ArrayBuffer): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isOpen || !session.socket) return;

    if (session.socket.readyState !== 1) {
      return;
    }

    try {
      session.socket.sendMedia(chunk);
    } catch (err: any) {
      session.isOpen = false;
      this.closeSession(sessionId);
    }
  }

  /**
   * Closes the active live session cleanly.
   */
  public closeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.cleanup();
    }
    this.activeSessions.delete(sessionId);
  }
}

export const sttService = new STTService();
