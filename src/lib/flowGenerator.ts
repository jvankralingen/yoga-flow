import { Flow, FlowOptions, FlowPose, Pose, FocusArea, Difficulty, PoseCategory } from './types';
import { generateId } from './storage';
import posesData from '@/data/poses.json';

const poses: Pose[] = posesData as Pose[];

// Position types for smooth transitions
type Position = 'standing' | 'hands-knees' | 'prone' | 'supine' | 'seated';

// Map each pose to its position
const POSE_POSITIONS: Record<string, Position> = {
  // Standing
  'mountain': 'standing',
  'forward-fold': 'standing',
  'warrior-1': 'standing',
  'warrior-2': 'standing',
  'triangle': 'standing',
  'wide-leg-forward-fold': 'standing',
  'standing-side-stretch': 'standing',

  // Hands and knees
  'downward-dog': 'hands-knees',
  'cat-cow': 'hands-knees',
  'thread-needle': 'hands-knees',
  'plank': 'hands-knees',
  'childs-pose': 'hands-knees',

  // Prone (on belly)
  'cobra': 'prone',
  'sphinx': 'prone',
  'upward-dog': 'prone',

  // Seated
  'pigeon': 'seated',
  'half-pigeon': 'seated',
  'seated-forward-fold': 'seated',
  'seated-twist': 'seated',
  'boat': 'seated',
  'low-lunge': 'seated',
  'camel': 'seated',

  // Supine (on back)
  'bridge': 'supine',
  'supine-twist': 'supine',
  'happy-baby': 'supine',
  'reclined-butterfly': 'supine',
  'legs-up-wall': 'supine',
  'corpse': 'supine',
};

// Which poses prepare the body for which other poses (warmup requirements)
const REQUIRES_WARMUP: Record<string, string[]> = {
  'pigeon': ['low-lunge', 'warrior-1', 'warrior-2', 'downward-dog'],
  'half-pigeon': ['pigeon', 'low-lunge', 'downward-dog'],
  'camel': ['cobra', 'sphinx', 'bridge', 'cat-cow'],
  'boat': ['seated-forward-fold', 'plank'],
  'wide-leg-forward-fold': ['forward-fold', 'downward-dog'],
};

// Valid transitions between positions (to avoid constant up/down)
const POSITION_TRANSITIONS: Record<Position, Position[]> = {
  'standing': ['standing', 'hands-knees'],
  'hands-knees': ['hands-knees', 'prone', 'seated', 'standing'],
  'prone': ['prone', 'hands-knees'],
  'seated': ['seated', 'hands-knees', 'supine'],
  'supine': ['supine', 'seated'],
};

// Poses that work well as transitions between positions
const TRANSITION_POSES: Record<string, string[]> = {
  'standing-to-hands-knees': ['forward-fold', 'downward-dog'],
  'hands-knees-to-standing': ['downward-dog', 'forward-fold'],
  'hands-knees-to-prone': ['plank', 'childs-pose'],
  'prone-to-hands-knees': ['childs-pose', 'downward-dog'],
  'hands-knees-to-seated': ['downward-dog', 'childs-pose'],
  'seated-to-supine': ['seated-forward-fold'],
  'supine-to-seated': ['happy-baby'],
};

// Focus area specific pose priorities (most relevant first)
const FOCUS_PRIORITY: Record<FocusArea, string[]> = {
  'hips': ['pigeon', 'half-pigeon', 'low-lunge', 'warrior-1', 'warrior-2', 'happy-baby', 'reclined-butterfly', 'triangle'],
  'lower-back': ['cat-cow', 'childs-pose', 'sphinx', 'cobra', 'bridge', 'supine-twist', 'seated-twist'],
  'upper-back': ['thread-needle', 'cat-cow', 'cobra', 'sphinx', 'camel', 'downward-dog'],
  'shoulders': ['thread-needle', 'downward-dog', 'standing-side-stretch', 'cobra', 'upward-dog'],
  'hamstrings': ['forward-fold', 'downward-dog', 'wide-leg-forward-fold', 'seated-forward-fold', 'triangle'],
  'full-body': ['downward-dog', 'warrior-1', 'warrior-2', 'plank', 'bridge'],
};

