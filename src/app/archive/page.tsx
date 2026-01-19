import Link from 'next/link';
import { FlowList } from '@/components/archive/FlowList';

export default function ArchivePage() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="font-medium flex items-center gap-1"
            style={{ color: 'var(--primary)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Terug
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-white rounded-xl text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--primary)',
              boxShadow: '0 2px 8px rgba(107, 142, 107, 0.2)',
            }}
          >
            + Nieuwe Flow
          </Link>
        </div>
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--earth)' }}
        >
          Mijn Flows
        </h1>
        <p style={{ color: 'var(--bark)' }}>Je opgeslagen yoga sessies</p>
      </header>

      {/* Flow list */}
      <main className="px-4 pb-8">
        <FlowList />
      </main>
    </div>
  );
}
