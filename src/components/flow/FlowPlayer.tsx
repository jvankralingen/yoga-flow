'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Flow } from '@/lib/types';
import { useRealtimeYoga } from '@/hooks/useRealtimeYoga';
import { useAmbientSound } from '@/hooks/useAmbientSound';
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

  // Track if we've started the session
  const sessionStartedRef = useRef(false);
  const [pendingStart, setPendingStart] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(true);

  // Ambient nature sounds
  const {
    isPlaying: isAmbientPlaying,
    isLoaded: isAmbientLoaded,
    play: playAmbient,
    stop: stopAmbient,
  } = useAmbientSound({
    src: '/audio/ambient-birds.mp3',
    volume: 0.15,
    fadeInDuration: 3000,
    fadeOutDuration: 2000,
  });

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

  // Handle when AI tells us which pose to show
  const handleShowPose = useCallback((poseIndex: number) => {
    console.log('[FlowPlayer] AI says show pose:', poseIndex);
    if (poseIndex >= 0 && poseIndex < flow.poses.length) {
      setCurrentIndex(poseIndex);
    }
  }, [flow.poses.length]);

  // Handle when AI signals session is complete
  const handleSessionComplete = useCallback(() => {
    console.log('[FlowPlayer] AI signaled session complete');
    setFlowCompleted(true);
    saveFlow(flow);
  }, [flow]);

  // Realtime yoga voice - AI controls everything
  const {
    status: voiceStatus,
    isConnected,
    isSpeaking,
    timerProgress,
    connect,
    disconnect,
    cancelResponse,
    startSession,
    skipToPose,
  } = useRealtimeYoga({
    flow,
    onShowPose: handleShowPose,
    onSessionComplete: handleSessionComplete,
  });

  // Start the session when connection is established
  useEffect(() => {
    if (pendingStart && isConnected && !sessionStartedRef.current) {
      console.log('[FlowPlayer] Connection ready, starting session');
      sessionStartedRef.current = true;
      setPendingStart(false);
      startSession();
    }
  }, [pendingStart, isConnected, startSession]);

  // Handle Start button click
  const handleStart = useCallback(async () => {
    if (!isSessionActive) {
      // Starting the session
      setIsSessionActive(true);

      // Keep screen on during session
      requestWakeLock();

      // Start ambient sound if enabled and loaded
      if (ambientEnabled && isAmbientLoaded) {
        playAmbient();
      }

      // Connect to voice if not connected
      if (!isConnected && voiceStatus !== 'connecting') {
        setPendingStart(true);
        await connect();
      } else if (isConnected) {
        // Already connected, start session directly
        if (!sessionStartedRef.current) {
          sessionStartedRef.current = true;
          startSession();
        }
      }
    } else {
      // Pausing the session
      setIsSessionActive(false);

      // Stop ambient sound
      stopAmbient();

      // Cancel any ongoing speech
      if (isConnected) {
        cancelResponse();
      }

      releaseWakeLock();
    }
  }, [isSessionActive, isConnected, voiceStatus, connect, startSession, cancelResponse, requestWakeLock, releaseWakeLock, ambientEnabled, isAmbientLoaded, playAmbient, stopAmbient]);

  // Navigate to previous pose manually
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const prevPose = flow.poses[newIndex];

      console.log('[FlowPlayer] goToPrevious:', newIndex, prevPose.pose.englishName);
      setCurrentIndex(newIndex);

      // If session is active, also update the AI/timers
      if (isConnected && isSessionActive) {
        skipToPose(newIndex, prevPose.pose.englishName);
      }
    }
  }, [currentIndex, flow.poses, isConnected, isSessionActive, skipToPose]);

  // Navigate to next pose manually (skip)
  const goToNext = useCallback(() => {
    const isLastPose = currentIndex === flow.poses.length - 1;

    if (!isLastPose) {
      const newIndex = currentIndex + 1;
      const nextPose = flow.poses[newIndex];

      console.log('[FlowPlayer] goToNext:', newIndex, nextPose.pose.englishName);
      setCurrentIndex(newIndex);

      // If session is active, also update the AI/timers
      if (isConnected && isSessionActive) {
        skipToPose(newIndex, nextPose.pose.englishName);
      }
    } else {
      saveFlow(flow);
      router.push('/archive');
    }
  }, [currentIndex, flow, isConnected, isSessionActive, skipToPose, router]);

  const finishFlow = () => {
    releaseWakeLock();
    stopAmbient();
    disconnect();
    router.push('/archive');
  };

  // Toggle ambient sound
  const toggleAmbient = useCallback(() => {
    if (isAmbientPlaying) {
      stopAmbient();
      setAmbientEnabled(false);
    } else if (isAmbientLoaded && isSessionActive) {
      playAmbient();
      setAmbientEnabled(true);
    } else {
      setAmbientEnabled(!ambientEnabled);
    }
  }, [isAmbientPlaying, isAmbientLoaded, isSessionActive, playAmbient, stopAmbient, ambientEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
      stopAmbient();
      disconnect();
    };
  }, [disconnect, releaseWakeLock, stopAmbient]);

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
          <div className="flex items-center gap-2">
            {/* Ambient sound toggle */}
            {isAmbientLoaded && (
              <button
                onClick={toggleAmbient}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: ambientEnabled ? 'var(--primary-light)' : 'var(--sand)',
                  color: ambientEnabled ? 'white' : 'var(--bark)',
                }}
                title={ambientEnabled ? 'Achtergrondgeluid uit' : 'Achtergrondgeluid aan'}
              >
                {ambientEnabled ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3c.5 0 1 .19 1.41.59.4.4.59.91.59 1.41v14c0 .5-.19 1.01-.59 1.41-.4.4-.91.59-1.41.59-.5 0-1.01-.19-1.41-.59C10.19 20.01 10 19.5 10 19V5c0-.5.19-1.01.59-1.41.4-.4.91-.59 1.41-.59zM7 8c.5 0 1 .19 1.41.59.4.4.59.91.59 1.41v4c0 .5-.19 1.01-.59 1.41-.4.4-.91.59-1.41.59-.5 0-1.01-.19-1.41-.59C5.19 15.01 5 14.5 5 14v-4c0-.5.19-1.01.59-1.41C5.99 8.19 6.5 8 7 8zm10 0c.5 0 1 .19 1.41.59.4.4.59.91.59 1.41v4c0 .5-.19 1.01-.59 1.41-.4.4-.91.59-1.41.59-.5 0-1.01-.19-1.41-.59-.4-.4-.59-.91-.59-1.41v-4c0-.5.19-1.01.59-1.41.4-.4.91-.59 1.41-.59z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18M12 5v8.5M7 8v4M17 8v8"/>
                  </svg>
                )}
              </button>
            )}
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
          timerProgress={timerProgress}
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