// Shuffle array helper
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Pick random item from array
function pickRandom<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

function getPoseById(id: string): Pose | undefined {
  return poses.find(p => p.id === id);
}

function getPosition(poseId: string): Position {
  return POSE_POSITIONS[poseId] || 'standing';
}

function canTransitionTo(fromPosition: Position, toPosition: Position): boolean {
  return POSITION_TRANSITIONS[fromPosition]?.includes(toPosition) ?? false;
}

function filterByDifficulty(poseList: Pose[], maxDifficulty: Difficulty): Pose[] {
  const order: Difficulty[] = ['beginner', 'intermediate', 'expert'];
  const maxIndex = order.indexOf(maxDifficulty);
  return poseList.filter(p => order.indexOf(p.difficulty) <= maxIndex);
}

function hasBeenWarmedUp(poseId: string, usedPoses: Set<string>): boolean {
  const requirements = REQUIRES_WARMUP[poseId];
  if (!requirements) return true; // No warmup needed
  return requirements.some(req => usedPoses.has(req));
}

function calculatePoseDuration(pose: Pose, timerMode: 'seconds' | 'breaths'): number {
  return timerMode === 'breaths' ? pose.defaultBreaths : pose.defaultDuration;
}

function estimatePoseTime(pose: Pose, timerMode: 'seconds' | 'breaths'): number {
  const duration = calculatePoseDuration(pose, timerMode);
  if (timerMode === 'breaths') {
    return duration * 5; // Rough estimate: 5 seconds per breath
  }
  return duration;
}

function createFlowPose(pose: Pose, timerMode: 'seconds' | 'breaths', side?: 'left' | 'right'): FlowPose {
  return {
    pose,
    duration: calculatePoseDuration(pose, timerMode),
    side: pose.hasSides ? side : undefined
  };
}

interface FlowState {
  poses: FlowPose[];
  usedPoseIds: Set<string>;
  currentPosition: Position;
  timeUsed: number;
  warmedUpAreas: Set<FocusArea>;
}

function addPoseToFlow(
  state: FlowState,
  pose: Pose,
  timerMode: 'seconds' | 'breaths'
): void {
  const poseTime = estimatePoseTime(pose, timerMode);

  if (pose.hasSides) {
    // Add right side first, then left
    state.poses.push(createFlowPose(pose, timerMode, 'right'));
    state.poses.push(createFlowPose(pose, timerMode, 'left'));
    state.timeUsed += poseTime * 2;
  } else {
    state.poses.push(createFlowPose(pose, timerMode));
    state.timeUsed += poseTime;
  }

  state.usedPoseIds.add(pose.id);
  state.currentPosition = getPosition(pose.id);

  // Mark focus areas as warmed up
  pose.focusAreas.forEach(area => state.warmedUpAreas.add(area));
}

function findTransitionPose(
  fromPosition: Position,
  toPosition: Position,
  availablePoses: Pose[],
  usedPoseIds: Set<string>
): Pose | undefined {
  const key = `${fromPosition}-to-${toPosition}`;
  const transitionIds = TRANSITION_POSES[key] || [];

  for (const id of transitionIds) {
    if (!usedPoseIds.has(id)) {
      const pose = availablePoses.find(p => p.id === id);
      if (pose) return pose;
    }
  }

  return undefined;
}

