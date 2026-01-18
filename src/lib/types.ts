export type FocusArea =
  | 'lower-back'
  | 'upper-back'
  | 'shoulders'
  | 'hips'
  | 'hamstrings'
  | 'full-body';

export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export type TimerMode = 'seconds' | 'breaths';

export type BreathPace = 'slow' | 'normal' | 'fast';

export type PoseCategory = 'warmup' | 'standing' | 'seated' | 'supine' | 'cooldown';

// Breath duration in seconds (inhale + exhale)
export const BREATH_PACE_SECONDS: Record<BreathPace, number> = {
  slow: 8,    // 4s in, 4s out
  normal: 6,  // 3s in, 3s out
  fast: 4,    // 2s in, 2s out
};

export const BREATH_PACE_LABELS: Record<BreathPace, string> = {
  slow: 'Langzaam (8s)',
  normal: 'Normaal (6s)',
  fast: 'Snel (4s)',
};

export interface Pose {
  id: string;
  englishName: string;
  sanskritName: string;
  description: string;
  benefits: string;
  difficulty: Difficulty;
  focusAreas: FocusArea[];
  category: PoseCategory;
  defaultDuration: number; // seconds
  defaultBreaths: number;
  imageUrl: string;
  instructions: string[];
  hasSides: boolean; // true if pose needs left/right
}

export interface FlowPose {
  pose: Pose;
  duration: number;
  side?: 'left' | 'right' | 'both';
}

export interface Flow {
  id: string;
  createdAt: string;
  duration: number; // total minutes
  focusAreas: FocusArea[];
  timerMode: TimerMode;
  breathPace: BreathPace;
  voiceEnabled: boolean;
  difficulty: Difficulty;
  poses: FlowPose[];
}

export interface FlowOptions {
  duration: number; // minutes
  focusAreas: FocusArea[];
  timerMode: TimerMode;
  breathPace: BreathPace;
  voiceEnabled: boolean;
  difficulty: Difficulty;
}

export interface WizardState {
  step: number;
  duration: number | null;
  focusAreas: FocusArea[];
  timerMode: TimerMode;
  breathPace: BreathPace;
  voiceEnabled: boolean;
  difficulty: Difficulty;
}

export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  'lower-back': 'Onderrug',
  'upper-back': 'Bovenrug',
  'shoulders': 'Schouders',
  'hips': 'Heupen',
  'hamstrings': 'Hamstrings',
  'full-body': 'Full Body',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Gemiddeld',
  expert: 'Gevorderd',
};
