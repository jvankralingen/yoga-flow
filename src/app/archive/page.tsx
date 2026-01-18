import Link from 'next/link';
import { FlowList } from '@/components/archive/FlowList';

export default function ArchivePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            ← Terug
          </Link>
          <Link
            href="/"
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Nieuwe Flow
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Mijn Flows</h1>
        <p className="text-gray-500">Je opgeslagen yoga sessies</p>
      </header>

      {/* Flow list */}
      <main className="px-4 pb-8">
        <FlowList />
      </main>
    </div>
  );
}
