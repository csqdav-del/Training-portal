export interface Workout {
  id: string;
  userId: string;
  date: Date;
  type: Discipline;
  duration: number; // minutes
  distance?: number; // km
  calories?: number;
  heartRate?: {
    avg: number;
    max: number;
  };
  notes?: string;
  source: 'strava' | 'health_connect' | 'manual';
  externalId?: string;
  syncedAt: Date;
}

export interface WeightEntry {
  id: string;
  userId: string;
  date: Date;
  weight: number; // lbs
  notes?: string;
}

export interface TrainingZones {
  z1: { min: number; max: number; label: string };
  z2: { min: number; max: number; label: string };
  z3: { min: number; max: number; label: string };
  z4: { min: number; max: number; label: string };
  z5: { min: number; max: number; label: string };
}

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  fcMax: number;
  lastSyncStrava?: Date;
  lastSyncHealth?: Date;
}

export interface VapingLog {
  id: string;
  userId: string;
  startDate: Date;
  lastQuitDate?: Date;
  currentStreak: number;
  notes?: string;
}

export interface WeeklyStats {
  swimDistance: number;
  swimDuration: number;
  bikeDistance: number;
  bikeDuration: number;
  runDistance: number;
  runDuration: number;
  strengthSessions: number;
  totalCalories: number;
  totalWorkouts: number;
}

export type Discipline = 'swim' | 'bike' | 'run' | 'strength' | 'walk' | 'other';
export type PlanDiscipline = 'swim' | 'bike' | 'run' | 'strength';
export type ZoneKey = 'z1' | 'z2' | 'z3' | 'z4' | 'z5';
export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper';

export interface PlannedSession {
  id: string;
  discipline: PlanDiscipline;
  title: string;
  structure: string[];
  targetZone: ZoneKey;
  targetBpmMin: number;
  targetBpmMax: number;
  targetDistanceKm: number;
  targetDurationMin: number;
}

export interface DayPlan {
  dayIndex: number; // 0 = Lundi ... 6 = Dimanche
  date: Date;
  sessions: PlannedSession[];
}

export interface WeekPlan {
  weekNumber: number;
  phase: Phase;
  phaseLabel: string;
  focus: string;
  startDate: Date;
  endDate: Date;
  days: DayPlan[];
  volumeSummary: {
    swimKm: number;
    bikeKm: number;
    runKm: number;
    strengthSessions: number;
  };
}
