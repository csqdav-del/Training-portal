import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Discipline } from '../types';

export interface ManualWorkoutInput {
  type: Discipline;
  date: Date;
  duration: number;
  distance?: number;
  calories?: number;
  heartRateAvg?: number;
  notes?: string;
}

export async function addManualWorkout(uid: string, input: ManualWorkoutInput) {
  const id = `manual_${Date.now()}`;
  const ref = doc(db, 'users', uid, 'workouts', id);
  await setDoc(ref, {
    id,
    userId: uid,
    date: input.date.toISOString(),
    type: input.type,
    duration: input.duration,
    distance: input.distance ?? null,
    calories: input.calories ?? null,
    heartRate: input.heartRateAvg ? { avg: input.heartRateAvg, max: input.heartRateAvg } : null,
    notes: input.notes ?? null,
    source: 'manual',
    syncedAt: new Date().toISOString(),
  });
}
