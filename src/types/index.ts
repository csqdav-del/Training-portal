/** Un exercice d'une séance de musculation saisie à la main. */
export interface StrengthExercise {
  name: string;
  sets?: number;
  reps?: number;
  weightLbs?: number;
}

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
  // --- Saisie manuelle ---
  title?: string; // nom donné à la séance ("Push day", "Nage libre bassin")
  rpe?: number; // effort ressenti 1-10
  exercises?: StrengthExercise[]; // musculation : détail des mouvements
  /** Séance du plan que cette activité vient valider ou remplacer. */
  plannedSessionId?: string;
  plannedWeekNumber?: number;
  // --- Détails enrichis (Strava) ---
  sportType?: string;
  elapsedTime?: number; // minutes, arrêts inclus
  elevationGain?: number; // m
  elevationMax?: number; // m
  avgSpeed?: number; // km/h
  maxSpeed?: number; // km/h
  avgWatts?: number;
  maxWatts?: number;
  weightedWatts?: number; // normalized power
  kilojoules?: number;
  deviceWatts?: boolean; // true = capteur de puissance, false = estimation
  avgCadence?: number;
  sufferScore?: number;
  prCount?: number;
  achievementCount?: number;
  kudosCount?: number;
  photoCount?: number;
  gearName?: string;
  deviceName?: string;
  locationCity?: string;
  locationState?: string;
  polyline?: string; // tracé encodé (map.summary_polyline)
  stravaUrl?: string;
  // --- Détails enrichis (Health Connect) ---
  hcSteps?: number; // pas comptés pendant la séance
}

export interface WeightEntry {
  id: string;
  userId: string;
  date: Date;
  weight: number; // lbs
  notes?: string;
  bodyFatPct?: number; // masse grasse (Health Connect / balance connectée)
  source?: 'manual' | 'health_connect';
}

/**
 * Métriques de récupération quotidiennes, un document par jour (id = YYYY-MM-DD).
 * Alimenté uniquement par Health Connect via la fonction health-sync.
 */
export interface DailyMetric {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  steps?: number;
  restingHr?: number; // bpm
  sleepMinutes?: number;
  sleepStart?: string; // ISO
  sleepEnd?: string; // ISO
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepLightMinutes?: number;
  sleepAwakeMinutes?: number;
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
  strengthDuration: number;
  walkDistance: number;
  walkDuration: number;
  otherDistance: number;
  otherDuration: number;
  totalCalories: number;
  totalWorkouts: number;
  totalDuration: number;
  /** Distance toutes disciplines confondues (marche et « autre » compris). */
  totalDistance: number;
}

export type Discipline = 'swim' | 'bike' | 'run' | 'strength' | 'walk' | 'other';
export type PlanDiscipline = 'swim' | 'bike' | 'run' | 'strength';
export type ZoneKey = 'z1' | 'z2' | 'z3' | 'z4' | 'z5';
export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper';

/** Un exercice prescrit par le plan pour une séance de musculation. */
export interface PlannedExercise {
  name: string;
  sets: number;
  reps: string; // « 10 », « 8-12 », « 30s »...
  /** Consigne courte (tempo, variante, matériel). */
  hint?: string;
}

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
  /**
   * Musculation seulement : les mouvements à faire. Les cibles de zone, de BPM et
   * de distance n'ont aucun sens en salle — l'UI les masque quand ce champ est là.
   */
  targetExercises?: PlannedExercise[];
}

/** Objectif hebdomadaire d'une discipline, affiché au tableau de bord. */
export interface DisciplineTarget {
  /** Volume visé cette semaine : km (swim/bike/run) ou nombre de séances (force). */
  target: number;
  unit: 'km' | 'séances';
  /** Durée totale visée sur la semaine, en minutes. */
  targetDurationMin: number;
}

/** Où on en est dans le plan de 48 semaines. */
export interface PlanProgress {
  weekNumber: number;
  totalWeeks: number;
  /** % du plan écoulé, jours de la semaine en cours inclus. */
  pct: number;
  weeksRemaining: number;
  daysUntilRace: number;
  phase: Phase;
  phaseLabel: string;
  focus: string;
  /** true avant le tout début du plan. */
  notStarted: boolean;
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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry {
  id: string;
  mealType: MealType;
  label: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: string; // ISO timestamp
}

export interface FoodSearchResult {
  foodId: string;
  label: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}