function selectNextPose(
  state: FlowState,
  availablePoses: Pose[],
  focusAreas: FocusArea[],
  preferCategory?: PoseCategory
): Pose | undefined {
  // Filter poses that:
  // 1. Haven't been used
  // 2. Can transition smoothly from current position
  // 3. Have required warmup done
  const candidates = availablePoses.filter(pose => {
    if (state.usedPoseIds.has(pose.id)) return false;

    const posePosition = getPosition(pose.id);
    if (!canTransitionTo(state.currentPosition, posePosition)) return false;

    if (!hasBeenWarmedUp(pose.id, state.usedPoseIds)) return false;

    if (preferCategory && pose.category !== preferCategory) return false;

    return true;
  });

  if (candidates.length === 0) return undefined;

  // Score candidates based on focus area relevance
  const scored = candidates.map(pose => {
    let score = 0;

    // Higher score for poses matching focus areas
    for (const area of focusAreas) {
      if (pose.focusAreas.includes(area)) {
        score += 10;
        // Extra points if in the priority list for this area
        const priorityIndex = FOCUS_PRIORITY[area]?.indexOf(pose.id) ?? -1;
        if (priorityIndex >= 0) {
          score += (10 - priorityIndex); // Higher priority = more points
        }
      }
    }

    // Small random factor for variety
    score += Math.random() * 5;

    return { pose, score };
  });

  // Sort by score and pick from top candidates
  scored.sort((a, b) => b.score - a.score);

  // Pick randomly from top 3 to add variety
  const topCandidates = scored.slice(0, Math.min(3, scored.length));
  return pickRandom(topCandidates)?.pose;
}

function buildWarmupPhase(
  state: FlowState,
  availablePoses: Pose[],
  focusAreas: FocusArea[],
  timerMode: 'seconds' | 'breaths',
  targetTime: number
): void {
  // Always start with Mountain
  const mountain = getPoseById('mountain');
  if (mountain && !state.usedPoseIds.has('mountain')) {
    addPoseToFlow(state, mountain, timerMode);
  }

  // Warmup sequence - gentle movements
  const warmupPoses = ['standing-side-stretch', 'forward-fold', 'cat-cow', 'thread-needle'];
  const shuffledWarmup = shuffle(warmupPoses);

  for (const poseId of shuffledWarmup) {
    if (state.timeUsed >= targetTime) break;

    const pose = availablePoses.find(p => p.id === poseId);
    if (pose && !state.usedPoseIds.has(poseId)) {
      // Add transition if needed
      const posePosition = getPosition(poseId);
      if (!canTransitionTo(state.currentPosition, posePosition)) {
        const transition = findTransitionPose(state.currentPosition, posePosition, availablePoses, state.usedPoseIds);
        if (transition) {
          addPoseToFlow(state, transition, timerMode);
        }
      }

      addPoseToFlow(state, pose, timerMode);
    }
  }

  // Add downward dog as transition to main phase
  const downdog = getPoseById('downward-dog');
  if (downdog && !state.usedPoseIds.has('downward-dog') && state.timeUsed < targetTime) {
    addPoseToFlow(state, downdog, timerMode);
  }
}

function buildMainPhase(
  state: FlowState,
  availablePoses: Pose[],
  focusAreas: FocusArea[],
  timerMode: 'seconds' | 'breaths',
  targetTime: number
): void {
  // Get priority poses for focus areas
  const priorityPoses: string[] = [];
  for (const area of focusAreas) {
    const areaPriority = FOCUS_PRIORITY[area] || [];
    priorityPoses.push(...areaPriority);
  }

  // Shuffle to vary the order while keeping focus relevant
  const shuffledPriority = shuffle([...new Set(priorityPoses)]);

  // Try to add priority poses first
  for (const poseId of shuffledPriority) {
    if (state.timeUsed >= targetTime) break;

    const pose = availablePoses.find(p => p.id === poseId);
    if (!pose || state.usedPoseIds.has(poseId)) continue;

    // Check warmup requirements
    if (!hasBeenWarmedUp(poseId, state.usedPoseIds)) continue;

    // Check position transition
    const posePosition = getPosition(poseId);
    if (!canTransitionTo(state.currentPosition, posePosition)) {
      const transition = findTransitionPose(state.currentPosition, posePosition, availablePoses, state.usedPoseIds);
      if (transition) {
        addPoseToFlow(state, transition, timerMode);
      } else {
        continue; // Skip if no good transition
      }
    }

    addPoseToFlow(state, pose, timerMode);
  }

  // Fill remaining time with appropriate poses
  let attempts = 0;
  while (state.timeUsed < targetTime && attempts < 20) {
    attempts++;

    const nextPose = selectNextPose(state, availablePoses, focusAreas);
    if (!nextPose) break;

    addPoseToFlow(state, nextPose, timerMode);
  }
}

