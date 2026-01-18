import { Flow } from './types';

const FLOWS_KEY = 'yoga-flows';

export function getFlows(): Flow[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(FLOWS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveFlow(flow: Flow): void {
  const flows = getFlows();
  flows.unshift(flow);
  localStorage.setItem(FLOWS_KEY, JSON.stringify(flows));
}

export function getFlowById(id: string): Flow | null {
  const flows = getFlows();
  return flows.find(f => f.id === id) || null;
}

export function deleteFlow(id: string): void {
  const flows = getFlows();
  const filtered = flows.filter(f => f.id !== id);
  localStorage.setItem(FLOWS_KEY, JSON.stringify(filtered));
}

export function getFlowsByDate(): Record<string, Flow[]> {
  const flows = getFlows();
  const grouped: Record<string, Flow[]> = {};

  flows.forEach(flow => {
    const date = new Date(flow.createdAt).toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(flow);
  });

  return grouped;
}

export function generateId(): string {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
