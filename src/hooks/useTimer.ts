'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BreathPace, BREATH_PACE_SECONDS } from '@/lib/types';

interface UseTimerOptions {
  initialTime: number;
  mode: 'seconds' | 'breaths';
  breathPace?: BreathPace;
  onComplete?: () => void;
  autoStart?: boolean;
}

export function useTimer({ initialTime, mode, breathPace = 'normal', onComplete, autoStart = false }: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [smoothProgress, setSmoothProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const breathIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const breathStartTimeRef = useRef<number>(0);

  const reset = useCallback((newTime?: number) => {
    setTimeLeft(newTime ?? initialTime);
    setIsRunning(false);
    setBreathPhase('inhale');
    setSmoothProgress(0);
    breathStartTimeRef.current = 0;
  }, [initialTime]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const toggle = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  // Main timer logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (mode === 'seconds') {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Breaths mode: use configured breath pace
      const breathDuration = BREATH_PACE_SECONDS[breathPace] * 1000;
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, breathDuration);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, mode, breathPace, onComplete]);

  // Breath phase animation (for breaths mode)
  useEffect(() => {
    if (!isRunning || mode !== 'breaths') {
      if (breathIntervalRef.current) {
        clearInterval(breathIntervalRef.current);
        breathIntervalRef.current = null;
      }
      return;
    }

    // Half the breath duration for inhale, half for exhale
    const phaseInterval = (BREATH_PACE_SECONDS[breathPace] * 1000) / 2;
    breathIntervalRef.current = setInterval(() => {
      setBreathPhase(prev => prev === 'inhale' ? 'exhale' : 'inhale');
    }, phaseInterval);

    return () => {
      if (breathIntervalRef.current) {
        clearInterval(breathIntervalRef.current);
      }
    };
  }, [isRunning, mode, breathPace]);

  // Smooth progress for breaths mode
  useEffect(() => {
    if (!isRunning) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    if (mode === 'breaths') {
      // Track start time for smooth progress
      if (breathStartTimeRef.current === 0) {
        breathStartTimeRef.current = Date.now();
      }

      const totalDuration = initialTime * BREATH_PACE_SECONDS[breathPace] * 1000;

      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - breathStartTimeRef.current;
        const newProgress = Math.min(elapsed / totalDuration, 1);
        setSmoothProgress(newProgress);
      }, 50); // Update every 50ms for smooth animation
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isRunning, mode, breathPace, initialTime]);

  return {
    timeLeft,
    isRunning,
    breathPhase,
    start,
    pause,
    toggle,
    reset,
    progress: mode === 'breaths' ? smoothProgress : 1 - (timeLeft / initialTime),
  };
}
