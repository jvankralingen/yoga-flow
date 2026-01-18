'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Flow } from '@/lib/types';
import { getFlowById } from '@/lib/storage';
import { FlowPlayer } from '@/components/flow/FlowPlayer';

export default function FlowPage() {
  const params = useParams();
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    const loadedFlow = getFlowById(id);

    if (loadedFlow) {
      setFlow(loadedFlow);
    } else {
      router.push('/');
    }

    setIsLoading(false);
  }, [params.id, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-gray-400">Laden...</div>
      </div>
    );
  }

  if (!flow) {
    return null;
  }

  return <FlowPlayer flow={flow} />;
}
