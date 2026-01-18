import * as fs from 'fs';
import * as path from 'path';
import poses from '../src/data/poses.json';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'iCrDUkL56s3C8sCRl7wb';

if (!ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is required');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, '../public/audio');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate a safe filename from text
function textToFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100) + '.mp3';
}

// Generate audio for a text
async function generateAudio(text: string, filename: string): Promise<void> {
  const filepath = path.join(OUTPUT_DIR, filename);

  // Skip if already exists
  if (fs.existsSync(filepath)) {
    console.log(`[SKIP] ${filename} already exists`);
    return;
  }

  console.log(`[GENERATE] ${filename}`);
  console.log(`  Text: ${text.substring(0, 60)}...`);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(audioBuffer));
    console.log(`  [OK] Saved ${audioBuffer.byteLength} bytes`);

    // Rate limiting - wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error(`  [ERROR] ${error}`);
  }
}

// Generate a hash for consistent filenames
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function main() {
  const audioEntries: Array<{ text: string; filename: string }> = [];

  // 1. Generate pose announcements
  console.log('\n=== Generating pose announcements ===\n');

  for (const pose of poses) {
    // Base pose (no side)
    const baseText = `${pose.englishName}. ${pose.description}`;
    const baseFilename = `pose-${pose.id}.mp3`;
    audioEntries.push({ text: baseText, filename: baseFilename });

    // With sides if applicable
    if (pose.hasSides) {
      const leftText = `${pose.englishName}, linkerkant. ${pose.description}`;
      const leftFilename = `pose-${pose.id}-left.mp3`;
      audioEntries.push({ text: leftText, filename: leftFilename });

      const rightText = `${pose.englishName}, rechterkant. ${pose.description}`;
      const rightFilename = `pose-${pose.id}-right.mp3`;
      audioEntries.push({ text: rightText, filename: rightFilename });
    }
  }

  // 2. Generate duration announcements
  console.log('\n=== Generating duration announcements ===\n');

  // Common breath counts: 3, 4, 5, 6, 8, 10
  const breathCounts = [3, 4, 5, 6, 8, 10];
  for (const count of breathCounts) {
    const text = `We houden dit vast voor ${count} ademhalingen......`;
    const filename = `duration-breaths-${count}.mp3`;
    audioEntries.push({ text, filename });
  }

  // Common second counts: 15, 30, 45, 60, 90, 120
  const secondCounts = [15, 30, 45, 60, 90, 120];
  for (const count of secondCounts) {
    const text = `We houden dit vast voor ${count} seconden......`;
    const filename = `duration-seconds-${count}.mp3`;
    audioEntries.push({ text, filename });
  }

  // 3. Generate fixed announcements
  console.log('\n=== Generating fixed announcements ===\n');

  const fixedTexts = [
    { text: 'Nog één keer. Adem in........... ...en uit...', filename: 'last-breath.mp3' },
    { text: 'Goed gedaan! De flow is voltooid!', filename: 'complete.mp3' },
    { text: 'Test. Een twee drie.', filename: 'test.mp3' },
  ];

  audioEntries.push(...fixedTexts);

  // Generate all audio files
  console.log(`\nTotal audio files to generate: ${audioEntries.length}\n`);

  for (const entry of audioEntries) {
    await generateAudio(entry.text, entry.filename);
  }

  // Generate manifest file for lookup
  const manifest: Record<string, string> = {};
  for (const entry of audioEntries) {
    manifest[entry.text] = `/audio/${entry.filename}`;
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest saved to ${manifestPath}`);

  console.log('\n=== Done! ===\n');
}

main().catch(console.error);
