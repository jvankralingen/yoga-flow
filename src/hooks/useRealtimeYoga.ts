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

// Time for AI to introduce the pose (seconds)
const POSE_INTRO_SECONDS = 5;

// Calculate minimum duration for a pose in milliseconds
// duration = intro + (aantal ademhalingen × (in + uit))
function calculatePoseDuration(flow: Flow, poseIndex: number): number {
  const flowPose = flow.poses[poseIndex];
  const breathPaceSeconds = BREATH_PACE_SECONDS[flow.breathPace]; // in OF uit tijd
  const fullBreathSeconds = breathPaceSeconds * 2; // in + uit = volledige ademhaling
  const breathCount = flowPose.duration; // aantal ademhalingen

  const holdSeconds = breathCount * fullBreathSeconds;
  const totalSeconds = POSE_INTRO_SECONDS + holdSeconds;

  return totalSeconds * 1000;
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
  const poseStartTimeRef = useRef(0); // Track when current pose started
  onShowPoseRef.current = onShowPose;
  onSessionCompleteRef.current = onSessionComplete;

  // Build instructions with full pose list
  const instructions = buildYogaInstructions(flow);

  // Tool definition for show_next_pose
  const tools = [
    {
      type: 'function',
      name: 'show_next_pose',
      description: 'Roep dit aan om naar de volgende pose te gaan. Als de minimum tijd nog niet is verstreken, krijg je te horen hoeveel seconden je nog moet wachten.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ];

  // Connect to OpenAI Realtime API
  const connect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;

    setStatus('connecting');

    try {
      // Get ephemeral token from our API with show_next_pose tool
      const sessionResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions,
          voice: 'sage',
          tools,
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

      // Handle tool call for show_next_pose
      const handleShowNextPose = (callId: string) => {
        const now = Date.now();
        const elapsed = now - poseStartTimeRef.current;
        const currentPoseIndex = currentPoseIndexRef.current;
        const minDuration = calculatePoseDuration(flow, currentPoseIndex);
        const remaining = minDuration - elapsed;

        const currentPose = flow.poses[currentPoseIndex];
        const breathCount = currentPose.duration;
        const breathPace = BREATH_PACE_SECONDS[flow.breathPace];
        const fullBreathSeconds = breathPace * 2; // in + uit
        const holdSeconds = breathCount * fullBreathSeconds;

        console.log(`[YOGA] ===== SHOW_NEXT_POSE CALLED =====`);
        console.log(`[YOGA] Current pose: ${currentPoseIndex} (${currentPose.pose.englishName})`);
        console.log(`[YOGA] poseStartTimeRef.current: ${poseStartTimeRef.current}`);
        console.log(`[YOGA] now: ${now}`);
        console.log(`[YOGA] Breaths: ${breathCount} × ${fullBreathSeconds}s (${breathPace}s in + ${breathPace}s uit) = ${holdSeconds}s hold`);
        console.log(`[YOGA] Min duration: ${POSE_INTRO_SECONDS}s intro + ${holdSeconds}s hold = ${Math.round(minDuration / 1000)}s`);
        console.log(`[YOGA] Elapsed: ${Math.round(elapsed / 1000)}s | Remaining: ${Math.round(remaining / 1000)}s`);

        if (remaining > 0) {
          // Timer not done yet - tell AI to wait
          const secondsLeft = Math.ceil(remaining / 1000);
          console.log(`[YOGA] RESULT: TOO EARLY - wait ${secondsLeft}s more`);

          dc.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ status: 'wait', seconds_remaining: secondsLeft }),
            },
          }));
        } else {
          // Timer done - advance to next pose
          const nextIndex = currentPoseIndexRef.current + 1;

          if (nextIndex >= flow.poses.length) {
            // Session complete
            console.log('[YOGA] RESULT: SESSION COMPLETE - last pose done');
            sessionCompleteRef.current = true;
            sessionActiveRef.current = false;

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ status: 'complete', message: 'Dit was de laatste pose. Sluit de sessie af met Namaste.' }),
              },
            }));

            onSessionCompleteRef.current?.();
          } else {
            // Move to next pose
            const nextPose = flow.poses[nextIndex];
            console.log(`[YOGA] RESULT: ADVANCING to pose ${nextIndex}: ${nextPose.pose.englishName}`);

            currentPoseIndexRef.current = nextIndex;
            poseStartTimeRef.current = Date.now();
            onShowPoseRef.current?.(nextIndex);

            dc.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ status: 'ok', next_pose: nextPose.pose.englishName }),
              },
            }));
          }
        }
        console.log(`[YOGA] ===================================`);

        // Request AI to continue
        dc.send(JSON.stringify({
          type: 'response.create',
          response: { modalities: ['audio', 'text'] },
        }));
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

        // Handle tool calls
        if (data.type === 'response.function_call_arguments.done') {
          console.log('[YOGA] Tool call:', data.name, data.call_id);
          if (data.name === 'show_next_pose') {
            handleShowNextPose(data.call_id);
          }
        }

        // When response is done without tool call, continue if needed
        if (data.type === 'response.done') {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
          }

          // Check if response ended without tool call - might need to prompt continuation
          const output = data.response?.output || [];
          const hasToolCall = output.some((item: { type: string }) => item.type === 'function_call');

          if (!hasToolCall &&
              dataChannelRef.current?.readyState === 'open' &&
              sessionActiveRef.current &&
              !sessionCompleteRef.current) {
            // AI didn't call tool - remind it to continue
            dataChannelRef.current.send(JSON.stringify({
              type: 'response.create',
              response: { modalities: ['audio', 'text'] },
            }));
          }
        }

        if (data.type === 'error') {
          console.error('[Realtime] Error:', data);
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
  }, []);

  // Cancel any ongoing response/speech
  const cancelResponse = useCallback(() => {
    if (dataChannelRef.current?.readyState !== 'open') {
      return;
    }

    console.log('[Realtime] Cancelling current response');
    sessionActiveRef.current = false; // Stop the continuation loop

    dataChannelRef.current.send(JSON.stringify({
      type: 'response.cancel',
    }));

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Start the yoga session - AI takes over from here
  const startSession = useCallback(() => {
    if (dataChannelRef.current?.readyState !== 'open') {
      console.log('[Realtime] Data channel not open, cannot start session');
      return;
    }

    const startTime = Date.now();
    const firstPose = flow.poses[0];
    const breathPace = BREATH_PACE_SECONDS[flow.breathPace];
    const fullBreathSeconds = breathPace * 2;
    const firstPoseDuration = calculatePoseDuration(flow, 0);

    console.log('[YOGA] ===== SESSION STARTING =====');
    console.log(`[YOGA] Total poses: ${flow.poses.length}`);
    console.log(`[YOGA] Breath pace: ${breathPace}s in + ${breathPace}s uit = ${fullBreathSeconds}s per breath`);
    console.log(`[YOGA] First pose: ${firstPose.pose.englishName} (${firstPose.duration} breaths = ${Math.round(firstPoseDuration / 1000)}s)`);
    console.log('[YOGA] ==============================');

    sessionActiveRef.current = true;
    sessionCompleteRef.current = false;
    currentPoseIndexRef.current = 0;
    poseStartTimeRef.current = startTime; // Start timer for first pose

    // Show first pose immediately
    onShowPoseRef.current?.(0);

    // Send start message
    dataChannelRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Start de yoga sessie. Begin met de eerste pose.' }],
      },
    }));

    // Request response
    dataChannelRef.current.send(JSON.stringify({
      type: 'response.create',
      response: { modalities: ['audio', 'text'] },
    }));
  }, []);

  // Skip to a specific pose (manual override)
  const skipToPose = useCallback((poseIndex: number, poseName: string) => {
    if (dataChannelRef.current?.readyState !== 'open') {
      return;
    }

    console.log('[Realtime] Manual skip to pose:', poseIndex, poseName);
    currentPoseIndexRef.current = poseIndex;
    poseStartTimeRef.current = Date.now(); // Reset timer for new pose

    // Cancel current response
    dataChannelRef.current.send(JSON.stringify({
      type: 'response.cancel',
    }));

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    // Small delay then send skip message
    setTimeout(() => {
      if (dataChannelRef.current?.readyState !== 'open') return;

      dataChannelRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: `Ga nu verder met ${poseName}. Begeleid deze pose.` }],
        },
      }));

      dataChannelRef.current.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio', 'text'] },
      }));
    }, 100);
  }, []);

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
