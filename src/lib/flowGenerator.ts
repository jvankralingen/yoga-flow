import { Flow, FlowOptions, FlowPose, Pose, FocusArea } from './types';
import { generateId } from './storage';
import posesData from '@/data/poses.json';

const poses: Pose[] = posesData as Pose[];

// Define which poses can smoothly transition to which other poses
const TRANSITIONS: Record<string, string[]> = {
  // Standing poses
  'mountain': ['forward-fold', 'standing-side-stretch', 'warrior-1', 'warrior-2'],
  'forward-fold': ['mountain', 'downward-dog', 'low-lunge'],
  'downward-dog': ['plank', 'low-lunge', 'warrior-1', 'pigeon', 'childs-pose'],
  'plank': ['downward-dog', 'cobra', 'upward-dog', 'childs-pose'],
  'low-lunge': ['downward-dog', 'warrior-1', 'warrior-2', 'pigeon'],
  'warrior-1': ['warrior-2', 'downward-dog', 'low-lunge'],
  'warrior-2': ['triangle', 'warrior-1', 'wide-leg-forward-fold'],
  'triangle': ['warrior-2', 'wide-leg-forward-fold', 'forward-fold'],
  'wide-leg-forward-fold': ['forward-fold', 'mountain', 'seated-forward-fold'],
  'standing-side-stretch': ['mountain', 'forward-fold'],
  'camel': ['childs-pose', 'downward-dog'],

  // Floor transitions
  'cobra': ['downward-dog', 'childs-pose', 'sphinx'],
  'upward-dog': ['downward-dog', 'childs-pose'],
  'sphinx': ['cobra', 'childs-pose', 'downward-dog'],
  'cat-cow': ['downward-dog', 'childs-pose', 'thread-needle'],
  'thread-needle': ['cat-cow', 'childs-pose', 'downward-dog'],

  // Seated poses
  'pigeon': ['half-pigeon', 'downward-dog', 'seated-forward-fold'],
  'half-pigeon': ['downward-dog', 'seated-forward-fold', 'supine-twist'],
  'seated-forward-fold': ['seated-twist', 'boat', 'bridge'],
  'seated-twist': ['seated-forward-fold', 'supine-twist', 'bridge'],
  'boat': ['seated-forward-fold', 'bridge'],

  // Supine poses
  'bridge': ['supine-twist', 'happy-baby', 'reclined-butterfly'],
  'supine-twist': ['happy-baby', 'reclined-butterfly', 'corpse'],
  'happy-baby': ['supine-twist', 'reclined-butterfly', 'corpse'],
  'reclined-butterfly': ['happy-baby', 'corpse', 'legs-up-wall'],
  'legs-up-wall': ['corpse'],

  // Cooldown
  'childs-pose': ['cat-cow', 'downward-dog', 'seated-forward-fold'],
  'corpse': [], // End pose
};

// Pose sequences that work well together (mini-flows)
const SEQUENCES = {
  // Sun salutation elements
  sunSalutationA: ['mountain', 'forward-fold', 'plank', 'cobra', 'downward-dog'],

  // Warrior flow (one side)
  warriorFlow: ['downward-dog', 'low-lunge', 'warrior-1', 'warrior-2', 'triangle'],

  // Hip opener sequence
  hipOpeners: ['low-lunge', 'pigeon', 'half-pigeon'],

  // Back care sequence
  backCare: ['cat-cow', 'thread-needle', 'sphinx', 'cobra'],

  // Cooldown sequence
  cooldown: ['seated-forward-fold', 'seated-twist', 'bridge', 'supine-twist', 'happy-baby'],

  // Gentle warmup
  gentleWarmup: ['mountain', 'standing-side-stretch', 'forward-fold', 'cat-cow'],
};

function getPoseById(id: string): Pose | undefined {
  return poses.find(p => p.id === id);
}

function filterPosesByDifficulty(poses: Pose[], maxDifficulty: string): Pose[] {
  const difficultyOrder = ['beginner', 'intermediate', 'expert'];
  const maxIndex = difficultyOrder.indexOf(maxDifficulty);
  return poses.filter(pose => difficultyOrder.indexOf(pose.difficulty) <= maxIndex);
}

function filterPosesByFocusAreas(poseList: Pose[], focusAreas: FocusArea[]): Pose[] {
  if (focusAreas.includes('full-body')) {
    return poseList;
  }
  return poseList.filter(pose =>
    pose.focusAreas.some(area => focusAreas.includes(area) || area === 'full-body')
  );
}

