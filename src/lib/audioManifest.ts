'use client';

// This will be populated after running the generate-audio script
// Maps text -> audio file path
let audioManifest: Record<string, string> | null = null;
let manifestLoading: Promise<Record<string, string>> | null = null;

export async function loadAudioManifest(): Promise<Record<string, string>> {
  if (audioManifest) {
    return audioManifest;
  }

  if (manifestLoading) {
    return manifestLoading;
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
    return audioManifest || {};
  })();

  return manifestLoading;
}

// Always call this async version to ensure manifest is loaded
export async function getPreGeneratedAudioUrl(text: string): Promise<string | null> {
  const manifest = await loadAudioManifest();
  return manifest[text] || null;
}
