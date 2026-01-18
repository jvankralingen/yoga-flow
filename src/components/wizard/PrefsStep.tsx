'use client';

import { useState } from 'react';
import { TimerMode, Difficulty, BreathPace, DIFFICULTY_LABELS, BREATH_PACE_LABELS } from '@/lib/types';

interface PrefsStepProps {
  timerMode: TimerMode;
  breathPace: BreathPace;
  voiceEnabled: boolean;
  difficulty: Difficulty;
  onTimerModeChange: (mode: TimerMode) => void;
  onBreathPaceChange: (pace: BreathPace) => void;
  onVoiceEnabledChange: (enabled: boolean) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onStart: () => void;
  onBack: () => void;
}

const difficulties: Difficulty[] = ['beginner', 'intermediate', 'expert'];
const breathPaces: BreathPace[] = ['slow', 'normal', 'fast'];

export function PrefsStep({
  timerMode,
  breathPace,
  voiceEnabled,
  difficulty,
  onTimerModeChange,
  onBreathPaceChange,
  onVoiceEnabledChange,
  onDifficultyChange,
  onStart,
  onBack,
}: PrefsStepProps) {
  const [audioTestStatus, setAudioTestStatus] = useState<'idle' | 'playing' | 'success' | 'error'>('idle');

  const testAudio = async () => {
    setAudioTestStatus('playing');

    try {
      // Use pre-generated audio file
      const audio = new Audio('/audio/test.mp3');

      audio.onended = () => {
        setAudioTestStatus('success');
        setTimeout(() => setAudioTestStatus('idle'), 2000);
      };

      audio.onerror = () => {
        setAudioTestStatus('error');
        setTimeout(() => setAudioTestStatus('idle'), 2000);
      };

      await audio.play();
    } catch (error) {
      setAudioTestStatus('error');
      setTimeout(() => setAudioTestStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 px-4">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Voorkeuren
        </h2>
        <p className="text-gray-500">
          Pas je sessie aan naar jouw wensen
        </p>
      </div>

      {/* Timer Mode */}
      <div className="w-full max-w-sm">
        <label className="block text-sm font-medium text-gray-600 mb-3">
          Timer modus
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onTimerModeChange('seconds')}
            className={`
              py-4 px-3 rounded-2xl text-base font-medium transition-all flex flex-col items-center gap-2
              ${timerMode === 'seconds'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
              }
            `}
          >
            <span className="text-2xl">⏱️</span>
            <span>Seconden</span>
          </button>
          <button
            onClick={() => onTimerModeChange('breaths')}
            className={`
              py-4 px-3 rounded-2xl text-base font-medium transition-all flex flex-col items-center gap-2
              ${timerMode === 'breaths'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
              }
            `}
          >
            <span className="text-2xl">🌬️</span>
            <span>Ademhalingen</span>
          </button>
        </div>
      </div>

      {/* Breath Pace - only show when breaths mode is selected */}
      {timerMode === 'breaths' && (
        <div className="w-full max-w-sm">
          <label className="block text-sm font-medium text-gray-600 mb-3">
            Ademhalingstempo
          </label>
          <div className="grid grid-cols-3 gap-2">
            {breathPaces.map((pace) => (
              <button
                key={pace}
                onClick={() => onBreathPaceChange(pace)}
                className={`
                  py-3 px-2 rounded-xl text-sm font-medium transition-all
                  ${breathPace === pace
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
                  }
                `}
              >
                {BREATH_PACE_LABELS[pace]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice */}
      <div className="w-full max-w-sm">
        <label className="block text-sm font-medium text-gray-600 mb-3">
          Stem begeleiding
        </label>
        <button
          onClick={() => onVoiceEnabledChange(!voiceEnabled)}
          className={`
            w-full py-4 px-4 rounded-2xl text-base font-medium transition-all flex items-center justify-between
            ${voiceEnabled
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔊</span>
            <div className="text-left">
              <span className="block">Spraakbegeleiding</span>
              <span className={`text-xs ${voiceEnabled ? 'text-indigo-200' : 'text-gray-500'}`}>
                Hoort poses en ademhalingsinstructies
              </span>
            </div>
          </div>
          <div className={`
            w-12 h-7 rounded-full transition-colors relative
            ${voiceEnabled ? 'bg-indigo-400' : 'bg-gray-300'}
          `}>
            <div className={`
              absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform
              ${voiceEnabled ? 'translate-x-6' : 'translate-x-1'}
            `} />
          </div>
        </button>

        {/* Test Audio Button */}
        {voiceEnabled && (
          <button
            onClick={testAudio}
            disabled={audioTestStatus === 'playing'}
            className={`
              mt-3 w-full py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2
              ${audioTestStatus === 'success'
                ? 'bg-green-100 text-green-700 border-2 border-green-300'
                : audioTestStatus === 'error'
                ? 'bg-red-100 text-red-700 border-2 border-red-300'
                : audioTestStatus === 'playing'
                ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-300'
                : 'bg-gray-100 text-gray-700 border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
              }
            `}
          >
            {audioTestStatus === 'playing' && (
              <>
                <span className="animate-pulse">🔊</span>
                <span>Speelt af...</span>
              </>
            )}
            {audioTestStatus === 'success' && (
              <>
                <span>✓</span>
                <span>Audio werkt!</span>
              </>
            )}
            {audioTestStatus === 'error' && (
              <>
                <span>✕</span>
                <span>Audio werkt niet</span>
              </>
            )}
            {audioTestStatus === 'idle' && (
              <>
                <span>🔊</span>
                <span>Test audio</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Difficulty */}
      <div className="w-full max-w-sm">
        <label className="block text-sm font-medium text-gray-600 mb-3">
          Niveau
        </label>
        <div className="grid grid-cols-3 gap-2">
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => onDifficultyChange(diff)}
              className={`
                py-3 px-2 rounded-xl text-sm font-medium transition-all
                ${difficulty === diff
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
                }
              `}
            >
              {DIFFICULTY_LABELS[diff]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-sm mt-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-colors"
        >
          Terug
        </button>
        <button
          onClick={onStart}
          className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-semibold text-lg hover:bg-green-700 transition-colors shadow-lg"
        >
          Start Flow
        </button>
      </div>
    </div>
  );
}
