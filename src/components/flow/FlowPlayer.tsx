'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Flow } from '@/lib/types';
import { useTimer } from '@/hooks/useTimer';
import { useRealtimeYoga } from '@/hooks/useRealtimeYoga';
import { PoseCard } from './PoseCard';
import { saveFlow } from '@/lib/storage';

interface FlowPlayerProps {
  flow: Flow;
}

export function FlowPlayer({ flow }: FlowPlayerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flowCompleted, setFlowCompleted] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const currentPose = flow.poses[currentIndex];
  const isLastPose = currentIndex === flow.poses.length - 1;

  // Refs to track what we've already cued
  const startCuedRef = useRef(false);
  const halfwayCuedRef = useRef(-1);
  const lastBreathCuedRef = useRef(-1);

  // Track if we're waiting to send the initial start cue
  const [pendingStartCue, setPendingStartCue] = useState(false);

  // Timer control refs (will be updated after useTimer hook)
  const timerResetRef = useRef<(time: number) => void>(() => {});
  const timerStartRef = useRef<() => void>(() => {});
  const timerPauseRef = useRef<() => void>(() => {});
  const isSessionActiveRef = useRef(false);

  // Wake lock management to keep screen on
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[FlowPlayer] Wake lock acquired');
      } catch (err) {
        console.log('[FlowPlayer] Wake lock failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('[FlowPlayer] Wake lock released');
    }
  }, []);

  // Callback for when AI signals timer should start
  const handleTimerStart = useCallback(() => {
    if (isSessionActiveRef.current) {
      console.log('[FlowPlayer] AI signaled timer start');
      timerStartRef.current();
    }
  }, []);

  // Realtime yoga voice
  const {
    status: voiceStatus,
    isConnected,
    isSpeaking,
    connect,
    disconnect,
    cancelResponse,
    cueStart,
    cueHalfway,
    cueLastBreath,
    cueNext,
    cueComplete,
  } = useRealtimeYoga({
    flow,
    onTimerStart: handleTimerStart,
  });

  // Handle pose completion
  const handleComplete = useCallback(() => {
    // Cancel any ongoing speech first (e.g., if halfway cue is still playing)
    if (isConnected) {
      cancelResponse();
    }

    if (!isLastPose) {
      const newIndex = currentIndex + 1;
      const nextPose = flow.poses[newIndex];

      setCurrentIndex(newIndex);
      timerResetRef.current(nextPose.duration);

      // Cue the AI about the next pose - small delay after cancel to avoid conflicts
      if (isConnected) {
        setTimeout(() => {
          cueNext(nextPose.pose.englishName, nextPose.side);
        }, 100);
      } else {
        // No voice, start timer immediately
        timerStartRef.current();
      }
    } else {
      // Flow complete
      if (isConnected) {
        setTimeout(() => {
          cueComplete();
        }, 100);
      }
      setFlowCompleted(true);
      saveFlow(flow);
    }
  }, [isLastPose, flow, currentIndex, isConnected, cancelResponse, cueNext, cueComplete]);

  // Timer hook
  const {
    timeLeft,
    isRunning,
    breathPhase,
    progress,
    toggle,
    reset,
    start,
    pause,
  } = useTimer({
    initialTime: currentPose.duration,
    mode: flow.timerMode,
    breathPace: flow.breathPace,
    onComplete: handleComplete,
    autoStart: false,
  });

  // Keep refs updated for use in callbacks
  timerResetRef.current = reset;
  timerStartRef.current = start;
  timerPauseRef.current = pause;
  isSessionActiveRef.current = isSessionActive;

  // Send halfway cue (at 50% of pose duration)
  useEffect(() => {
    if (!isRunning || !isConnected) return;

    const halfway = Math.floor(currentPose.duration / 2);
    if (timeLeft === halfway && halfwayCuedRef.current !== currentIndex) {
      halfwayCuedRef.current = currentIndex;
      cueHalfway();
    }
  }, [timeLeft, isRunning, isConnected, currentPose.duration, currentIndex, cueHalfway]);

  // Send last breath cue
  useEffect(() => {
    if (!isRunning || !isConnected) return;

    if (flow.timerMode === 'breaths' && timeLeft === 1 && lastBreathCuedRef.current !== currentIndex) {
      lastBreathCuedRef.current = currentIndex;
      cueLastBreath();
    }
  }, [timeLeft, isRunning, isConnected, flow.timerMode, currentIndex, cueLastBreath]);

  // Send start cue when connection is established and we're waiting for it
  useEffect(() => {
    if (pendingStartCue && isConnected && !startCuedRef.current) {
      console.log('[FlowPlayer] Connection ready, sending start cue');
      startCuedRef.current = true;
      setPendingStartCue(false);
      cueStart(currentPose.pose.englishName);
      // AI will call start_timer when ready
    }
  }, [pendingStartCue, isConnected, cueStart, currentPose.pose.englishName]);

  // Handle Start button click
  const handleStart = useCallback(async () => {
    if (!isSessionActive) {
      // Starting the session
      setIsSessionActive(true);
      isSessionActiveRef.current = true; // Update ref immediately for callbacks

      // Keep screen on during session
      requestWakeLock();

      // Connect to voice if not connected
      if (!isConnected && voiceStatus !== 'connecting') {
        // Set pending flag - the effect will send the cue when connected
        setPendingStartCue(true);
        await connect();
      } else if (isConnected) {
        // Already connected, send cue directly
        if (!startCuedRef.current) {
          startCuedRef.current = true;
          cueStart(currentPose.pose.englishName);
          // AI will call start_timer when ready
        }
      }
    } else {
      // Pausing the session
      setIsSessionActive(false);
      isSessionActiveRef.current = false; // Update ref immediately for callbacks

      // Cancel any ongoing speech immediately
      if (isConnected) {
        cancelResponse();
      }

      releaseWakeLock();
      pause();
    }
  }, [isSessionActive, isConnected, voiceStatus, connect, cueStart, currentPose.pose.englishName, pause, cancelResponse, requestWakeLock, releaseWakeLock]);

  // Navigate to previous pose
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const prevPose = flow.poses[newIndex];

      // Cancel any ongoing speech first
      if (isConnected) {
        cancelResponse();
      }

      setCurrentIndex(newIndex);
      reset(prevPose.duration);

      if (isConnected && isSessionActive) {
        // AI will call start_timer when ready
        cueNext(prevPose.pose.englishName, prevPose.side);
      } else if (isSessionActive) {
        // No voice connection, start timer immediately
        start();
      }
    }
  }, [currentIndex, flow.poses, reset, isConnected, cancelResponse, cueNext, isSessionActive, start]);

  // Navigate to next pose
  const goToNext = useCallback(() => {
    // Cancel any ongoing speech first
    if (isConnected) {
      cancelResponse();
    }

    if (!isLastPose) {
      const newIndex = currentIndex + 1;
      const nextPose = flow.poses[newIndex];

      setCurrentIndex(newIndex);
      reset(nextPose.duration);

      if (isConnected && isSessionActive) {
        // AI will call start_timer when ready
        cueNext(nextPose.pose.englishName, nextPose.side);
      } else if (isSessionActive) {
        // No voice connection, start timer immediately
        start();
      }
    } else {
      if (isConnected) {
        cueComplete();
      }
      saveFlow(flow);
      router.push('/archive');
    }
  }, [currentIndex, isLastPose, flow, reset, isConnected, cancelResponse, cueNext, cueComplete, isSessionActive, start, router]);

  const finishFlow = () => {
    releaseWakeLock();
    disconnect();
    router.push('/archive');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      disconnect();
    };
  }, [disconnect, releaseWakeLock]);

  // Show completion screen
  if (flowCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-white flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">🧘‍♀️</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Goed gedaan!
          </h1>
          <p className="text-gray-600 mb-8">
            Je hebt de flow voltooid.
          </p>
          <div className="space-y-3">
            <button
              onClick={finishFlow}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg"
            >
              Bekijk Archief
            </button>
            <button
              onClick={() => {
                disconnect();
                router.push('/');
              }}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-colors"
            >
              Nieuwe Flow
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIndicator = () => {
    if (voiceStatus === 'connected') {
      return (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Live
        </span>
      );
    }
    if (voiceStatus === 'connecting') {
      return <span className="text-sm text-orange-500">Verbinden...</span>;
    }
    if (voiceStatus === 'error') {
      return <span className="text-sm text-red-500">Fout</span>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              disconnect();
              router.push('/');
            }}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            ✕
          </button>
          <div className="flex items-center gap-2">
            {getStatusIndicator()}
            <span className="text-sm text-gray-500">
              {currentIndex + 1} / {flow.poses.length}
            </span>
          </div>
          <button
            onClick={goToNext}
            className="text-indigo-600 hover:text-indigo-800 p-2 text-sm font-medium"
          >
            Skip
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${((currentIndex) / flow.poses.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PoseCard
          flowPose={currentPose}
          timerMode={flow.timerMode}
          breathPace={flow.breathPace}
          timeLeft={timeLeft}
          breathPhase={breathPhase}
          isRunning={isRunning}
          isSessionActive={isSessionActive}
          progress={progress}
          onToggle={handleStart}
        />
      </div>

      {/* Navigation */}
      <div className="px-4 pb-6 pt-2">
        <div className="flex gap-3">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="w-16 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ←
          </button>
          <button
            onClick={handleStart}
            disabled={voiceStatus === 'connecting'}
            className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-colors shadow-lg disabled:opacity-50 ${
              isSessionActive
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {voiceStatus === 'connecting' ? 'Verbinden...' : isSessionActive ? 'Pauzeer' : 'Start'}
          </button>
          <button
            onClick={goToNext}
            className="w-16 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
