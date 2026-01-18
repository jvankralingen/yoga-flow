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
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Hoeveel tijd heb je?
        </h2>
        <p className="text-gray-500">
          Kies de duur van je yoga sessie
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {timeOptions.map((minutes) => (
          <button
            key={minutes}
            onClick={() => onChange(minutes)}
            className={`
              py-4 px-2 rounded-2xl text-lg font-medium transition-all
              ${value === minutes
                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
              }
            `}
          >
            {minutes} min
          </button>
        ))}
      </div>

      {value && (
        <button
          onClick={onNext}
          className="w-full max-w-sm py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg"
        >
          Volgende
        </button>
      )}

      {onTestMode && (
        <button
          onClick={onTestMode}
          className="w-full max-w-sm py-3 bg-orange-500 text-white rounded-2xl font-semibold text-sm hover:bg-orange-600 transition-colors"
        >
          Test Mode (5 poses, 15s each)
        </button>
      )}
    </div>
  );
}
