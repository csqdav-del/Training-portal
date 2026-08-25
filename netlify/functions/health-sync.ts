import { adminAuth, adminDb } from './_firebaseAdmin';

/**
 * Health Connect n'a pas d'API serveur : les données vivent uniquement sur le
 * téléphone. C'est donc l'app Android (Capacitor) qui les lit et les POSTe ici.
 * Cette fonction ne fait que valider, normaliser et écrire dans Firestore avec
 * l'Admin SDK — même découpage que strava-sync.ts, où le client ne peut jamais
 * écrire lui-même les données synchronisées (voir firestore.rules).
 */

// --- Types du payload envoyé par l'app -------------------------------------

interface HcExercise {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  exerciseType: string | number; // constante Health Connect (int) ou nom
  title?: string | null;
  notes?: string | null;
  distanceMeters?: number | null;
  calories?: number | null; // kcal
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  steps?: number | null;
  /** Durée réelle en secondes (pauses exclues) quand le plugin la fournit. */
  durationSeconds?: number | null;
}

interface HcWeight {
  time: string; // ISO
  weightKg: number;
  bodyFatPct?: number | null;
}

interface HcSleep {
  startTime: string; // ISO
  endTime: string; // ISO
  deepMinutes?: number | null;
  remMinutes?: number | null;
  lightMinutes?: number | null;
  awakeMinutes?: number | null;
}

interface HcSteps {
  date: string; // YYYY-MM-DD
  count: number;
}

interface HcRestingHr {
  time: string; // ISO
  bpm: number;
}

interface HealthPayload {
  exercises?: HcExercise[];
  weights?: HcWeight[];
  sleep?: HcSleep[];
  steps?: HcSteps[];
  restingHr?: HcRestingHr[];
}

// --- Mapping des types d'exercice ------------------------------------------

// Le plugin renvoie des libellés camelCase ("swimmingPool", "strengthTraining").
// On normalise en majuscules sans séparateur pour tolérer aussi bien
// "SWIMMING_POOL" que "swimmingPool" — ça évite de dépendre du formatage exact.
const RUN = new Set(['RUNNING', 'RUNNINGTREADMILL', 'WHEELCHAIRRUNPACE']);
const BIKE = new Set(['CYCLING', 'BIKING', 'BIKINGSTATIONARY', 'HANDCYCLING']);
const SWIM = new Set(['SWIMMING', 'SWIMMINGPOOL', 'SWIMMINGOPENWATER', 'WATERFITNESS']);
const STRENGTH = new Set([
  'STRENGTHTRAINING',
  'TRADITIONALSTRENGTHTRAINING',
  'FUNCTIONALSTRENGTHTRAINING',
  'WEIGHTLIFTING',
  'CALISTHENICS',
  'CORETRAINING',
  'CROSSTRAINING',
  'HIGHINTENSITYINTERVALTRAINING',
  'BOOTCAMP',
  'ELLIPTICAL',
  'ROWING',
  'ROWINGMACHINE',
  'STAIRCLIMBING',
  'STAIRCLIMBINGMACHINE',
  'STAIRS',
  'STEPTRAINING',
  'EXERCISECLASS',
  'PILATES',
  'BARRE',
]);
const WALK = new Set(['WALKING', 'HIKING', 'SNOWSHOEING', 'WHEELCHAIRWALKPACE']);

