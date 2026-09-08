import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getInterviewSocket, disconnectInterviewSocket } from '../services/socket';

interface UseInterviewSocketOptions {
  username: string;
  domain: string;
  jobDescriptionId?: string;
  onSyncState?: (data: { qno: number; question: string; hasExistingSession: boolean }) => void;
  onStreamStart?: (data: { qno: number }) => void;
  onChunk?: (data: { chunk: string; currentText: string; qno: number }) => void;
  onStreamEnd?: (data: { qno: number; question: string; ragGrounded: boolean }) => void;
  onTTSResponse?: (data: { audioBase64?: string; format: string; provider: string }) => void;
  onError?: (err: string) => void;
}

export const useInterviewSocket = (options: UseInterviewSocketOptions) => {
  const {
    username,
    domain,
    jobDescriptionId,
    onSyncState,
    onStreamStart,
    onChunk,
    onStreamEnd,
    onTTSResponse,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef({
    onSyncState,
    onStreamStart,
    onChunk,
    onStreamEnd,
    onTTSResponse,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSyncState,
      onStreamStart,
      onChunk,
      onStreamEnd,
      onTTSResponse,
      onError,
    };
  }, [onSyncState, onStreamStart, onChunk, onStreamEnd, onTTSResponse, onError]);

  useEffect(() => {
    if (!username) return;

    const socket = getInterviewSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      console.log('[Socket Hook] Connected to server, joining session...');
      setIsConnected(true);
      setSocketError(null);
      socket.emit('interview:join', { username, domain, jobDescriptionId });
    };

    const handleDisconnect = (reason: string) => {
      console.warn('[Socket Hook] Disconnected:', reason);
      setIsConnected(false);
      setIsStreaming(false);
    };

    const handleConnectError = (err: Error) => {
      console.warn('[Socket Hook] Connect error:', err.message);
      setIsConnected(false);
      setSocketError(err.message);
    };

    const handleSyncState = (data: { qno: number; question: string; hasExistingSession: boolean }) => {
      console.log('[Socket Hook] interview:sync_state received:', data);
      callbacksRef.current.onSyncState?.(data);
    };

    const handleStreamStart = (data: { qno: number }) => {
      setIsStreaming(true);
      callbacksRef.current.onStreamStart?.(data);
    };

    const handleChunk = (data: { chunk: string; currentText: string; qno: number }) => {
      callbacksRef.current.onChunk?.(data);
    };

    const handleStreamEnd = (data: { qno: number; question: string; ragGrounded: boolean }) => {
      setIsStreaming(false);
      callbacksRef.current.onStreamEnd?.(data);
    };

    const handleTTSResponse = (data: { audioBase64?: string; format: string; provider: string }) => {
      callbacksRef.current.onTTSResponse?.(data);
    };

    const handleError = (data: { error: string }) => {
      const msg = data?.error || 'Interview socket error';
      setSocketError(msg);
      setIsStreaming(false);
      callbacksRef.current.onError?.(msg);
    };

    // Attach listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('interview:sync_state', handleSyncState);
    socket.on('interview:stream_start', handleStreamStart);
    socket.on('interview:chunk', handleChunk);
    socket.on('interview:stream_end', handleStreamEnd);
    socket.on('interview:tts_response', handleTTSResponse);
    socket.on('interview:error', handleError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('interview:sync_state', handleSyncState);
      socket.off('interview:stream_start', handleStreamStart);
      socket.off('interview:chunk', handleChunk);
      socket.off('interview:stream_end', handleStreamEnd);
      socket.off('interview:tts_response', handleTTSResponse);
      socket.off('interview:error', handleError);
    };
  }, [username, domain, jobDescriptionId]);

  const submitAnswer = useCallback((answer: string) => {
    if (!socketRef.current || !socketRef.current.connected) {
      throw new Error('Interview socket is not connected. Please check your network connection.');
    }
    setSocketError(null);
    socketRef.current.emit('interview:submit_answer', {
      username,
      answer,
      domain,
      jobDescriptionId,
    });
  }, [username, domain, jobDescriptionId]);

  const requestTTS = useCallback((text: string, voiceId?: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('interview:tts_request', { text, voiceId });
    }
  }, []);

  const interrupt = useCallback((reason: string = 'candidate_speaking') => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('interview:interrupt', { username, reason });
    }
  }, [username]);

  const requestStart = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('interview:start', {
      username,
      domain,
      jobDescriptionId,
    });
  }, [username, domain, jobDescriptionId]);

  return {
    socket: socketRef.current,
    isConnected,
    isStreaming,
    socketError,
    submitAnswer,
    requestTTS,
    interrupt,
    requestStart,
    disconnect: disconnectInterviewSocket,
  };
};
