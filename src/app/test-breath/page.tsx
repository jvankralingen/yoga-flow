'use client';

import { useRef, useState } from 'react';

export default function TestBreathPage() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'inhale' | 'exhale' | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  };

  // Zachte sinusgolf toon
  const playTone = (startFreq: number, endFreq: number, duration: number) => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    // Fade in en fade out voor zachte overgang
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.15, ctx.currentTime + duration - 0.3);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  };

  const playInhale = () => {
    setCurrentPhase('inhale');
    // Oplopende toon: laag naar hoog
    playTone(220, 440, 4);
    setTimeout(() => setCurrentPhase(null), 4000);
  };

  const playExhale = () => {
    setCurrentPhase('exhale');
    // Dalende toon: hoog naar laag
    playTone(440, 220, 4);
    setTimeout(() => setCurrentPhase(null), 4000);
  };

  const playFullCycle = async () => {
    setIsPlaying(true);

    // 3 ademhalingen
    for (let i = 0; i < 3; i++) {
      setCurrentPhase('inhale');
      playTone(220, 440, 4);
      await new Promise(r => setTimeout(r, 4000));

      setCurrentPhase('exhale');
      playTone(440, 220, 4);
      await new Promise(r => setTimeout(r, 4000));
    }

    setCurrentPhase(null);
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Ademhalingsgeluiden Test
        </h1>

        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="text-center mb-6">
            <div className={`text-6xl mb-4 transition-transform duration-1000 ${
              currentPhase === 'inhale' ? 'scale-125' :
              currentPhase === 'exhale' ? 'scale-75' : 'scale-100'
            }`}>
              🫁
            </div>
            <p className="text-lg text-gray-600">
              {currentPhase === 'inhale' && 'Inademen...'}
              {currentPhase === 'exhale' && 'Uitademen...'}
              {!currentPhase && 'Klik om te testen'}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={playInhale}
              disabled={isPlaying}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              Test Inademen (4s)
            </button>

            <button
              onClick={playExhale}
              disabled={isPlaying}
              className="w-full py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              Test Uitademen (4s)
            </button>

            <button
              onClick={playFullCycle}
              disabled={isPlaying}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isPlaying ? 'Bezig...' : 'Test 3 Ademhalingen'}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center">
          Oplopende toon = inademen, dalende toon = uitademen
        </p>
      </div>
    </div>
  );
}
