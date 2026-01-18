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
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Waar wil je aan werken?
        </h2>
        <p className="text-gray-500">
          Selecteer één of meerdere aandachtsgebieden
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {focusAreas.map((area) => (
          <button
            key={area}
            onClick={() => toggleArea(area)}
            className={`
              py-4 px-3 rounded-2xl text-base font-medium transition-all flex flex-col items-center gap-2
              ${value.includes(area)
                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
              }
              ${area === 'full-body' ? 'col-span-2' : ''}
            `}
          >
            <span className="text-2xl">{focusIcons[area]}</span>
            <span>{FOCUS_AREA_LABELS[area]}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-colors"
        >
          Terug
        </button>
        <button
          onClick={onNext}
          disabled={value.length === 0}
          className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}
