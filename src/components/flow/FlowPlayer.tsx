'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Flow } from '@/lib/types';
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

  // Ref to track current index for callbacks (avoids stale closures)
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Track if we've sent the start cue
  const startCuedRef = useRef(false);
  const [pendingStartCue, setPendingStartCue] = useState(false);

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

  // Handle when AI signals pose is complete
  const handlePoseComplete = useCallback(() => {
    const idx = currentIndexRef.current;
    const lastPose = idx === flow.poses.length - 1;

    console.log('[FlowPlayer] AI signaled pose complete, current index:', idx, 'isLast:', lastPose);

    if (!lastPose) {
      const newIndex = idx + 1;
      const nextPose = flow.poses[newIndex];

      setCurrentIndex(newIndex);

      // AI will receive the NEXT cue and continue guiding
      cueNextRef.current?.(nextPose.pose.englishName, nextPose.side);
    } else {
      // Flow complete
      cueCompleteRef.current?.();
      setFlowCompleted(true);
      saveFlow(flow);
    }
  }, [flow]);

  // Refs for cue functions to avoid stale closures
  const cueNextRef = useRef<(poseName: string, side?: string) => void>(undefined);
  const cueCompleteRef = useRef<() => void>(undefined);

  // Realtime yoga voice
  const {
    status: voiceStatus,
    isConnected,
    isSpeaking,
    connect,
    disconnect,
    cancelResponse,
    cueStart,
    cueNext,
    cueComplete,
  } = useRealtimeYoga({
    flow,
    onPoseComplete: handlePoseComplete,
  });

  // Keep refs updated
  cueNextRef.current = cueNext;
  cueCompleteRef.current = cueComplete;

  // Send start cue when connection is established
  useEffect(() => {
    if (pendingStartCue && isConnected && !startCuedRef.current) {
      console.log('[FlowPlayer] Connection ready, sending start cue');
      startCuedRef.current = true;
      setPendingStartCue(false);
      cueStart(currentPose.pose.englishName);
    }
  }, [pendingStartCue, isConnected, cueStart, currentPose.pose.englishName]);

  // Handle Start button click
  const handleStart = useCallback(async () => {
    if (!isSessionActive) {
      // Starting the session
      setIsSessionActive(true);

      // Keep screen on during session
      requestWakeLock();

      // Connect to voice if not connected
      if (!isConnected && voiceStatus !== 'connecting') {
        setPendingStartCue(true);
        await connect();
      } else if (isConnected) {
        // Already connected, send cue directly
        if (!startCuedRef.current) {
          startCuedRef.current = true;
          cueStart(currentPose.pose.englishName);
        }
      }
    } else {
      // Pausing the session
      setIsSessionActive(false);

      // Cancel any ongoing speech
      if (isConnected) {
        cancelResponse();
      }

      releaseWakeLock();
    }
  }, [isSessionActive, isConnected, voiceStatus, connect, cueStart, currentPose.pose.englishName, cancelResponse, requestWakeLock, releaseWakeLock]);

  // Navigate to previous pose manually
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const prevPose = flow.poses[newIndex];

      if (isConnected) {
        cancelResponse();
      }

      setCurrentIndex(newIndex);

      if (isConnected && isSessionActive) {
        setTimeout(() => {
          cueNext(prevPose.pose.englishName, prevPose.side);
        }, 100);
      }
    }
  }, [currentIndex, flow.poses, isConnected, cancelResponse, cueNext, isSessionActive]);

  // Navigate to next pose manually (skip)
  const goToNext = useCallback(() => {
    if (isConnected) {
      cancelResponse();
    }

    if (!isLastPose) {
      const newIndex = currentIndex + 1;
      const nextPose = flow.poses[newIndex];

      setCurrentIndex(newIndex);

      if (isConnected && isSessionActive) {
        setTimeout(() => {
          cueNext(nextPose.pose.englishName, nextPose.side);
        }, 100);
      }
    } else {
      if (isConnected) {
        setTimeout(() => {
          cueComplete();
        }, 100);
      }
      saveFlow(flow);
      router.push('/archive');
    }
  }, [currentIndex, isLastPose, flow, isConnected, cancelResponse, cueNext, cueComplete, isSessionActive, router]);

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
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="text-center">
          <div
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--sand)' }}
          >
            <span className="text-5xl">🧘‍♀️</span>
          </div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--earth)' }}
          >
            Goed gedaan!
          </h1>
          <p
            className="mb-8"
            style={{ color: 'var(--bark)' }}
          >
            Je hebt de flow voltooid.
          </p>
          <div className="space-y-3">
            <button
              onClick={finishFlow}
              className="w-full py-4 text-white rounded-2xl font-semibold text-lg transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--primary)',
                boxShadow: '0 4px 14px rgba(107, 142, 107, 0.3)',
              }}
            >
              Bekijk Archief
            </button>
            <button
              onClick={() => {
                disconnect();
                router.push('/');
              }}
              className="w-full py-4 rounded-2xl font-semibold text-lg transition-colors"
              style={{
                backgroundColor: 'var(--sand)',
                color: 'var(--earth)',
              }}
            >
              Nieuwe Flow
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIndicator = () => {
    if (isSpeaking) {
      return (
        <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--primary)' }}>
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--primary)' }}
          />
          Spreekt...
        </span>
      );
    }
    if (voiceStatus === 'connected') {
      return (
        <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--primary)' }}>
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--primary)' }}
          />
          Live
        </span>
      );
    }
    if (voiceStatus === 'connecting') {
      return <span className="text-sm" style={{ color: 'var(--accent)' }}>Verbinden...</span>;
    }
    if (voiceStatus === 'error') {
      return <span className="text-sm text-red-500">Fout</span>;
    }
    return null;
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              disconnect();
              router.push('/');
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--sand)', color: 'var(--bark)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            {getStatusIndicator()}
            <span
              className="text-sm font-medium px-3 py-1 rounded-full"
              style={{ backgroundColor: 'var(--sand)', color: 'var(--bark)' }}
            >
              {currentIndex + 1} / {flow.poses.length}
            </span>
          </div>
          <button
            onClick={goToNext}
            className="text-sm font-medium px-3 py-2 rounded-full transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            Skip
          </button>
        </div>

        {/* Progress bar */}
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--sand)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((currentIndex) / flow.poses.length) * 100}%`,
              backgroundColor: 'var(--primary)',
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PoseCard
          flowPose={currentPose}
          timerMode={flow.timerMode}
          breathPace={flow.breathPace}
          timeLeft={0}
          breathPhase="inhale"
          isRunning={false}
          isSessionActive={isSessionActive}
          progress={currentIndex / flow.poses.length}
          onToggle={handleStart}
          hideTimer={true}
        />
      </div>

      {/* Navigation */}
      <div className="px-4 pb-6 pt-2">
        <div className="flex gap-3">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="w-14 h-14 rounded-2xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ backgroundColor: 'var(--sand)', color: 'var(--bark)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={handleStart}
            disabled={voiceStatus === 'connecting'}
            className="flex-1 py-4 rounded-2xl font-semibold text-lg transition-all disabled:opacity-50 text-white"
            style={{
              backgroundColor: isSessionActive ? 'var(--accent)' : 'var(--primary)',
              boxShadow: isSessionActive
                ? '0 4px 14px rgba(196, 149, 106, 0.3)'
                : '0 4px 14px rgba(107, 142, 107, 0.3)',
            }}
          >
            {voiceStatus === 'connecting' ? 'Verbinden...' : isSessionActive ? 'Pauzeer' : 'Start Sessie'}
          </button>
          <button
            onClick={goToNext}
            className="w-14 h-14 rounded-2xl font-semibold transition-all flex items-center justify-center"
            style={{ backgroundColor: 'var(--sand)', color: 'var(--bark)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