function buildCooldownPhase(
  state: FlowState,
  availablePoses: Pose[],
  timerMode: 'seconds' | 'breaths',
  targetTime: number
): void {
  // Transition to floor if needed
  if (state.currentPosition === 'standing') {
    const transition = findTransitionPose('standing', 'hands-knees', availablePoses, state.usedPoseIds);
    if (transition) {
      addPoseToFlow(state, transition, timerMode);
    }
  }

  // Child's pose for transition
  const childspose = getPoseById('childs-pose');
  if (childspose && !state.usedPoseIds.has('childs-pose')) {
    addPoseToFlow(state, childspose, timerMode);
  }

  // Cooldown poses in a sensible order
  const cooldownSequence = shuffle(['seated-forward-fold', 'seated-twist', 'bridge', 'supine-twist', 'happy-baby', 'reclined-butterfly']);

  for (const poseId of cooldownSequence) {
    if (state.timeUsed >= targetTime) break;

    const pose = availablePoses.find(p => p.id === poseId);
    if (pose && !state.usedPoseIds.has(poseId)) {
      const posePosition = getPosition(poseId);

      // Only add if we can transition smoothly
      if (canTransitionTo(state.currentPosition, posePosition)) {
        addPoseToFlow(state, pose, timerMode);
      }
    }
  }

  // Always end with Savasana
  const savasana = getPoseById('corpse');
  if (savasana) {
    addPoseToFlow(state, savasana, timerMode);
  }
}

export function generateFlow(options: FlowOptions): Flow {
  const { duration, focusAreas, timerMode, breathPace, voiceEnabled, difficulty } = options;

  // Filter poses by difficulty
  const availablePoses = filterByDifficulty(poses, difficulty);

  // Calculate time distribution (in seconds)
  const totalSeconds = duration * 60;
  const warmupTime = Math.floor(totalSeconds * 0.2);
  const mainTime = Math.floor(totalSeconds * 0.75); // Warmup + main
  const totalTime = totalSeconds; // Full time including cooldown

  // Initialize flow state
  const state: FlowState = {
    poses: [],
    usedPoseIds: new Set(),
    currentPosition: 'standing',
    timeUsed: 0,
    warmedUpAreas: new Set(),
  };

  // Build phases
  buildWarmupPhase(state, availablePoses, focusAreas, timerMode, warmupTime);
  buildMainPhase(state, availablePoses, focusAreas, timerMode, mainTime);
  buildCooldownPhase(state, availablePoses, timerMode, totalTime);

  return {
    id: generateId(),
    createdAt: new Date().toISOString(),
    duration,
    focusAreas,
    timerMode,
    breathPace,
    voiceEnabled,
    difficulty,
    poses: state.poses
  };
}

export function generateTestFlow(): Flow {
  // Create a short test flow with 15 second poses
  const testPoses = ['mountain', 'forward-fold', 'downward-dog', 'childs-pose', 'corpse'];
  const flowPoses: FlowPose[] = [];

  for (const poseId of testPoses) {
    const pose = poses.find(p => p.id === poseId);
    if (pose) {
      flowPoses.push({
        pose,
        duration: 15,
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
    voiceEnabled: true,
    difficulty: 'beginner',
    poses: flowPoses,
  };
}

export function calculateFlowDuration(flow: Flow): { minutes: number; seconds: number } {
  let totalSeconds = 0;

  for (const fp of flow.poses) {
    if (flow.timerMode === 'breaths') {
      totalSeconds += fp.duration * 5; // Estimate 5 seconds per breath
    } else {
      totalSeconds += fp.duration;
    }
  }

  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60
  };
}