/** Nom canonique du type d'exercice, quelle que soit la forme reçue. */
function exerciseTypeName(raw: string | number): string {
  return String(raw)
    .toUpperCase()
    .replace(/^EXERCISE_TYPE_/, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Miroir de mapDiscipline() dans strava-sync.ts, côté Health Connect. */
function mapDiscipline(typeName: string): string {
  if (RUN.has(typeName)) return 'run';
  if (BIKE.has(typeName)) return 'bike';
  if (SWIM.has(typeName)) return 'swim';
  if (STRENGTH.has(typeName)) return 'strength';
  if (WALK.has(typeName)) return 'walk';
  return 'other';
}

// --- Helpers ---------------------------------------------------------------

const KG_TO_LBS = 2.20462;
/** Tolérance de déduplication avec Strava : même discipline, départ proche. */
const DEDUP_WINDOW_MS = 15 * 60 * 1000;

const round = (v: unknown, decimals = 0): number | null => {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

const minutesBetween = (start: string, end: string) =>
  Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));

/** Clé de jour (YYYY-MM-DD) — les docs weights/dailyMetrics sont un par jour. */
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const isValidDate = (iso: unknown) =>
  typeof iso === 'string' && !Number.isNaN(new Date(iso).getTime());

// --- Handler ---------------------------------------------------------------

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.replace('Bearer ', '');
  if (!idToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let payload: HealthPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad_payload' }), { status: 400 });
  }

  const exercises = (payload.exercises ?? []).filter(
    (e) => e && typeof e.id === 'string' && isValidDate(e.startTime) && isValidDate(e.endTime),
  );
  const weights = (payload.weights ?? []).filter(
    (w) => w && isValidDate(w.time) && typeof w.weightKg === 'number' && w.weightKg > 0,
  );
  const sleep = (payload.sleep ?? []).filter(
    (s) => s && isValidDate(s.startTime) && isValidDate(s.endTime),
  );
  const steps = (payload.steps ?? []).filter(
    (s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s.date ?? '') && typeof s.count === 'number',
  );
  const restingHr = (payload.restingHr ?? []).filter(
    (r) => r && isValidDate(r.time) && typeof r.bpm === 'number' && r.bpm > 0,
  );

  const db = adminDb();
  const now = new Date().toISOString();
  // On dérive le type de la référence depuis db.doc() plutôt que du namespace
  // global FirebaseFirestore, qui n'est pas toujours visible selon la config TS.
  const writes: Array<{ ref: ReturnType<typeof db.doc>; data: Record<string, unknown> }> = [];

  // --- 1. Séances -----------------------------------------------------------
  // Strava reste la source de vérité quand les deux ont la même séance : il
  // apporte les watts, le tracé et le matériel. On saute donc toute séance
  // Health Connect qui recoupe une séance Strava (même discipline, départ à
  // moins de 15 min). Sans ça, chaque sortie apparaîtrait en double.
  let skippedAsDuplicate = 0;

  if (exercises.length) {
    const starts = exercises.map((e) => new Date(e.startTime).getTime());
    const rangeStart = new Date(Math.min(...starts) - DEDUP_WINDOW_MS).toISOString();
    const rangeEnd = new Date(Math.max(...starts) + DEDUP_WINDOW_MS).toISOString();

    // `date` est stocké en ISO : l'ordre lexicographique équivaut à l'ordre
    // chronologique, donc une requête de plage fonctionne directement.
    const existingSnap = await db
      .collection(`users/${uid}/workouts`)
      .where('date', '>=', rangeStart)
      .where('date', '<=', rangeEnd)
      .get();

    const stravaWorkouts = existingSnap.docs
      .map((d) => d.data())
      .filter((d) => d.source === 'strava')
      .map((d) => ({ type: d.type as string, at: new Date(d.date as string).getTime() }));

    for (const e of exercises) {
      const typeName = exerciseTypeName(e.exerciseType);
      const discipline = mapDiscipline(typeName);
      const startedAt = new Date(e.startTime).getTime();

      const duplicate = stravaWorkouts.some(
        (s) => s.type === discipline && Math.abs(s.at - startedAt) < DEDUP_WINDOW_MS,
      );
      if (duplicate) {
        skippedAsDuplicate++;
        continue;
      }

      const id = `hc_${e.id}`;
      // Temps écoulé entre les bornes ; la durée réelle exclut les pauses.
      const elapsedMin = minutesBetween(e.startTime, e.endTime);
      const durationMin =
        typeof e.durationSeconds === 'number' && e.durationSeconds > 0
          ? Math.round(e.durationSeconds / 60)
          : elapsedMin;
      writes.push({
        ref: db.doc(`users/${uid}/workouts/${id}`),
        data: {
          id,
          userId: uid,
          date: new Date(e.startTime).toISOString(),
          type: discipline,
          duration: durationMin,
          distance: typeof e.distanceMeters === 'number' ? round(e.distanceMeters / 1000, 2) : null,
          calories: round(e.calories),
          heartRate: e.avgHeartRate
            ? { avg: Math.round(e.avgHeartRate), max: Math.round(e.maxHeartRate || e.avgHeartRate) }
            : null,
          notes: e.title ?? e.notes ?? null,
          source: 'health_connect',
          externalId: e.id,
          syncedAt: now,
          // Libellé brut du plugin ("swimmingPool"), lisible tel quel dans l'UI,
          // là où typeName est la forme normalisée servant au mapping.
          sportType: String(e.exerciseType),
          elapsedTime: elapsedMin,
          hcSteps: round(e.steps),
        },
      });
    }
  }

  // --- 2. Poids + composition corporelle ------------------------------------
  // Un seul relevé par jour (id = date), comme addWeightEntry() côté client.
  // Health Connect stocke en kg, l'app affiche en lbs partout.
  const weightByDay = new Map<string, HcWeight>();
  for (const w of weights) {
    const key = dayKey(w.time);
    const kept = weightByDay.get(key);
    // On garde le relevé le plus récent de la journée.
    if (!kept || new Date(w.time) > new Date(kept.time)) weightByDay.set(key, w);
  }
  for (const [key, w] of weightByDay) {
    writes.push({
      ref: db.doc(`users/${uid}/weights/${key}`),
      data: {
        id: key,
        userId: uid,
        date: new Date(w.time).toISOString(),
        weight: round(w.weightKg * KG_TO_LBS, 1),
        bodyFatPct: round(w.bodyFatPct, 1),
        source: 'health_connect',
      },
    });
  }

  // --- 3. Métriques quotidiennes (sommeil, pas, FC repos) -------------------
  const daily = new Map<string, Record<string, unknown>>();
  const touchDay = (key: string) => {
    if (!daily.has(key)) daily.set(key, { id: key, userId: uid, date: key, syncedAt: now });
    return daily.get(key)!;
  };

  for (const s of sleep) {
    // Une nuit est rattachée au jour du réveil : c'est la récup de cette journée.
    const day = touchDay(dayKey(s.endTime));
    day.sleepMinutes = minutesBetween(s.startTime, s.endTime);
    day.sleepStart = new Date(s.startTime).toISOString();
    day.sleepEnd = new Date(s.endTime).toISOString();
    day.sleepDeepMinutes = round(s.deepMinutes);
    day.sleepRemMinutes = round(s.remMinutes);
    day.sleepLightMinutes = round(s.lightMinutes);
    day.sleepAwakeMinutes = round(s.awakeMinutes);
  }
  for (const s of steps) {
    touchDay(s.date).steps = Math.round(s.count);
  }
  for (const r of restingHr) {
    touchDay(dayKey(r.time)).restingHr = Math.round(r.bpm);
  }
  for (const [key, data] of daily) {
    writes.push({ ref: db.doc(`users/${uid}/dailyMetrics/${key}`), data });
  }

  // --- 4. Écriture ----------------------------------------------------------
  // Un batch Firestore plafonne à 500 opérations : on découpe.
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = db.batch();
    for (const { ref, data } of writes.slice(i, i + CHUNK)) {
      batch.set(ref, data, { merge: true });
    }
    await batch.commit();
  }

  const workoutCount = writes.length - weightByDay.size - daily.size;

  await db.doc(`users/${uid}`).set(
    {
      healthConnected: true,
      lastHealthSyncAt: Date.now(),
      lastHealthSyncCount: writes.length,
    },
    { merge: true },
  );

  return new Response(
    JSON.stringify({
      synced: writes.length,
      workouts: workoutCount,
      weights: weightByDay.size,
      days: daily.size,
      skippedAsDuplicate,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
