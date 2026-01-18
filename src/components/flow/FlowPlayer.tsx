'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Flow } from '@/lib/types';
import { useTimer } from '@/hooks/useTimer';
import { useVoice } from '@/hooks/useVoice';
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
  const currentPose = flow.poses[currentIndex];
  const isLastPose = currentIndex === flow.poses.length - 1;
  const announcedIndexRef = useRef(-1);

  const { speakPose, speakDuration, speakLastBreath, speakComplete, stop: stopVoice, unlockAudio } = useVoice({
    enabled: flow.voiceEnabled,
  });
  const lastBreathAnnouncedRef = useRef(-1);

  const handleComplete = useCallback(() => {
    if (!isLastPose) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setFlowCompleted(true);
      saveFlow(flow);
    }
  }, [isLastPose, flow]);

  const {
    timeLeft,
    isRunning,
    breathPhase,
    progress,
    toggle,
    reset,
    start,
  } = useTimer({
    initialTime: currentPose.duration,
    mode: flow.timerMode,
    breathPace: flow.breathPace,
    onComplete: handleComplete,
    autoStart: false,
  });

  // Handle pose change - reset timer and announce (for poses after the first)
  useEffect(() => {
    if (announcedIndexRef.current === currentIndex) {
      return;
    }

    // For first pose, don't auto-announce - wait for user click
    if (currentIndex === 0) {
      reset(flow.poses[currentIndex].duration);
      return;
    }

    announcedIndexRef.current = currentIndex;
    reset(flow.poses[currentIndex].duration);

    const flowPose = flow.poses[currentIndex];
    let cancelled = false;

    // Announce the new pose after a small delay, then duration, then start timer
    setIsSessionActive(true);
    const announceTimer = setTimeout(async () => {
      await speakPose(flowPose.pose.englishName, flowPose.pose.description, flowPose.side);
      if (cancelled) return;
      await speakDuration(flowPose.duration, flow.timerMode);
      if (!cancelled) {
        start();
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(announceTimer);
    };
  }, [currentIndex, flow.poses, flow.timerMode, reset, speakPose, speakDuration, start]);

  // Announce last breath when timeLeft reaches 1 (in breaths mode)
  useEffect(() => {
    if (
      flow.timerMode === 'breaths' &&
      timeLeft === 1 &&
      isRunning &&
      lastBreathAnnouncedRef.current !== currentIndex
    ) {
      lastBreathAnnouncedRef.current = currentIndex;
      speakLastBreath();
    }
  }, [timeLeft, isRunning, currentIndex, flow.timerMode, speakLastBreath]);

  // Announce completion
  useEffect(() => {
    if (flowCompleted) {
      speakComplete();
    }
  }, [flowCompleted, speakComplete]);

  // Handle Start button click - announces first pose and starts timer
  const handleStart = useCallback(async () => {
    if (!isSessionActive) {
      // Starting the session
      setIsSessionActive(true);

      // Unlock audio for mobile browsers (must happen in user gesture context)
      await unlockAudio();

      if (currentIndex === 0 && announcedIndexRef.current === -1) {
        // First time clicking start - announce the pose, then start timer after audio
        announcedIndexRef.current = 0;
        const flowPose = flow.poses[0];
        await speakPose(flowPose.pose.englishName, flowPose.pose.description, flowPose.side);
        await speakDuration(flowPose.duration, flow.timerMode);
        start(); // Start timer after audio finishes
        return;
      }
      start();
    } else {
      // Pausing the session
      setIsSessionActive(false);
      stopVoice();
      toggle();
    }
  }, [isSessionActive, currentIndex, flow.poses, flow.timerMode, speakPose, speakDuration, start, toggle, stopVoice, unlockAudio]);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      stopVoice();
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToNext = () => {
    stopVoice();
    if (!isLastPose) {
      setCurrentIndex(prev => prev + 1);
    } else {
      saveFlow(flow);
      router.push('/archive');
    }
  };

  const skipPose = () => {
    goToNext();
  };

  const finishFlow = () => {
    router.push('/archive');
  };

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
              onClick={() => router.push('/')}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-colors"
            >
              Nieuwe Flow
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            ✕
          </button>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {flow.poses.length}
          </span>
          <button
            onClick={skipPose}
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
            className={`flex-1 py-3 rounded-xl font-semibold text-lg transition-colors shadow-lg ${
              isSessionActive
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isSessionActive ? 'Pauzeer' : 'Start'}
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
