export interface Workout {
  id: string;
  userId: string;
  date: Date;
  type: 'swim' | 'bike' | 'run' | 'strength';
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
  weight: number; // kg
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
