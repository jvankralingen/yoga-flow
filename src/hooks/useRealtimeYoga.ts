'use client';

import { useCallback, useRef, useState } from 'react';
import { Flow, BREATH_PACE_SECONDS } from '@/lib/types';
import { buildYogaInstructions } from '@/lib/yogaInstructions';

interface UseRealtimeYogaOptions {
  flow: Flow;
  onShowPose?: (poseIndex: number) => void;
  onSessionComplete?: () => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Calculate pose duration in milliseconds (breath count × full breath duration)
function calculatePoseDuration(flow: Flow, poseIndex: number): number {
  const flowPose = flow.poses[poseIndex];
  const breathPaceSeconds = BREATH_PACE_SECONDS[flow.breathPace];
  const fullBreathSeconds = breathPaceSeconds * 2; // in + uit
  const breathCount = flowPose.duration;
  return breathCount * fullBreathSeconds * 1000;
}

export function useRealtimeYoga({ flow, onShowPose, onSessionComplete }: UseRealtimeYogaOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Refs for callbacks to avoid stale closures
  const onShowPoseRef = useRef(onShowPose);
  const onSessionCompleteRef = useRef(onSessionComplete);
  const isSpeakingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionCompleteRef = useRef(false);
  const currentPoseIndexRef = useRef(0);

  // Timer refs
  const poseTimersRef = useRef<{
    halfway: NodeJS.Timeout | null;
    almostDone: NodeJS.Timeout | null;
    done: NodeJS.Timeout | null;
  }>({ halfway: null, almostDone: null, done: null });

  onShowPoseRef.current = onShowPose;
  onSessionCompleteRef.current = onSessionComplete;

  // Build instructions with full pose list
  const instructions = buildYogaInstructions(flow);

  // Helper to send AI prompt
  const triggerAI = useCallback((message: string) => {
    if (dataChannelRef.current?.readyState !== 'open') return;

    console.log(`[YOGA] Triggering AI: "${message}"`);

    dataChannelRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: message }],
      },
    }));

    dataChannelRef.current.send(JSON.stringify({
      type: 'response.create',
      response: { modalities: ['audio', 'text'] },
    }));
  }, []);

  // Clear all pose timers
  const clearPoseTimers = useCallback(() => {
    if (poseTimersRef.current.halfway) clearTimeout(poseTimersRef.current.halfway);
    if (poseTimersRef.current.almostDone) clearTimeout(poseTimersRef.current.almostDone);
    if (poseTimersRef.current.done) clearTimeout(poseTimersRef.current.done);
    poseTimersRef.current = { halfway: null, almostDone: null, done: null };
  }, []);

  // Start timers for a pose
  const startPoseTimers = useCallback((poseIndex: number) => {
    clearPoseTimers();

    const pose = flow.poses[poseIndex];
    const duration = calculatePoseDuration(flow, poseIndex);
    const breathPace = BREATH_PACE_SECONDS[flow.breathPace];
    const fullBreathSeconds = breathPace * 2;
    const twoBreathsMs = 2 * fullBreathSeconds * 1000;

    console.log(`[YOGA] ===== STARTING POSE ${poseIndex}: ${pose.pose.englishName} =====`);
    console.log(`[YOGA] Duration: ${duration / 1000}s`);
    console.log(`[YOGA] Halfway at: ${duration / 2 / 1000}s`);
    console.log(`[YOGA] Almost done at: ${(duration - twoBreathsMs) / 1000}s`);
    console.log(`[YOGA] ===========================================`);

    // Halfway point - trigger encouragement
    poseTimersRef.current.halfway = setTimeout(() => {
      if (!sessionActiveRef.current || sessionCompleteRef.current) return;
      console.log(`[YOGA] TIMER: Halfway point reached`);
      triggerAI('Geef een korte aanmoediging aan de student. Houd het rustig.');
    }, duration / 2);

    // 2 breaths before end - trigger "almost done"
    const almostDoneTime = duration - twoBreathsMs;
    if (almostDoneTime > duration / 2) { // Only if it's after halfway
      poseTimersRef.current.almostDone = setTimeout(() => {
        if (!sessionActiveRef.current || sessionCompleteRef.current) return;
        console.log(`[YOGA] TIMER: Almost done point reached`);
        triggerAI('We zijn bijna klaar met deze pose. Bereid de student voor.');
      }, almostDoneTime);
    }

    // Timer done - advance to next pose
    poseTimersRef.current.done = setTimeout(() => {
      if (!sessionActiveRef.current || sessionCompleteRef.current) return;
      console.log(`[YOGA] TIMER: Pose complete`);

      const nextIndex = currentPoseIndexRef.current + 1;

      if (nextIndex >= flow.poses.length) {
        // Session complete
        console.log(`[YOGA] SESSION COMPLETE`);
        sessionCompleteRef.current = true;
        sessionActiveRef.current = false;
        clearPoseTimers();
        triggerAI('Dit was de laatste pose. Sluit de sessie af met Namaste.');
        onSessionCompleteRef.current?.();
      } else {
        // Move to next pose
        const nextPose = flow.poses[nextIndex];
        console.log(`[YOGA] ADVANCING to pose ${nextIndex}: ${nextPose.pose.englishName}`);

        currentPoseIndexRef.current = nextIndex;
        onShowPoseRef.current?.(nextIndex);

        // Start timers for next pose
        startPoseTimers(nextIndex);

        // Trigger AI for new pose
        triggerAI(`We gaan nu naar ${nextPose.pose.englishName}. Beschrijf deze pose.`);
      }
    }, duration);
  }, [flow, clearPoseTimers, triggerAI]);

  // Connect to OpenAI Realtime API
  const connect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;

    setStatus('connecting');

    try {
      // Get ephemeral token from our API (no tools needed - timer controls flow)
      const sessionResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions,
          voice: 'sage',
        }),
      });

      if (!sessionResponse.ok) {
        const err = await sessionResponse.text();
        console.error('[Realtime] Session error:', err);
        throw new Error('Failed to create session');
      }

      const { client_secret } = await sessionResponse.json();

      // Create peer connection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio element for playback
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      // Handle incoming audio track
      pc.ontrack = (event) => {
        console.log('[Realtime] Received audio track');
        audioEl.srcObject = event.streams[0];
      };

      // Add a silent audio track (required by the API)
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const oscillator = audioContext.createOscillator();
      oscillator.frequency.value = 0;
      const destination = audioContext.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();

      const silentTrack = destination.stream.getAudioTracks()[0];
      pc.addTrack(silentTrack);

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('[Realtime] Data channel opened');
        setStatus('connected');
      };

      dc.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Track when AI starts speaking
        if (data.type === 'response.audio.delta') {
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
          }
        }

        // Track when AI stops speaking
        if (data.type === 'response.audio.done') {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
          }
        }

        if (data.type === 'response.done') {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
          }
        }

        if (data.type === 'error') {
          console.error('[Realtime] Error:', data.error?.type, data.error?.message, data);
        }
      };

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${client_secret.value}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error('Failed to connect to OpenAI Realtime');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      // Connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[Realtime] Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatus('error');
        }
      };

    } catch (error) {
      console.error('[Realtime] Connection error:', error);
      setStatus('error');
    }
  }, [status, instructions]);

  // Disconnect from OpenAI
  const disconnect = useCallback(() => {
    clearPoseTimers();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setStatus('disconnected');
  }, [clearPoseTimers]);

  // Cancel any ongoing response/speech
  const cancelResponse = useCallback(() => {
    if (dataChannelRef.current?.readyState !== 'open') {
      return;
    }

    console.log('[Realtime] Cancelling current response');
    sessionActiveRef.current = false;
    clearPoseTimers();

    dataChannelRef.current.send(JSON.stringify({
      type: 'response.cancel',
    }));

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, [clearPoseTimers]);

  // Start the yoga session - Timer takes control
  const startSession = useCallback(() => {
    if (dataChannelRef.current?.readyState !== 'open') {
      console.log('[Realtime] Data channel not open, cannot start session');
      return;
    }

    const firstPose = flow.poses[0];

    console.log('[YOGA] ===== SESSION STARTING =====');
    console.log(`[YOGA] Total poses: ${flow.poses.length}`);
    console.log('[YOGA] ==============================');

    sessionActiveRef.current = true;
    sessionCompleteRef.current = false;
    currentPoseIndexRef.current = 0;

    // Show first pose immediately
    onShowPoseRef.current?.(0);

    // Start timers for first pose
    startPoseTimers(0);

    // Trigger AI for first pose
    triggerAI(`Start de yoga sessie. Begin met ${firstPose.pose.englishName}. Beschrijf deze pose.`);
  }, [flow, startPoseTimers, triggerAI]);

  // Skip to a specific pose (manual override)
  const skipToPose = useCallback((poseIndex: number, poseName: string) => {
    console.log('[YOGA] skipToPose called:', poseIndex, poseName, 'dataChannel:', dataChannelRef.current?.readyState);

    if (dataChannelRef.current?.readyState !== 'open') {
      console.log('[YOGA] skipToPose: dataChannel not open, returning');
      return;
    }

    console.log('[YOGA] Manual skip to pose:', poseIndex, poseName);

    // Clear current timers
    clearPoseTimers();

    currentPoseIndexRef.current = poseIndex;

    // Update visual immediately
    onShowPoseRef.current?.(poseIndex);

    // Cancel current response only if AI is speaking
    if (isSpeakingRef.current) {
      dataChannelRef.current.send(JSON.stringify({
        type: 'response.cancel',
      }));

      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      }

      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }

    // Small delay then start new pose
    setTimeout(() => {
      if (dataChannelRef.current?.readyState !== 'open') return;

      // Start timers for new pose
      startPoseTimers(poseIndex);

      // Trigger AI for new pose
      triggerAI(`We gaan nu naar ${poseName}. Beschrijf deze pose.`);
    }, 100);
  }, [clearPoseTimers, startPoseTimers, triggerAI]);

  return {
    status,
    isConnected: status === 'connected',
    isSpeaking,
    connect,
    disconnect,
    cancelResponse,
    startSession,
    skipToPose,
  };
}
