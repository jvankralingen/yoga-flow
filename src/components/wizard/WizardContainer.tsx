'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardState, FocusArea, TimerMode, BreathPace, Difficulty } from '@/lib/types';
import { generateFlow, generateTestFlow } from '@/lib/flowGenerator';
import { saveFlow } from '@/lib/storage';
import { TimeStep } from './TimeStep';
import { FocusStep } from './FocusStep';
import { PrefsStep } from './PrefsStep';

const TOTAL_STEPS = 3;

export function WizardContainer() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>({
    step: 1,
    duration: null,
    focusAreas: [],
    timerMode: 'breaths',
    breathPace: 'normal',
    voiceEnabled: true,
    difficulty: 'beginner',
  });

  const setDuration = (duration: number) => {
    setState(prev => ({ ...prev, duration }));
  };

  const setFocusAreas = (focusAreas: FocusArea[]) => {
    setState(prev => ({ ...prev, focusAreas }));
  };

  const setTimerMode = (timerMode: TimerMode) => {
    setState(prev => ({ ...prev, timerMode }));
  };

  const setBreathPace = (breathPace: BreathPace) => {
    setState(prev => ({ ...prev, breathPace }));
  };

  const setVoiceEnabled = (voiceEnabled: boolean) => {
    setState(prev => ({ ...prev, voiceEnabled }));
  };

  const setDifficulty = (difficulty: Difficulty) => {
    setState(prev => ({ ...prev, difficulty }));
  };

  const nextStep = () => {
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, TOTAL_STEPS) }));
  };

  const prevStep = () => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }));
  };

  const handleStart = () => {
    if (!state.duration || state.focusAreas.length === 0) return;

    const flow = generateFlow({
      duration: state.duration,
      focusAreas: state.focusAreas,
      timerMode: state.timerMode,
      breathPace: state.breathPace,
      voiceEnabled: state.voiceEnabled,
      difficulty: state.difficulty,
    });

    saveFlow(flow);
    router.push(`/flow/${flow.id}`);
  };

  const handleTestMode = () => {
    const flow = generateTestFlow();
    saveFlow(flow);
    router.push(`/flow/${flow.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col">
      {/* Progress indicator */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex justify-center gap-2 mb-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all ${
                step === state.step
                  ? 'w-8 bg-indigo-600'
                  : step < state.step
                  ? 'w-2 bg-indigo-400'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-gray-500">
          Stap {state.step} van {TOTAL_STEPS}
        </p>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center py-8">
        {state.step === 1 && (
          <TimeStep
            value={state.duration}
            onChange={setDuration}
            onNext={nextStep}
            onTestMode={handleTestMode}
          />
        )}

        {state.step === 2 && (
          <FocusStep
            value={state.focusAreas}
            onChange={setFocusAreas}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}

        {state.step === 3 && (
          <PrefsStep
            timerMode={state.timerMode}
            breathPace={state.breathPace}
            voiceEnabled={state.voiceEnabled}
            difficulty={state.difficulty}
            onTimerModeChange={setTimerMode}
            onBreathPaceChange={setBreathPace}
            onVoiceEnabledChange={setVoiceEnabled}
            onDifficultyChange={setDifficulty}
            onStart={handleStart}
            onBack={prevStep}
          />
        )}
      </div>
    </div>
  );
}
