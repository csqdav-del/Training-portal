import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { DailyMetric } from '../types';

/**
 * Métriques quotidiennes issues de Health Connect (sommeil, pas, FC au repos).
 * Un document par jour, id = YYYY-MM-DD, écrit uniquement par la fonction
 * health-sync — le client est en lecture seule (voir firestore.rules).
 */
export function subscribeToDailyMetrics(uid: string, callback: (metrics: DailyMetric[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'dailyMetrics'), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: uid,
          date: data.date ?? docSnap.id,
          steps: data.steps ?? undefined,
          restingHr: data.restingHr ?? undefined,
          sleepMinutes: data.sleepMinutes ?? undefined,
          sleepStart: data.sleepStart ?? undefined,
          sleepEnd: data.sleepEnd ?? undefined,
          sleepDeepMinutes: data.sleepDeepMinutes ?? undefined,
          sleepRemMinutes: data.sleepRemMinutes ?? undefined,
          sleepLightMinutes: data.sleepLightMinutes ?? undefined,
          sleepAwakeMinutes: data.sleepAwakeMinutes ?? undefined,
        };
      }),
    );
  });
}

/** Le doc du jour, s'il existe (les métriques arrivent au réveil / à la synchro). */
export function findMetricForDate(metrics: DailyMetric[], date: Date): DailyMetric | undefined {
  const key = date.toISOString().slice(0, 10);
  return metrics.find((m) => m.date === key);
}