function calculatePoseDuration(pose: Pose, timerMode: 'seconds' | 'breaths'): number {
  return timerMode === 'breaths' ? pose.defaultBreaths : pose.defaultDuration;
}

function createFlowPose(pose: Pose, timerMode: 'seconds' | 'breaths', side?: 'left' | 'right'): FlowPose {
  return {
    pose,
    duration: calculatePoseDuration(pose, timerMode),
    side: pose.hasSides ? side : undefined
  };
}

function getNextValidPose(
  currentPoseId: string,
  availablePoses: Pose[],
  usedPoseIds: Set<string>,
  focusAreas: FocusArea[]
): Pose | null {
  const transitions = TRANSITIONS[currentPoseId] || [];

  // First try to find a pose that matches focus areas and hasn't been used
  for (const nextId of transitions) {
    if (usedPoseIds.has(nextId)) continue;
    const pose = availablePoses.find(p => p.id === nextId);
    if (pose && pose.focusAreas.some(area => focusAreas.includes(area) || area === 'full-body' || focusAreas.includes('full-body'))) {
      return pose;
    }
  }

  // Then try any valid transition that hasn't been used
  for (const nextId of transitions) {
    if (usedPoseIds.has(nextId)) continue;
    const pose = availablePoses.find(p => p.id === nextId);
    if (pose) return pose;
  }

  return null;
}

function addPoseWithSides(
  pose: Pose,
  timerMode: 'seconds' | 'breaths',
  flowPoses: FlowPose[],
  usedPoseIds: Set<string>
): number {
  let timeAdded = 0;
  const poseTime = timerMode === 'breaths'
    ? calculatePoseDuration(pose, timerMode) * 4
    : calculatePoseDuration(pose, timerMode);

  if (pose.hasSides) {
    flowPoses.push(createFlowPose(pose, timerMode, 'right'));
    flowPoses.push(createFlowPose(pose, timerMode, 'left'));
    timeAdded = poseTime * 2;
  } else {
    flowPoses.push(createFlowPose(pose, timerMode));
    timeAdded = poseTime;
  }

  usedPoseIds.add(pose.id);
  return timeAdded;
}

function buildSequenceFromStart(
  startSequence: string[],
  availablePoses: Pose[],
  focusAreas: FocusArea[],
  timerMode: 'seconds' | 'breaths',
  maxTime: number,
  usedPoseIds: Set<string>
): { poses: FlowPose[], timeUsed: number } {
  const flowPoses: FlowPose[] = [];
  let timeUsed = 0;

  // Add poses from the sequence
  for (const poseId of startSequence) {
    if (timeUsed >= maxTime) break;
    if (usedPoseIds.has(poseId)) continue;

    const pose = availablePoses.find(p => p.id === poseId);
    if (!pose) continue;

    timeUsed += addPoseWithSides(pose, timerMode, flowPoses, usedPoseIds);
  }

  // Continue with transitions from the last pose
  if (flowPoses.length > 0) {
    let currentPoseId = flowPoses[flowPoses.length - 1].pose.id;

    while (timeUsed < maxTime) {
      const nextPose = getNextValidPose(currentPoseId, availablePoses, usedPoseIds, focusAreas);
      if (!nextPose) break;

      timeUsed += addPoseWithSides(nextPose, timerMode, flowPoses, usedPoseIds);
      currentPoseId = nextPose.id;
    }
  }

  return { poses: flowPoses, timeUsed };
}

