'use client';

import { FlowPose, TimerMode, BreathPace } from '@/lib/types';

interface PoseCardProps {
  flowPose: FlowPose;
  timerMode: TimerMode;
  breathPace: BreathPace;
  timeLeft: number;
  breathPhase: 'inhale' | 'exhale';
  isRunning: boolean;
  isSessionActive: boolean;
  progress: number;
  timerProgress?: number; // 0 to 1
  onToggle: () => void;
  hideTimer?: boolean;
}

export function PoseCard({
  flowPose,
  isSessionActive,
  timerProgress = 0,
  hideTimer = false,
}: PoseCardProps) {
  const { pose, side } = flowPose;

  const getSideLabel = () => {
    if (!side) return null;
    return side === 'left' ? 'Links' : 'Rechts';
  };

  // SVG circle progress
  const circleSize = 340;
  const strokeWidth = 6;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - timerProgress);

  return (
    <div className="flex flex-col h-full">
      {/* Pose image area */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, #E8E2D9, #F7F4EF)',
        }}
      >
        {/* Side indicator */}
        {side && (
          <span
            className="absolute top-4 left-4 z-20 px-4 py-1.5 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {getSideLabel()}
          </span>
        )}

        {/* Pose image with circular progress */}
        <div className="relative z-10 flex items-center justify-center" style={{ width: '340px', height: '340px' }}>
          {/* Progress ring SVG */}
          {isSessionActive && (
            <svg
              width={circleSize}
              height={circleSize}
              className="absolute inset-0"
              style={{ transform: 'rotate(-90deg)' }}
            >
              {/* Background circle */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="none"
                stroke="rgba(107, 142, 107, 0.15)"
                strokeWidth={strokeWidth}
              />
              {/* Progress circle */}
              <circle
                cx={circleSize / 2}
                cy={circleSize / 2}
                r={radius}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
          )}

          {/* Pose image container */}
          <div
            className={`absolute flex items-center justify-center ${side === 'left' ? 'scale-x-[-1]' : ''}`}
            style={{
              width: '320px',
              height: '320px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.7)',
              boxShadow: '0 8px 40px rgba(107, 142, 107, 0.15), 0 4px 20px rgba(0, 0, 0, 0.05)',
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

      {/* Pose info card */}
      <div
        className="mx-4 -mt-6 relative z-20 rounded-3xl p-5"
        style={{
          backgroundColor: 'var(--cream)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2
              className="text-2xl font-bold"
              style={{ color: 'var(--earth)' }}
            >
              {pose.englishName}
            </h2>
            <p
              className="text-sm italic"
              style={{ color: 'var(--primary)' }}
            >
              {pose.sanskritName}
            </p>
          </div>

          {/* Session status indicator */}
          {isSessionActive && !hideTimer && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'var(--sand)' }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--primary)' }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--bark)' }}
              >
                {Math.round(timerProgress * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--bark)' }}
        >
          {pose.description}
        </p>
      </div>
    </div>
  );
}
