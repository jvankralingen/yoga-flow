'use client';

interface TimeStepProps {
  value: number | null;
  onChange: (minutes: number) => void;
  onNext: () => void;
  onTestMode?: () => void;
}

const timeOptions = [5, 10, 15, 20, 30];

export function TimeStep({ value, onChange, onNext, onTestMode }: TimeStepProps) {
  return (
    <div className="flex flex-col items-center gap-8 px-4">
      <div className="text-center">
        <h2
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--earth)' }}
        >
          Hoeveel tijd heb je?
        </h2>
        <p style={{ color: 'var(--bark)' }}>
          Kies de duur van je yoga sessie
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {timeOptions.map((minutes) => (
          <button
            key={minutes}
            onClick={() => onChange(minutes)}
            className="py-4 px-2 rounded-2xl text-lg font-medium transition-all"
            style={{
              backgroundColor: value === minutes ? 'var(--primary)' : 'var(--cream)',
              color: value === minutes ? 'white' : 'var(--earth)',
              boxShadow: value === minutes
                ? '0 4px 14px rgba(107, 142, 107, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.04)',
              transform: value === minutes ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            {minutes} min
          </button>
        ))}
      </div>

      {value && (
        <button
          onClick={onNext}
          className="w-full max-w-sm py-4 text-white rounded-2xl font-semibold text-lg transition-all hover:opacity-90"
          style={{
            backgroundColor: 'var(--primary)',
            boxShadow: '0 4px 14px rgba(107, 142, 107, 0.3)',
          }}
        >
          Volgende
        </button>
      )}

      {onTestMode && (
        <button
          onClick={onTestMode}
          className="w-full max-w-sm py-3 rounded-2xl font-semibold text-sm transition-colors"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'white',
          }}
        >
          Test Mode (5 poses, 15s each)
        </button>
      )}
    </div>
  );
}
