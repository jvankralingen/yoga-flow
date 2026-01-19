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
    console.log('[FlowPlayer] AI signaled pose complete');

    if (!isLastPose) {
      const newIndex = currentIndex + 1;
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
  }, [isLastPose, flow, currentIndex]);

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
    if (isSpeaking) {
      return (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Spreekt...
        </span>
      );
    }
    if (voiceStatus === 'connected') {
      return (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
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

      {/* Main content - simplified PoseCard without timer */}
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
