import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface UseProAudioRecorderOptions {
  socket: Socket | null;
  onTranscriptChunk?: (data: { transcript: string; isFinal: boolean }) => void;
  onError?: (err: string) => void;
}

export const useProAudioRecorder = ({
  socket,
  onTranscriptChunk,
  onError,
}: UseProAudioRecorderOptions) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [sttProvider, setSttProvider] = useState<'deepgram' | 'browser_fallback'>('browser_fallback');
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionFallbackRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const sttProviderRef = useRef<'deepgram' | 'browser_fallback'>('browser_fallback');

  // Attach socket listener for live transcription chunks from Deepgram
  useEffect(() => {
    if (!socket) return;

    const handleTranscriptChunk = (payload: { transcript: string; isFinal: boolean }) => {
      onTranscriptChunk?.(payload);
    };

    const handleSttReady = (data: { provider: 'deepgram' | 'browser_fallback' }) => {
      console.log('[ProAudioRecorder] STT backend provider ready:', data.provider);
      setSttProvider(data.provider);
      sttProviderRef.current = data.provider;
      if (data.provider === 'browser_fallback') {
        startBrowserSpeechFallback();
      }
    };

    const handleSttError = (err: { error: string }) => {
      console.warn('[ProAudioRecorder] Live STT server notice:', err?.error);
      setSttProvider('browser_fallback');
      sttProviderRef.current = 'browser_fallback';
      startBrowserSpeechFallback();
    };

    socket.on('interview:transcript_chunk', handleTranscriptChunk);
    socket.on('interview:stt_ready', handleSttReady);
    socket.on('interview:stt_error', handleSttError);

    return () => {
      socket.off('interview:transcript_chunk', handleTranscriptChunk);
      socket.off('interview:stt_ready', handleSttReady);
      socket.off('interview:stt_error', handleSttError);
    };
  }, [socket, onTranscriptChunk]);

  // Fallback client recognition (used when Deepgram API key is not yet set in backend)
  const startBrowserSpeechFallback = useCallback(() => {
    if (!isRecordingRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!recognitionFallbackRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }
        if (final) {
          onTranscriptChunk?.({ transcript: final, isFinal: true });
        } else if (interim) {
          onTranscriptChunk?.({ transcript: interim, isFinal: false });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('[Speech Fallback notice]:', e.error);
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      recognitionFallbackRef.current = recognition;
    }

    try {
      recognitionFallbackRef.current.start();
    } catch {}
  }, [onTranscriptChunk]);

  const stopAudioVisualization = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  };

  const startAudioVisualization = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (e) {
      console.warn('[ProAudioRecorder] Visualizer init warning:', e);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      isRecordingRef.current = true;
      setIsRecording(true);

      // 1. Notify backend socket to prepare live STT stream
      if (socket && socket.connected) {
        socket.emit('interview:audio_stream_start', { timestamp: Date.now() });
      } else {
        startBrowserSpeechFallback();
      }

      // 2. Request user microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      startAudioVisualization(stream);

      // 3. Initialize MediaRecorder for streaming raw Opus/WebM audio
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (
          event.data &&
          event.data.size > 0 &&
          isRecordingRef.current &&
          sttProviderRef.current === 'deepgram'
        ) {
          const arrayBuffer = await event.data.arrayBuffer();
          if (socket && socket.connected) {
            socket.emit('interview:audio_chunk', arrayBuffer);
          }
        }
      };

      // Emit chunks every 250ms for sub-second Deepgram transcription
      recorder.start(250);
    } catch (err: any) {
      console.error('[ProAudioRecorder] Error starting recording:', err);
      isRecordingRef.current = false;
      setIsRecording(false);
      onError?.(err?.message || 'Could not access microphone');
    }
  }, [socket, startBrowserSpeechFallback, onError]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    stopAudioVisualization();

    // 1. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    // 2. Stop audio tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 3. Stop AudioContext
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    // 4. Stop fallback recognition
    if (recognitionFallbackRef.current) {
      try {
        recognitionFallbackRef.current.stop();
      } catch {}
      recognitionFallbackRef.current = null;
    }

    // 5. Notify backend socket that stream ended
    if (socket && socket.connected) {
      socket.emit('interview:audio_stream_end');
    }
  }, [socket]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    sttProvider,
    audioLevel,
  };
};
