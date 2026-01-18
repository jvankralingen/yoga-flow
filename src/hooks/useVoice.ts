'use client';

import { useCallback, useRef } from 'react';
import { getCachedAudio, setCachedAudio } from '@/lib/audioCache';

interface UseVoiceOptions {
  enabled: boolean;
}

export function useVoice({ enabled }: UseVoiceOptions) {
  const enabledRef = useRef(enabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep ref in sync with prop
  enabledRef.current = enabled;

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!enabledRef.current) {
      console.log('[TTS] Voice disabled, skipping:', text.substring(0, 30));
      return;
    }

    console.log('[TTS] Speaking:', text.substring(0, 50));

    return new Promise((resolve) => {
      (async () => {
        try {
          // Stop any currently playing audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          // Check cache first
          let audioBlob = await getCachedAudio(text);

          // Ignore cached blobs that are too small (likely corrupt)
          if (audioBlob && audioBlob.size < 1000) {
            console.warn('[TTS] Cached blob too small, ignoring:', audioBlob.size);
            audioBlob = null;
          }

          console.log('[TTS] Cache hit:', !!audioBlob);

          if (!audioBlob) {
            // Not in cache, fetch from API
            console.log('[TTS] Fetching from API...');
            abortControllerRef.current = new AbortController();

            const response = await fetch('/api/tts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text }),
              signal: abortControllerRef.current.signal,
            });

            console.log('[TTS] API response status:', response.status);

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[TTS] API error:', errorText);
              throw new Error(`TTS request failed: ${response.status}`);
            }

            audioBlob = await response.blob();
            console.log('[TTS] Got audio blob, size:', audioBlob.size);

            // Only cache if we have a valid audio blob (at least 1KB)
            if (audioBlob.size > 1000) {
              await setCachedAudio(text, audioBlob);
            } else {
              console.warn('[TTS] Audio blob too small, not caching:', audioBlob.size);
            }
          }

          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            console.log('[TTS] Audio ended');
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            resolve();
          };

          audio.onerror = (e) => {
            console.error('[TTS] Audio error:', e);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            resolve();
          };

          await audio.play();
          console.log('[TTS] Audio playing');
        } catch (error) {
          console.error('[TTS] Speech error:', error);
          resolve();
        }
      })();
    });
  }, []);

  const speakPose = useCallback(async (poseName: string, description: string, side?: 'left' | 'right' | 'both'): Promise<void> => {
    let text = poseName;
    if (side === 'left') {
      text = `${poseName}, linkerkant. ${description}`;
    } else if (side === 'right') {
      text = `${poseName}, rechterkant. ${description}`;
    } else if (side === 'both') {
      text = `${poseName}, beide kanten. ${description}`;
    } else {
      text = `${poseName}. ${description}`;
    }
    await speak(text);
  }, [speak]);

  const speakDuration = useCallback(async (duration: number, mode: 'seconds' | 'breaths'): Promise<void> => {
    let text: string;
    if (mode === 'breaths') {
      text = `We houden dit vast voor ${duration} ademhalingen......`;
    } else {
      text = `We houden dit vast voor ${duration} seconden......`;
    }
    await speak(text);
  }, [speak]);

  const speakLastBreath = useCallback(async (): Promise<void> => {
    await speak('Nog één keer. Adem in........... ...en uit...');
  }, [speak]);

  const speakComplete = useCallback(() => {
    speak('Goed gedaan! De flow is voltooid!');
  }, [speak]);

  const stop = useCallback(() => {
    // Abort any pending fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return {
    speak,
    speakPose,
    speakDuration,
    speakLastBreath,
    speakComplete,
    stop,
    isReady: true,
  };
}
