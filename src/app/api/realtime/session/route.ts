import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { instructions, voice, tools } = await request.json();

    const sessionConfig: Record<string, unknown> = {
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: voice || 'shimmer',
      instructions: instructions,
      input_audio_transcription: null, // We don't need transcription since user won't speak
      turn_detection: null, // Disable turn detection since it's one-way
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      sessionConfig.tools = tools;
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI session error:', error);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      client_secret: data.client_secret,
      session_id: data.id,
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
