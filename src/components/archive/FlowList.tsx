'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flow, FOCUS_AREA_LABELS } from '@/lib/types';
import { getFlowsByDate, deleteFlow } from '@/lib/storage';

export function FlowList() {
  const [flowsByDate, setFlowsByDate] = useState<Record<string, Flow[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setFlowsByDate(getFlowsByDate());
    setIsLoading(false);
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Weet je zeker dat je deze flow wilt verwijderen?')) {
      deleteFlow(id);
      setFlowsByDate(getFlowsByDate());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  const dates = Object.keys(flowsByDate);

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-6xl mb-4">🧘</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Nog geen flows
        </h3>
        <p className="text-gray-500 mb-6">
          Start je eerste yoga sessie om je archief te vullen
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          Nieuwe Flow
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dates.map(date => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">
            {date}
          </h3>
          <div className="space-y-3">
            {flowsByDate[date].map(flow => (
              <div
                key={flow.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <Link href={`/flow/${flow.id}`} className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">🧘</span>
                      <div>
                        <div className="font-semibold text-gray-800">
                          {flow.duration} minuten
                        </div>
                        <div className="text-sm text-gray-500">
                          {flow.poses.length} poses • {flow.timerMode === 'breaths' ? 'Ademhalingen' : 'Seconden'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {flow.focusAreas.map(area => (
                        <span
                          key={area}
                          className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium"
                        >
                          {FOCUS_AREA_LABELS[area]}
                        </span>
                      ))}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(flow.id)}
                    className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                    title="Verwijderen"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
