import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Discipline, Workout } from '../types';

export function subscribeToWorkouts(uid: string, callback: (workouts: Workout[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'workouts'), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    const workouts: Workout[] = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: uid,
        date: new Date(data.date),
        type: (data.type ?? 'other') as Discipline,
        duration: data.duration ?? 0,
        distance: data.distance ?? undefined,
        calories: data.calories ?? undefined,
        heartRate: data.heartRate ?? undefined,
        notes: data.notes ?? undefined,
        source: data.source ?? 'manual',
        externalId: data.externalId ?? undefined,
        syncedAt: data.syncedAt ? new Date(data.syncedAt) : new Date(),
      };
    });
    callback(workouts);
  });
}
