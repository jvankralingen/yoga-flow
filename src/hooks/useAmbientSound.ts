'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

interface UseAmbientSoundOptions {
  src: string;
  volume?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export function useAmbientSound({
  src,
  volume = 0.3,
  fadeInDuration = 2000,
  fadeOutDuration = 1000,
}: UseAmbientSoundOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';

    audio.oncanplaythrough = () => {
      setIsLoaded(true);
    };

    audio.onerror = () => {
      console.log('[AmbientSound] Failed to load:', src);
      setIsLoaded(false);
    };

    audioRef.current = audio;

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  // Fade volume helper
  const fadeVolume = useCallback((targetVolume: number, duration: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const startVolume = audio.volume;
    const volumeDiff = targetVolume - startVolume;
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = volumeDiff / steps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(0, Math.min(1, startVolume + volumeStep * currentStep));
      audio.volume = newVolume;

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        if (targetVolume === 0) {
          audio.pause();
        }
      }
    }, stepDuration);
  }, []);

  // Start playing with fade in
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !isLoaded) return;

    try {
      audio.volume = 0;
      await audio.play();
      setIsPlaying(true);
      fadeVolume(volume, fadeInDuration);
    } catch (error) {
      console.log('[AmbientSound] Play failed:', error);
    }
  }, [isLoaded, volume, fadeInDuration, fadeVolume]);

  // Stop playing with fade out
  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    fadeVolume(0, fadeOutDuration);
    setIsPlaying(false);
  }, [fadeOutDuration, fadeVolume]);

  // Toggle play/stop
  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  }, [isPlaying, play, stop]);

  return {
    isPlaying,
    isLoaded,
    play,
    stop,
    toggle,
  };
}