export function generateFlow(options: FlowOptions): Flow {
  const { duration, focusAreas, timerMode, breathPace, voiceEnabled, difficulty } = options;

  // Filter poses by difficulty
  const availablePoses = filterPosesByDifficulty(poses, difficulty);
  const focusedPoses = filterPosesByFocusAreas(availablePoses, focusAreas);

  // Calculate time distribution (in seconds)
  const totalSeconds = duration * 60;
  const warmupTime = Math.floor(totalSeconds * 0.2);
  const mainTime = Math.floor(totalSeconds * 0.55);
  const cooldownTime = Math.floor(totalSeconds * 0.25);

  const flowPoses: FlowPose[] = [];
  const usedPoseIds = new Set<string>();

  // --- WARMUP PHASE ---
  // Start with gentle warmup sequence
  const warmupResult = buildSequenceFromStart(
    SEQUENCES.gentleWarmup,
    availablePoses,
    focusAreas,
    timerMode,
    warmupTime,
    usedPoseIds
  );
  flowPoses.push(...warmupResult.poses);

  // --- MAIN PHASE ---
  // Choose sequence based on focus areas
  let mainSequence: string[] = [];

  if (focusAreas.includes('hips')) {
    mainSequence = [...SEQUENCES.warriorFlow, ...SEQUENCES.hipOpeners];
  } else if (focusAreas.includes('lower-back') || focusAreas.includes('upper-back')) {
    mainSequence = [...SEQUENCES.backCare, ...SEQUENCES.warriorFlow];
  } else if (focusAreas.includes('shoulders')) {
    mainSequence = ['downward-dog', 'plank', 'cobra', 'upward-dog', ...SEQUENCES.warriorFlow];
  } else if (focusAreas.includes('hamstrings')) {
    mainSequence = ['downward-dog', 'forward-fold', 'wide-leg-forward-fold', 'triangle', 'seated-forward-fold'];
  } else {
    // Full body or default
    mainSequence = [...SEQUENCES.sunSalutationA, ...SEQUENCES.warriorFlow];
  }

  // Need to continue from where warmup ended
  let lastPoseId = flowPoses.length > 0 ? flowPoses[flowPoses.length - 1].pose.id : 'mountain';

  // Find a good transition to main sequence
  const transitionPose = getNextValidPose(lastPoseId, availablePoses, usedPoseIds, focusAreas);
  if (transitionPose) {
    addPoseWithSides(transitionPose, timerMode, flowPoses, usedPoseIds);
  }

  const mainResult = buildSequenceFromStart(
    mainSequence,
    focusedPoses.length > 3 ? focusedPoses : availablePoses,
    focusAreas,
    timerMode,
    mainTime,
    usedPoseIds
  );
  flowPoses.push(...mainResult.poses);

  // --- COOLDOWN PHASE ---
  // Transition to floor if not already there
  lastPoseId = flowPoses.length > 0 ? flowPoses[flowPoses.length - 1].pose.id : 'downward-dog';

  // Add child's pose as transition to cooldown if coming from standing
  const lastPose = flowPoses[flowPoses.length - 1]?.pose;
  if (lastPose && lastPose.category === 'standing') {
    const childspose = getPoseById('childs-pose');
    if (childspose && !usedPoseIds.has('childs-pose')) {
      addPoseWithSides(childspose, timerMode, flowPoses, usedPoseIds);
    }
  }

  const cooldownResult = buildSequenceFromStart(
    SEQUENCES.cooldown,
    availablePoses,
    focusAreas,
    timerMode,
    cooldownTime,
    usedPoseIds
  );
  flowPoses.push(...cooldownResult.poses);

  // Always end with Savasana
  const hasSavasana = flowPoses.some(fp => fp.pose.id === 'corpse');
  if (!hasSavasana) {
    const savasana = getPoseById('corpse');
    if (savasana) {
      flowPoses.push(createFlowPose(savasana, timerMode));
    }
  }

  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    duration,
    focusAreas,
    timerMode,
    breathPace,
    voiceEnabled,
    difficulty,
    poses: flowPoses
  };
}

export function generateTestFlow(): Flow {
  // Create a short test flow with fast durations (2 seconds per pose)
  // Voice is disabled because we don't have pre-generated audio for 2s duration
  const testPoses = ['mountain', 'forward-fold', 'downward-dog', 'childs-pose', 'corpse'];
  const flowPoses: FlowPose[] = [];

  for (const poseId of testPoses) {
    const pose = poses.find(p => p.id === poseId);
    if (pose) {
      flowPoses.push({
        pose,
        duration: 2, // 2 seconds per pose for quick testing
        side: undefined,
      });
    }
  }

  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    duration: 1,
    focusAreas: ['full-body'],
    timerMode: 'seconds',
    breathPace: 'fast',
    voiceEnabled: false, // Disabled - no pre-generated audio for 2s
    difficulty: 'beginner',
    poses: flowPoses,
  };
}

export function calculateFlowDuration(flow: Flow): { minutes: number; seconds: number } {
  let totalSeconds = 0;

  for (const fp of flow.poses) {
    if (flow.timerMode === 'breaths') {
      totalSeconds += fp.duration * 4;
    } else {
      totalSeconds += fp.duration;
    }
  }

  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60
  };
}
