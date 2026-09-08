import { useState, useRef, useCallback, useEffect } from 'react';

export interface PlayAudioOptions {
  audioBase64?: string;
  audioBuffer?: ArrayBuffer;
  fallbackText?: string;
  provider?: 'azure' | 'browser_fallback';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export const useProAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentProvider, setCurrentProvider] = useState<'azure' | 'browser_fallback' | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Stop active audio playback immediately (interruption)
  const stop = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      } catch {}
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {}
      objectUrlRef.current = null;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Enhanced fallback browser speech synthesis
  const speakWithBrowserFallback = useCallback((text: string, onStart?: () => void, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice =
      voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex'))) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    utterance.onstart = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
      setCurrentProvider('browser_fallback');
      onStart?.();
    };

    utterance.onend = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      onEnd?.();
    };

    utterance.onerror = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Play Pro Audio (Microsoft Azure AI Speech) via Blob and HTML5 Audio API
  const play = useCallback((options: PlayAudioOptions) => {
    const { audioBase64, audioBuffer, fallbackText, provider, onStart, onEnd, onError } = options;

    // Stop any existing playback first
    stop();

    // 1. Process Azure AI Speech audio buffer or base64 into a playable Blob
    let blob: Blob | null = null;

    if (audioBuffer) {
      blob = new Blob([audioBuffer], { type: 'audio/mp3' });
    } else if (audioBase64 && provider === 'azure') {
      try {
        const binaryString = atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes.buffer], { type: 'audio/mp3' });
      } catch (decodeErr) {
        console.warn('[ProAudioPlayer] Base64 decode failed:', decodeErr);
      }
    }

    if (blob) {
      try {
        const audioUrl = URL.createObjectURL(blob);
        objectUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          isPlayingRef.current = true;
          setIsPlaying(true);
          setCurrentProvider('azure');
          onStart?.();
        };

        audio.onended = () => {
          isPlayingRef.current = false;
          setIsPlaying(false);
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
          }
          audioRef.current = null;
          onEnd?.();
        };

        audio.onerror = (e) => {
          console.warn('[ProAudioPlayer] Audio element error, falling back to browser speech:', e);
          if (fallbackText) {
            speakWithBrowserFallback(fallbackText, onStart, onEnd);
          } else {
            isPlayingRef.current = false;
            setIsPlaying(false);
            onError?.(e);
          }
        };

        audio.play().catch((playErr) => {
          console.warn('[ProAudioPlayer] Autoplay or playback prevented:', playErr);
          if (fallbackText) {
            speakWithBrowserFallback(fallbackText, onStart, onEnd);
          } else {
            onError?.(playErr);
          }
        });
      } catch (err) {
        console.warn('[ProAudioPlayer] Error creating audio object:', err);
        if (fallbackText) {
          speakWithBrowserFallback(fallbackText, onStart, onEnd);
        } else {
          onError?.(err);
        }
      }
    } else if (fallbackText) {
      // 2. Graceful fallback to client speech synthesis if no Azure audio was generated
      speakWithBrowserFallback(fallbackText, onStart, onEnd);
    }
  }, [stop, speakWithBrowserFallback]);

  return {
    play,
    stop,
    isPlaying,
    currentProvider,
  };
};
