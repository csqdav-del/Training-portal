import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Discipline, StrengthExercise } from '../types';

export interface ManualWorkoutInput {
  type: Discipline;
  date: Date;
  duration: number;
  title?: string;
  distance?: number;
  calories?: number;
  heartRateAvg?: number;
  rpe?: number;
  exercises?: StrengthExercise[];
  notes?: string;
  /** Séance du plan validée ou remplacée par cette activité. */
  plannedSessionId?: string;
  plannedWeekNumber?: number;
}

/**
 * Les règles Firestore n'autorisent l'écriture côté client que sur les documents
 * dont l'id commence par `manual_` — c'est ce qui empêche de falsifier une
 * activité Strava ou Health Connect. Tout passe donc par ce préfixe.
 */
function isManualId(id: string): boolean {
  return id.startsWith('manual_');
}

function toDocument(uid: string, id: string, input: ManualWorkoutInput) {
  // Firestore refuse `undefined` : on écrit `null` pour les champs vides afin
  // qu'une modification efface bien une valeur précédemment saisie.
  const exercises = (input.exercises ?? []).filter((e) => e.name.trim() !== '');
  return {
    id,
    userId: uid,
    date: input.date.toISOString(),
    type: input.type,
    duration: input.duration,
    title: input.title?.trim() || null,
    distance: input.distance ?? null,
    calories: input.calories ?? null,
    heartRate: input.heartRateAvg ? { avg: input.heartRateAvg, max: input.heartRateAvg } : null,
    rpe: input.rpe ?? null,
    exercises: exercises.length > 0 ? exercises : null,
    notes: input.notes?.trim() || null,
    plannedSessionId: input.plannedSessionId ?? null,
    plannedWeekNumber: input.plannedWeekNumber ?? null,
    source: 'manual',
    syncedAt: new Date().toISOString(),
  };
}

/** Crée une activité saisie à la main. Retourne son id. */
export async function addManualWorkout(uid: string, input: ManualWorkoutInput): Promise<string> {
  const id = `manual_${Date.now()}`;
  await setDoc(doc(db, 'users', uid, 'workouts', id), toDocument(uid, id, input));
  return id;
}

/** Réécrit une activité manuelle existante (le formulaire renvoie tous les champs). */
export async function updateManualWorkout(uid: string, id: string, input: ManualWorkoutInput): Promise<void> {
  if (!isManualId(id)) throw new Error('Seules les activités saisies à la main sont modifiables');
  await setDoc(doc(db, 'users', uid, 'workouts', id), toDocument(uid, id, input));
}

/** Supprime une activité manuelle. Les entrées Strava/Health Connect sont intouchables. */
export async function deleteManualWorkout(uid: string, id: string): Promise<void> {
  if (!isManualId(id)) throw new Error('Seules les activités saisies à la main sont supprimables');
  await deleteDoc(doc(db, 'users', uid, 'workouts', id));
}

/** Une activité vient-elle de la saisie manuelle (donc modifiable) ? */
export function isManualWorkout(id: string): boolean {
  return isManualId(id);
}

/** Suggestions d'exercices proposées dans le formulaire de musculation. */
export const COMMON_EXERCISES = [
  'Développé couché',
  'Développé militaire',
  'Squat',
  'Soulevé de terre',
  'Fentes',
  'Presse à cuisses',
  'Rowing barre',
  'Tirage vertical',
  'Tractions',
  'Dips',
  'Curl biceps',
  'Extensions triceps',
  'Élévations latérales',
  'Gainage',
  'Leg curl',
  'Mollets',
];
