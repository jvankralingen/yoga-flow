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

      // Preload the audio
      audio.preload = 'auto';

      audio.onended = () => {
        setAudioTestStatus('success');
        setTimeout(() => setAudioTestStatus('idle'), 2000);
      };

      audio.onerror = (e) => {
        console.error('[Test Audio] Error:', e);
        setAudioTestStatus('error');
        setTimeout(() => setAudioTestStatus('idle'), 2000);
      };

      // Wait for audio to be ready before playing
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error('Failed to load audio'));
        audio.load();
      });

      await audio.play();
    } catch (error) {
      console.error('[Test Audio] Play failed:', error);
      setAudioTestStatus('error');
      setTimeout(() => setAudioTestStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4">
      <div className="text-center">
        <h2
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--earth)' }}
        >
          Voorkeuren
        </h2>
        <p style={{ color: 'var(--bark)' }}>
          Pas je sessie aan naar jouw wensen
        </p>
      </div>

      {/* Timer Mode */}
      <div className="w-full max-w-sm">
        <label
          className="block text-sm font-medium mb-3"
          style={{ color: 'var(--bark)' }}
        >
          Timer modus
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onTimerModeChange('seconds')}
            className="py-4 px-3 rounded-2xl text-base font-medium transition-all flex flex-col items-center gap-2"
            style={{
              backgroundColor: timerMode === 'seconds' ? 'var(--primary)' : 'var(--cream)',
              color: timerMode === 'seconds' ? 'white' : 'var(--earth)',
              boxShadow: timerMode === 'seconds' ? '0 4px 14px rgba(107, 142, 107, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <span className="text-2xl">⏱️</span>
            <span>Seconden</span>
          </button>
          <button
            onClick={() => onTimerModeChange('breaths')}
            className="py-4 px-3 rounded-2xl text-base font-medium transition-all flex flex-col items-center gap-2"
            style={{
              backgroundColor: timerMode === 'breaths' ? 'var(--primary)' : 'var(--cream)',
              color: timerMode === 'breaths' ? 'white' : 'var(--earth)',
              boxShadow: timerMode === 'breaths' ? '0 4px 14px rgba(107, 142, 107, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <span className="text-2xl">🌬️</span>
            <span>Ademhalingen</span>
          </button>
        </div>
      </div>

      {/* Breath Pace - only show when breaths mode is selected */}
      {timerMode === 'breaths' && (
        <div className="w-full max-w-sm">
          <label
            className="block text-sm font-medium mb-3"
            style={{ color: 'var(--bark)' }}
          >
            Ademhalingstempo
          </label>
          <div className="grid grid-cols-3 gap-2">
            {breathPaces.map((pace) => (
              <button
                key={pace}
                onClick={() => onBreathPaceChange(pace)}
                className="py-3 px-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: breathPace === pace ? 'var(--primary)' : 'var(--cream)',
                  color: breathPace === pace ? 'white' : 'var(--earth)',
                  boxShadow: breathPace === pace ? '0 4px 14px rgba(107, 142, 107, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
              >
                {BREATH_PACE_LABELS[pace]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice */}
      <div className="w-full max-w-sm">
        <label
          className="block text-sm font-medium mb-3"
          style={{ color: 'var(--bark)' }}
        >
          Stem begeleiding
        </label>
        <button
          onClick={() => onVoiceEnabledChange(!voiceEnabled)}
          className="w-full py-4 px-4 rounded-2xl text-base font-medium transition-all flex items-center justify-between"
          style={{
            backgroundColor: voiceEnabled ? 'var(--primary)' : 'var(--cream)',
            color: voiceEnabled ? 'white' : 'var(--earth)',
            boxShadow: voiceEnabled ? '0 4px 14px rgba(107, 142, 107, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔊</span>
            <div className="text-left">
              <span className="block">Spraakbegeleiding</span>
              <span
                className="text-xs"
                style={{ color: voiceEnabled ? 'rgba(255,255,255,0.7)' : 'var(--bark)' }}
              >
                AI yoga instructeur
              </span>
            </div>
          </div>
          <div
            className="w-12 h-7 rounded-full transition-colors relative"
            style={{ backgroundColor: voiceEnabled ? 'var(--primary-light)' : 'var(--stone)' }}
          >
            <div
              className="absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: voiceEnabled ? 'translateX(1.25rem)' : 'translateX(0.25rem)' }}
            />
          </div>
        </button>

        {/* Test Audio Button */}
        {voiceEnabled && (
          <button
            onClick={testAudio}
            disabled={audioTestStatus === 'playing'}
            className="mt-3 w-full py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: audioTestStatus === 'success'
                ? '#D1FAE5'
                : audioTestStatus === 'error'
                ? '#FEE2E2'
                : audioTestStatus === 'playing'
                ? 'var(--sand)'
                : 'var(--cream)',
              color: audioTestStatus === 'success'
                ? '#065F46'
                : audioTestStatus === 'error'
                ? '#991B1B'
                : 'var(--earth)',
            }}
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
        <label
          className="block text-sm font-medium mb-3"
          style={{ color: 'var(--bark)' }}
        >
          Niveau
        </label>
        <div className="grid grid-cols-3 gap-2">
          {difficulties.map((diff) => (
            <button
              key={diff}
              onClick={() => onDifficultyChange(diff)}
              className="py-3 px-2 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: difficulty === diff ? 'var(--primary)' : 'var(--cream)',
                color: difficulty === diff ? 'white' : 'var(--earth)',
                boxShadow: difficulty === diff ? '0 4px 14px rgba(107, 142, 107, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
              }}
            >
              {DIFFICULTY_LABELS[diff]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-sm mt-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 rounded-2xl font-semibold text-lg transition-colors"
          style={{
            backgroundColor: 'var(--sand)',
            color: 'var(--earth)',
          }}
        >
          Terug
        </button>
        <button
          onClick={onStart}
          className="flex-1 py-4 text-white rounded-2xl font-semibold text-lg transition-all"
          style={{
            backgroundColor: 'var(--primary)',
            boxShadow: '0 4px 14px rgba(107, 142, 107, 0.3)',
          }}
        >
          Start Flow
        </button>
      </div>
    </div>
  );
}
