'use client';

import { FlowPose, TimerMode, BreathPace, BREATH_PACE_SECONDS } from '@/lib/types';

interface PoseCardProps {
  flowPose: FlowPose;
  timerMode: TimerMode;
  breathPace: BreathPace;
  timeLeft: number;
  breathPhase: 'inhale' | 'exhale';
  isRunning: boolean;
  isSessionActive: boolean;
  progress: number;
  onToggle: () => void;
  hideTimer?: boolean;
}

export function PoseCard({
  flowPose,
  timerMode,
  breathPace,
  timeLeft,
  breathPhase,
  isRunning,
  isSessionActive,
  progress,
  onToggle,
  hideTimer = false,
}: PoseCardProps) {
  const { pose, side } = flowPose;

  // Calculate breath phase duration for animations (half of full breath cycle)
  const breathPhaseDuration = (BREATH_PACE_SECONDS[breathPace] / 2) * 1000;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const getSideLabel = () => {
    if (!side) return null;
    return side === 'left' ? 'Links' : 'Rechts';
  };

  // Determine if breathing animation should be active
  const isBreathing = timerMode === 'breaths' && isRunning;

  return (
    <div className="flex flex-col h-full">
      {/* Pose image area - full width on mobile */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, rgb(224, 231, 255), rgb(238, 242, 255))',
        }}
      >
        {/* Breathing overlay - fades in/out for smooth transition */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgb(199, 210, 254), rgb(212, 221, 254))',
            opacity: isBreathing && breathPhase === 'exhale' ? 1 : 0,
            transition: `opacity ${breathPhaseDuration}ms ease-in-out`,
          }}
        />

        {/* Progress bar at bottom */}
        <div
          className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-300"
          style={{
            width: `${progress * 100}%`,
          }}
        />

        {/* Side indicator */}
        {side && (
          <span className="absolute top-4 left-4 z-20 px-4 py-1 bg-indigo-600 text-white rounded-full text-sm font-medium">
            {getSideLabel()}
          </span>
        )}

        {/* Pose image with breathing effect - fixed height container */}
        <div className="relative z-10 w-full flex items-center justify-center" style={{ height: '380px' }}>
          <div
            className={`flex items-center justify-center ${side === 'left' ? 'scale-x-[-1]' : ''}`}
            style={{
              width: isBreathing
                ? breathPhase === 'inhale' ? '340px' : '300px'
                : '340px',
              height: isBreathing
                ? breathPhase === 'inhale' ? '340px' : '300px'
                : '340px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.5)',
              boxShadow: isBreathing
                ? breathPhase === 'inhale'
                  ? '0 0 60px 20px rgba(165, 180, 252, 0.5), 0 0 100px 40px rgba(199, 210, 254, 0.3)'
                  : '0 0 30px 10px rgba(165, 180, 252, 0.3), 0 0 50px 20px rgba(199, 210, 254, 0.15)'
                : '0 0 40px 15px rgba(165, 180, 252, 0.4), 0 0 70px 30px rgba(199, 210, 254, 0.2)',
              transition: `width ${breathPhaseDuration}ms ease-in-out, height ${breathPhaseDuration}ms ease-in-out, box-shadow ${breathPhaseDuration}ms ease-in-out`,
            }}
          >
            <img
              src={pose.imageUrl}
              alt={pose.englishName}
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="text-8xl hidden">🧘</span>
          </div>
        </div>
      </div>

      {/* Pose info - compact */}
      <div className="px-4 py-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {pose.englishName}
            </h2>
            <p className="text-indigo-600 text-sm italic">
              {pose.sanskritName}
            </p>
          </div>

          {/* Timer display - compact (hidden in realtime mode) */}
          {!hideTimer && (
            <div
              className="bg-indigo-50 rounded-xl px-4 py-2 text-center cursor-pointer min-w-[100px]"
              onClick={onToggle}
            >
              {timerMode === 'breaths' ? (
                <div>
                  <div
                    className={`text-2xl font-bold transition-all duration-500 ${
                      breathPhase === 'inhale' ? 'text-indigo-600' : 'text-indigo-400'
                    }`}
                  >
                    {timeLeft}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isSessionActive ? (
                      <span className={breathPhase === 'inhale' ? 'text-indigo-600' : 'text-indigo-400'}>
                        {breathPhase === 'inhale' ? '↑ In' : '↓ Uit'}
                      </span>
                    ) : (
                      'Start'
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold text-indigo-600">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isSessionActive ? 'Pauze' : 'Start'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm leading-relaxed">
          {pose.description}
        </p>
      </div>
    </div>
  );
}
