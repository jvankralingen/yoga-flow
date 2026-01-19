'use client';

import { FocusArea, FOCUS_AREA_LABELS } from '@/lib/types';

interface FocusStepProps {
  value: FocusArea[];
  onChange: (areas: FocusArea[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const focusAreas: FocusArea[] = [
  'full-body',
  'lower-back',
  'upper-back',
  'shoulders',
  'hips',
  'hamstrings',
];

const focusIcons: Record<FocusArea, string> = {
  'full-body': '🧘',
  'lower-back': '🔙',
  'upper-back': '⬆️',
  'shoulders': '💪',
  'hips': '🦵',
  'hamstrings': '🦿',
};

export function FocusStep({ value, onChange, onNext, onBack }: FocusStepProps) {
  const toggleArea = (area: FocusArea) => {
    if (area === 'full-body') {
      // Full body is exclusive
      onChange(['full-body']);
      return;
    }

    // Remove full-body if selecting specific areas
    const withoutFullBody = value.filter(a => a !== 'full-body');

    if (value.includes(area)) {
      onChange(withoutFullBody.filter(a => a !== area));
    } else {
      onChange([...withoutFullBody, area]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 px-4">
      <div className="text-center">
        <h2
          className="text-2xl font-semibold mb-2"
          style={{ color: 'var(--earth)' }}
        >
          Waar wil je aan werken?
        </h2>
        <p style={{ color: 'var(--bark)' }}>
          Selecteer één of meerdere aandachtsgebieden
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {focusAreas.map((area) => (
          <button
            key={area}
            onClick={() => toggleArea(area)}
            className={`py-4 px-3 rounded-2xl text-base font-medium transition-all flex flex-col items-center gap-2 ${
              area === 'full-body' ? 'col-span-2' : ''
            }`}
            style={{
              backgroundColor: value.includes(area) ? 'var(--primary)' : 'var(--cream)',
              color: value.includes(area) ? 'white' : 'var(--earth)',
              boxShadow: value.includes(area)
                ? '0 4px 14px rgba(107, 142, 107, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.04)',
              transform: value.includes(area) ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <span className="text-2xl">{focusIcons[area]}</span>
            <span>{FOCUS_AREA_LABELS[area]}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 w-full max-w-sm">
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
          onClick={onNext}
          disabled={value.length === 0}
          className="flex-1 py-4 text-white rounded-2xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--primary)',
            boxShadow: '0 4px 14px rgba(107, 142, 107, 0.3)',
          }}
        >
          Volgende
        </button>
      </div>
    </div>
  );
}
