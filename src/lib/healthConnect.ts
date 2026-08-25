import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  hasPermissions,
  isAvailable,
  isNative,
  readDailyTotals,
  readSamples,
  readWorkouts,
  requestPermissions,
} from './healthConnectPlugin';

/**
 * Pendant côté Health Connect de strava.ts : même trio connecter / synchroniser
 * / observer le statut. La différence est que la lecture se fait sur l'appareil
 * (pas d'API serveur chez Google), puis le résultat est POSTé à la fonction
 * health-sync qui écrit dans Firestore avec l'Admin SDK.
 */

/** Même fenêtre que la synchro Strava (60 jours, cf. strava-sync.ts). */
const SYNC_WINDOW_DAYS = 60;

/**
 * En natif, la WebView sert `capacitor://localhost` : une URL relative ne
 * pointerait pas vers Netlify. VITE_API_BASE doit contenir l'origine du site
 * déployé pour le build Android.
 */
const API_BASE = import.meta.env.VITE_API_BASE || '';

const ms = (iso: string) => new Date(iso).getTime();
const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

// --- API publique -----------------------------------------------------------

/** Le portail web n'a pas accès à Health Connect : l'UI doit le dire. */
export function isHealthConnectSupported(): boolean {
  return isNative();
}

export function isHealthConnectAvailable(): Promise<boolean> {
  return isAvailable();
}

export function isHealthConnectAuthorized(): Promise<boolean> {
  return hasPermissions();
}

/** Équivalent de connectStrava() : ouvre l'écran de permissions Health Connect. */
export function connectHealthConnect(): Promise<boolean> {
  return requestPermissions();
}

export interface HealthSyncResult {
  synced: number;
  workouts: number;
  weights: number;
  days: number;
  skippedAsDuplicate: number;
}

export async function syncHealthConnect(): Promise<HealthSyncResult | { error: string }> {
  const user = auth.currentUser;
  if (!user) return { error: 'not_logged_in' };
  if (!isNative()) return { error: 'not_native' };
  if (!(await isAvailable())) return { error: 'health_connect_unavailable' };
  if (!(await hasPermissions())) return { error: 'not_authorized' };

  const end = new Date();
  const start = new Date(end.getTime() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [rawWorkouts, heartRates, weightSamples, bodyFatSamples, sleepSamples, stepTotals, restingSamples] =
    await Promise.all([
      readWorkouts(start, end),
      readSamples('heartRate', start, end, 5000),
      readSamples('weight', start, end),
      readSamples('bodyFat', start, end),
      readSamples('sleep', start, end),
      readDailyTotals('steps', start, end),
      readSamples('restingHeartRate', start, end),
    ]);

  // --- Séances --------------------------------------------------------------
  // Distance et calories sont déjà portées par la séance. Seule la FC doit être
  // recoupée : les échantillons de fréquence cardiaque sont indépendants.
  const hrPoints = heartRates
    .map((h) => ({ at: ms(h.startDate), bpm: h.value }))
    .filter((h) => Number.isFinite(h.at) && h.bpm > 0)
    .sort((a, b) => a.at - b.at);

  const exercises = rawWorkouts
    .filter((w) => w.startDate && w.endDate)
    .map((w, i) => {
      const sStart = ms(w.startDate);
      const sEnd = ms(w.endDate);
      const inSession = hrPoints.filter((h) => h.at >= sStart && h.at <= sEnd).map((h) => h.bpm);

      return {
        id: w.platformId ?? `${w.startDate}_${i}`,
        startTime: w.startDate,
        endTime: w.endDate,
        exerciseType: w.workoutType,
        title: w.sourceName ?? null,
        notes: null,
        distanceMeters: typeof w.totalDistance === 'number' ? Math.round(w.totalDistance) : null,
        calories: typeof w.totalEnergyBurned === 'number' ? Math.round(w.totalEnergyBurned) : null,
        avgHeartRate: inSession.length
          ? Math.round(inSession.reduce((a, b) => a + b, 0) / inSession.length)
          : null,
        maxHeartRate: inSession.length ? Math.round(Math.max(...inSession)) : null,
        // `duration` du plugin est en secondes ; le serveur recalcule depuis les
        // bornes, on le transmet quand même pour les séances avec pauses.
        durationSeconds: typeof w.duration === 'number' ? Math.round(w.duration) : null,
      };
    });

  // --- Poids (+ masse grasse du même jour) ---------------------------------
  const bodyFatByDay = new Map<string, number>();
  for (const b of bodyFatSamples) {
    if (b.value > 0) bodyFatByDay.set(dayOf(b.startDate), b.value);
  }

  const weights = weightSamples
    .filter((w) => w.value > 0)
    .map((w) => ({
      time: w.startDate,
      // Le plugin normalise le poids en kilogrammes.
      weightKg: w.value,
      bodyFatPct: bodyFatByDay.get(dayOf(w.startDate)) ?? null,
    }));

  // --- Sommeil --------------------------------------------------------------
  const sleep = sleepSamples
    .filter((s) => s.startDate && s.endDate)
    .map((s) => {
      const buckets = { deep: 0, rem: 0, light: 0, awake: 0 };
      for (const stage of s.stages ?? []) {
        const minutes = stage.durationMinutes;
        if (!Number.isFinite(minutes) || minutes <= 0) continue;
        if (stage.stage === 'deep') buckets.deep += minutes;
        else if (stage.stage === 'rem') buckets.rem += minutes;
        else if (stage.stage === 'light' || stage.stage === 'asleep') buckets.light += minutes;
        else if (stage.stage === 'awake' || stage.stage === 'inBed') buckets.awake += minutes;
      }
      return {
        startTime: s.startDate,
        endTime: s.endDate,
        deepMinutes: Math.round(buckets.deep) || null,
        remMinutes: Math.round(buckets.rem) || null,
        lightMinutes: Math.round(buckets.light) || null,
        awakeMinutes: Math.round(buckets.awake) || null,
      };
    });

  // --- Pas : déjà agrégés par journée côté plugin --------------------------
  const steps = stepTotals
    .filter((s) => s.value > 0)
    .map((s) => ({ date: dayOf(s.startDate), count: Math.round(s.value) }));

  // --- FC au repos ----------------------------------------------------------
  const restingHr = restingSamples
    .filter((r) => r.value > 0)
    .map((r) => ({ time: r.startDate, bpm: r.value }));

  const idToken = await user.getIdToken();
  const res = await fetch(`${API_BASE}/.netlify/functions/health-sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercises, weights, sleep, steps, restingHr }),
  });
  if (!res.ok) return { error: `http_${res.status}` };
  return res.json();
}

export function subscribeToHealthStatus(uid: string, callback: (connected: boolean) => void): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(Boolean(snap.data()?.healthConnected));
  });
}
