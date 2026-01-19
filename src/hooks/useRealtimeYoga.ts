'use client';

import { useCallback, useRef, useState } from 'react';
import { Flow } from '@/lib/types';
import { buildYogaInstructions } from '@/lib/yogaInstructions';

interface UseRealtimeYogaOptions {
  flow: Flow;
  onPoseComplete?: () => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Tool definition for AI to signal pose completion
const TOOLS = [
  {
    type: 'function',
    name: 'pose_complete',
    description: 'Call this function when you want the student to move to the next pose. YOU control the timing of the session. After introducing a pose, guide the student through it with breathing cues and encouragement, then call this function when ready to move on.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

export function useRealtimeYoga({ flow, onPoseComplete }: UseRealtimeYogaOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Refs for callbacks to avoid stale closures
  const onPoseCompleteRef = useRef(onPoseComplete);
  const isSpeakingRef = useRef(false);
  onPoseCompleteRef.current = onPoseComplete;

  // Build instructions
  const instructions = buildYogaInstructions(flow);

  // Send a cue to the AI
  const sendCue = useCallback((cue: string) => {
    if (dataChannelRef.current?.readyState !== 'open') {
      console.log('[Realtime] Data channel not open, skipping cue:', cue);
      return;
    }

    console.log('[Realtime] Sending cue:', cue);

    // Send the cue as a user message
    dataChannelRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: cue }],
      },
    }));

    // Request a response
    dataChannelRef.current.send(JSON.stringify({
      type: 'response.create',
      response: { modalities: ['audio', 'text'] },
    }));
  }, []);

  // Connect to OpenAI Realtime API
  const connect = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;

    setStatus('connecting');

    try {
      // Get ephemeral token from our API
      const sessionResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions,
          voice: 'sage',
          tools: TOOLS,
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
        // Log non-delta events for debugging
        if (!data.type?.includes('delta')) {
          console.log('[Realtime] Event:', data.type, data);
        }

        // Track when AI starts speaking
        if (data.type === 'response.audio.delta') {
          // First audio chunk - AI started speaking
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            console.log('[Realtime] AI started speaking');
          }
        }

        // Track when AI stops speaking (for UI state)
        if (data.type === 'response.audio.done' || data.type === 'response.done') {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            console.log('[Realtime] AI finished speaking');
          }
        }

        // Handle function calls from AI
        if (data.type === 'response.function_call_arguments.done') {
          const functionName = data.name;
          console.log('[Realtime] Function call:', functionName);

          if (functionName === 'pose_complete') {
            console.log('[Realtime] AI called pose_complete - moving to next pose');
            onPoseCompleteRef.current?.();

            // Send function call output to acknowledge
            if (dataChannelRef.current?.readyState === 'open') {
              dataChannelRef.current.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: data.call_id,
                  output: JSON.stringify({ success: true }),
                },
              }));
            }
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

    // Cancel any ongoing response
    dataChannelRef.current.send(JSON.stringify({
      type: 'response.cancel',
    }));

    // Also clear the audio playback immediately
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    // Reset speaking state
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // Cue helpers
  const cueStart = useCallback((poseName: string) => {
    sendCue(`[START] Eerste pose: ${poseName}`);
  }, [sendCue]);

  const cuePose = useCallback((poseName: string, side?: string) => {
    const sideText = side === 'left' ? ' (linkerkant)' :
                     side === 'right' ? ' (rechterkant)' :
                     side === 'both' ? ' (beide kanten)' : '';
    sendCue(`[POSE: ${poseName}${sideText}]`);
  }, [sendCue]);

  const cueHalfway = useCallback(() => {
    sendCue('[HALFWAY]');
  }, [sendCue]);

  const cueLastBreath = useCallback(() => {
    sendCue('[LAST_BREATH]');
  }, [sendCue]);

  const cueNext = useCallback((poseName: string, side?: string) => {
    const sideText = side === 'left' ? ' (linkerkant)' :
                     side === 'right' ? ' (rechterkant)' :
                     side === 'both' ? ' (beide kanten)' : '';
    sendCue(`[NEXT: ${poseName}${sideText}]`);
  }, [sendCue]);

  const cueComplete = useCallback(() => {
    sendCue('[COMPLETE]');
  }, [sendCue]);

  return {
    status,
    isConnected: status === 'connected',
    isSpeaking,
    connect,
    disconnect,
    cancelResponse,
    // Cue functions
    cueStart,
    cuePose,
    cueHalfway,
    cueLastBreath,
    cueNext,
    cueComplete,
  };
}
