'use client';

// This will be populated after running the generate-audio script
// Maps text -> audio file path
let audioManifest: Record<string, string> | null = null;
let manifestLoading: Promise<void> | null = null;

export async function loadAudioManifest(): Promise<Record<string, string>> {
  if (audioManifest) {
    return audioManifest;
  }

  if (manifestLoading) {
    await manifestLoading;
    return audioManifest || {};
  }

  manifestLoading = (async () => {
    try {
      const response = await fetch('/audio/manifest.json');
      if (response.ok) {
        audioManifest = await response.json();
        console.log('[Audio] Loaded manifest with', Object.keys(audioManifest || {}).length, 'entries');
      } else {
        console.log('[Audio] No manifest found, will use API');
        audioManifest = {};
      }
    } catch (error) {
      console.log('[Audio] Failed to load manifest:', error);
      audioManifest = {};
    }
  })();

  await manifestLoading;
  return audioManifest || {};
}

export function getPreGeneratedAudioUrl(text: string): string | null {
  if (!audioManifest) {
    return null;
  }
  return audioManifest[text] || null;
}
