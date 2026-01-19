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
        <div style={{ color: 'var(--bark)' }}>Laden...</div>
      </div>
    );
  }

  const dates = Object.keys(flowsByDate);

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'var(--sand)' }}
        >
          <span className="text-4xl">🧘</span>
        </div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--earth)' }}
        >
          Nog geen flows
        </h3>
        <p className="mb-6" style={{ color: 'var(--bark)' }}>
          Start je eerste yoga sessie om je archief te vullen
        </p>
        <Link
          href="/"
          className="px-6 py-3 text-white rounded-xl font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            boxShadow: '0 4px 14px rgba(107, 142, 107, 0.3)',
          }}
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
          <h3
            className="text-sm font-semibold uppercase tracking-wider mb-3 px-1"
            style={{ color: 'var(--bark)' }}
          >
            {date}
          </h3>
          <div className="space-y-3">
            {flowsByDate[date].map(flow => (
              <div
                key={flow.id}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: 'var(--cream)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div className="flex items-start justify-between">
                  <Link href={`/flow/${flow.id}`} className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--sand)' }}
                      >
                        <span className="text-xl">🧘</span>
                      </div>
                      <div>
                        <div
                          className="font-semibold"
                          style={{ color: 'var(--earth)' }}
                        >
                          {flow.duration} minuten
                        </div>
                        <div
                          className="text-sm"
                          style={{ color: 'var(--bark)' }}
                        >
                          {flow.poses.length} poses • {flow.timerMode === 'breaths' ? 'Ademhalingen' : 'Seconden'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {flow.focusAreas.map(area => (
                        <span
                          key={area}
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: 'var(--sand)',
                            color: 'var(--primary-dark)',
                          }}
                        >
                          {FOCUS_AREA_LABELS[area]}
                        </span>
                      ))}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(flow.id)}
                    className="p-2 transition-colors rounded-lg hover:bg-red-50"
                    style={{ color: 'var(--bark)' }}
                    title="Verwijderen"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" />
                    </svg>
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
