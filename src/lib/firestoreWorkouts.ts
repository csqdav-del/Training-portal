import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Discipline, StrengthExercise, Workout } from '../types';
import { parseFirestoreDate, parseFirestoreDateOr } from './firestoreDate';

export function subscribeToWorkouts(uid: string, callback: (workouts: Workout[]) => void): () => void {
  // Comme pour les pesées : on trie côté client pour ne perdre aucune activité
  // dont le champ `date` aurait un type différent des autres.
  const ref = collection(db, 'users', uid, 'workouts');
  return onSnapshot(ref, (snap) => {
    const workouts: Workout[] = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: uid,
        date: parseFirestoreDateOr(data.date, new Date(0)),
        type: (data.type ?? 'other') as Discipline,
        duration: data.duration ?? 0,
        distance: data.distance ?? undefined,
        calories: data.calories ?? undefined,
        heartRate: data.heartRate ?? undefined,
        notes: data.notes ?? undefined,
        source: data.source ?? 'manual',
        externalId: data.externalId ?? undefined,
        syncedAt: parseFirestoreDate(data.syncedAt) ?? new Date(),
        title: data.title ?? undefined,
        rpe: data.rpe ?? undefined,
        exercises: (data.exercises as StrengthExercise[] | null) ?? undefined,
        plannedSessionId: data.plannedSessionId ?? undefined,
        plannedWeekNumber: data.plannedWeekNumber ?? undefined,
        sportType: data.sportType ?? undefined,
        elapsedTime: data.elapsedTime ?? undefined,
        elevationGain: data.elevationGain ?? undefined,
        elevationMax: data.elevationMax ?? undefined,
        avgSpeed: data.avgSpeed ?? undefined,
        maxSpeed: data.maxSpeed ?? undefined,
        avgWatts: data.avgWatts ?? undefined,
        maxWatts: data.maxWatts ?? undefined,
        weightedWatts: data.weightedWatts ?? undefined,
        kilojoules: data.kilojoules ?? undefined,
        deviceWatts: data.deviceWatts ?? undefined,
        avgCadence: data.avgCadence ?? undefined,
        sufferScore: data.sufferScore ?? undefined,
        prCount: data.prCount ?? undefined,
        achievementCount: data.achievementCount ?? undefined,
        kudosCount: data.kudosCount ?? undefined,
        photoCount: data.photoCount ?? undefined,
        gearName: data.gearName ?? undefined,
        deviceName: data.deviceName ?? undefined,
        locationCity: data.locationCity ?? undefined,
        locationState: data.locationState ?? undefined,
        polyline: data.polyline ?? undefined,
        stravaUrl: data.stravaUrl ?? undefined,
      };
    });
    workouts.sort((a, b) => b.date.getTime() - a.date.getTime());
    callback(workouts);
  });
}
