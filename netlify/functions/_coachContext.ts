import { adminDb } from './_firebaseAdmin';
import {
  ATHLETE_PROFILE,
  HR_ZONES,
  NUTRITION_TARGETS,
  RACE,
  TOTAL_WEEKS,
  TRAINING_PLAN,
  WEIGHT_GOAL_LBS,
  planProgress,
  targetsFromDays,
} from '../../src/data/trainingPlan';
import { applyWeekOverrides, parseOverrides } from '../../src/lib/planOverrides';
import type { WeekPlanOverrides } from '../../src/lib/planOverrides';
import { parseFirestoreDate } from '../../src/lib/firestoreDate';
import { formatDuration, formatPace } from '../../src/lib/format';
import type { Discipline } from '../../src/types';

/**
 * Fabrique le « briefing » envoyé à Claude : un instantané compact des données
 * réelles de David. Volontairement en Markdown plutôt qu'en JSON — moins de
 * tokens à information égale, et le modèle s'y repère mieux.
 *
 * Tout est lu côté serveur avec l'Admin SDK : le client n'envoie rien, donc ne
 * peut rien falsifier, et le payload reste petit.
 */

/**
 * Sommeil / FC de repos / pas (collection `dailyMetrics`). Laissé hors du contexte
 * à la demande de David. Passer à `true` suffit à l'activer : c'est le signal le
 * plus fort pour détecter une surcharge (« FC de repos en hausse depuis 10 jours »).
 */
const INCLUDE_RECOVERY = false;

const WORKOUT_WINDOW_DAYS = 90;
const WEIGHT_WINDOW_DAYS = 90;
const NUTRITION_WINDOW_DAYS = 30;
const VAPING_WINDOW_DAYS = 30;
const RECOVERY_WINDOW_DAYS = 60;
/** Semaines du plan exposées autour de la semaine courante — l'IA ne propose que là-dedans. */
const WEEK_RADIUS = 2;

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export interface CoachContext {
  markdown: string;
  weekNumber: number;
  /** Personnalisations déjà enregistrées, par semaine — sert à valider les propositions. */
  overridesByWeek: Record<number, WeekPlanOverrides>;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// --- Lectures Firestore ----------------------------------------------------

interface RawWorkout {
  id: string;
  date: Date;
  type: Discipline;
  duration: number;
  distance?: number;
  avgHr?: number;
  maxHr?: number;
  rpe?: number;
  avgWatts?: number;
  source?: string;
  plannedSessionId?: string;
}

/**
 * On lit la collection entière et on filtre en mémoire plutôt que d'utiliser un
 * `where` sur `date` : le champ a été écrit tantôt en ISO, tantôt en Timestamp,
 * et une requête de plage écarterait silencieusement les types non conformes
 * (même piège que dans firestoreWeights.ts).
 */
async function readWorkouts(uid: string): Promise<RawWorkout[]> {
  const snap = await adminDb().collection('users').doc(uid).collection('workouts').get();
  const cutoff = daysAgo(WORKOUT_WINDOW_DAYS).getTime();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      const date = parseFirestoreDate(d.date);
      if (!date || date.getTime() < cutoff) return null;
      const hr = d.heartRate as { avg?: number; max?: number } | undefined;
      return {
        id: doc.id,
        date,
        type: (d.type ?? 'other') as Discipline,
        duration: Number(d.duration) || 0,
        distance: typeof d.distance === 'number' ? d.distance : undefined,
        avgHr: hr?.avg,
        maxHr: hr?.max,
        rpe: typeof d.rpe === 'number' ? d.rpe : undefined,
        avgWatts: typeof d.avgWatts === 'number' ? d.avgWatts : undefined,
        source: d.source,
        plannedSessionId: d.plannedSessionId,
      } as RawWorkout;
    })
    .filter((w): w is RawWorkout => w !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function readOverrides(uid: string, weeks: number[]): Promise<Record<number, WeekPlanOverrides>> {
  const db = adminDb();
  const out: Record<number, WeekPlanOverrides> = {};
  await Promise.all(
    weeks.map(async (w) => {
      const snap = await db.collection('users').doc(uid).collection('scheduleOverrides').doc(String(w)).get();
      out[w] = parseOverrides(snap.data() as Record<string, unknown> | undefined);
    }),
  );
  return out;
}

interface WeightPoint {
  date: Date;
  lbs: number;
}

async function readWeights(uid: string): Promise<WeightPoint[]> {
  const snap = await adminDb().collection('users').doc(uid).collection('weights').get();
  const cutoff = daysAgo(WEIGHT_WINDOW_DAYS).getTime();
  return snap.docs
    .map((doc) => {
      const d = doc.data();
      const date = parseFirestoreDate(d.date) ?? parseFirestoreDate(doc.id);
      const lbs = Number(d.weight);
      if (!date || !Number.isFinite(lbs) || lbs <= 0 || date.getTime() < cutoff) return null;
      return { date, lbs };
    })
    .filter((w): w is WeightPoint => w !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface NutritionDay {
  key: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** On n'envoie que les totaux du jour : la liste des aliments n'apporte rien au coaching. */
async function readNutrition(uid: string): Promise<NutritionDay[]> {
  const snap = await adminDb().collection('users').doc(uid).collection('nutritionLogs').get();
  const cutoffKey = dayKey(daysAgo(NUTRITION_WINDOW_DAYS));

  return snap.docs
    .filter((doc) => doc.id >= cutoffKey)
    .map((doc) => {
      const entries = (doc.data().entries ?? []) as {
        kcal?: number;
        proteinG?: number;
        carbsG?: number;
        fatG?: number;
      }[];
      const total = entries.reduce<Omit<NutritionDay, 'key'>>(
        (acc, e) => ({
          kcal: acc.kcal + (e.kcal ?? 0),
          proteinG: acc.proteinG + (e.proteinG ?? 0),
          carbsG: acc.carbsG + (e.carbsG ?? 0),
          fatG: acc.fatG + (e.fatG ?? 0),
        }),
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      );
      return { key: doc.id, ...total };
    })
    .filter((d) => d.kcal > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

async function readVaping(uid: string): Promise<{ key: string; count: number }[]> {
  const snap = await adminDb().collection('users').doc(uid).collection('vapingLogs').get();
  const cutoffKey = dayKey(daysAgo(VAPING_WINDOW_DAYS));
  return snap.docs
    .filter((doc) => doc.id >= cutoffKey)
    .map((doc) => ({ key: doc.id, count: Number(doc.data().count) || 0 }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

interface RecoveryDay {
  key: string;
  steps?: number;
  restingHr?: number;
  sleepMinutes?: number;
}

async function readRecovery(uid: string): Promise<RecoveryDay[]> {
  const snap = await adminDb().collection('users').doc(uid).collection('dailyMetrics').get();
  const cutoffKey = dayKey(daysAgo(RECOVERY_WINDOW_DAYS));
  return snap.docs
    .filter((doc) => doc.id >= cutoffKey)
    .map((doc) => {
      const d = doc.data();
      const sleep =
        (d.sleepDeepMinutes ?? 0) + (d.sleepRemMinutes ?? 0) + (d.sleepLightMinutes ?? 0) || undefined;
      return {
        key: doc.id,
        steps: typeof d.steps === 'number' ? d.steps : undefined,
        restingHr: typeof d.restingHr === 'number' ? d.restingHr : undefined,
        sleepMinutes: sleep,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

// --- Rendu Markdown --------------------------------------------------------

function renderWorkouts(workouts: RawWorkout[]): string {
  if (workouts.length === 0) return '_Aucun entrainement logge sur la periode._';

  const rows = workouts.map((w) => {
    const pace = formatPace(w.type, w.distance, w.duration) ?? '—';
    const hr = w.avgHr ? `${w.avgHr}${w.maxHr ? `/${w.maxHr}` : ''}` : '—';
    const extras = [
      w.avgWatts ? `${Math.round(w.avgWatts)}W` : null,
      w.rpe ? `RPE ${w.rpe}` : null,
      w.plannedSessionId ? `plan:${w.plannedSessionId}` : null,
      w.source && w.source !== 'manual' ? w.source : null,
    ]
      .filter(Boolean)
      .join(' ');
    const dist = w.distance ? `${round(w.distance, 2)} km` : '—';
    return `| ${dayKey(w.date)} | ${w.type} | ${formatDuration(w.duration)} | ${dist} | ${pace} | ${hr} | ${
      extras || '—'
    } |`;
  });

  return [
    '| Date | Sport | Duree | Distance | Allure | FC moy/max | Notes |',
    '|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function renderWeeklyTotals(workouts: RawWorkout[]): string {
  const byWeek = new Map<string, Record<string, { km: number; min: number; n: number }>>();

  for (const w of workouts) {
    // Clé = lundi de la semaine du workout.
    const d = new Date(w.date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = dayKey(d);
    const week = byWeek.get(key) ?? {};
    const cur = week[w.type] ?? { km: 0, min: 0, n: 0 };
    cur.km += w.distance ?? 0;
    cur.min += w.duration;
    cur.n += 1;
    week[w.type] = cur;
    byWeek.set(key, week);
  }

  if (byWeek.size === 0) return '_Rien a totaliser._';

  const rows = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, sports]) => {
      const parts = Object.entries(sports).map(([sport, v]) => {
        const km = v.km > 0 ? `${round(v.km)} km ` : '';
        return `${sport} ${v.n}x ${km}${formatDuration(v.min)}`;
      });
      return `| Semaine du ${key} | ${parts.join(' · ')} |`;
    });

  return ['| Semaine | Volume realise |', '|---|---|', ...rows].join('\n');
}

function renderPlanWeek(weekNumber: number, overrides: WeekPlanOverrides): string {
  const week = TRAINING_PLAN[weekNumber - 1];
  if (!week) return '';

  const days = applyWeekOverrides(week.days, overrides);
  const targets = targetsFromDays(days);

  const lines: string[] = [
    `### Semaine ${week.weekNumber} — ${week.phaseLabel} (${dayKey(week.startDate)} → ${dayKey(week.endDate)})`,
    `Focus : ${week.focus}`,
    `Cibles : nat ${targets.swim.target} km · velo ${targets.bike.target} km · course ${targets.run.target} km · force ${targets.strength.target} seances`,
    '',
    '| Jour | ID seance | Titre | Cible | Zone FC | Etat |',
    '|---|---|---|---|---|---|',
  ];

  for (const day of days) {
    for (const s of day.sessions) {
      const edit = overrides.edits[s.id];
      const state = [
        edit?.skipped ? 'SAUTEE' : null,
        edit?.replacedBy ? `remplacee par ${edit.replacedBy}` : null,
        overrides.moves[s.id] !== undefined ? 'deplacee' : null,
        overrides.extras[s.id] ? 'ajoutee a la main' : null,
      ]
        .filter(Boolean)
        .join(', ');
      const km = s.targetDistanceKm > 0 ? `${round(s.targetDistanceKm, 2)} km · ` : '';
      const zone = `${s.targetZone} ${s.targetBpmMin}-${s.targetBpmMax} bpm`;
      lines.push(
        `| ${DAY_NAMES[day.dayIndex]} (${day.dayIndex}) | \`${s.id}\` | ${s.title} | ${km}${formatDuration(
          s.targetDurationMin,
        )} | ${zone} | ${state || 'au plan'} |`,
      );
    }
  }

  return lines.join('\n');
}

function renderWeights(weights: WeightPoint[]): string {
  if (weights.length === 0) return '_Aucune pesee sur la periode._';
  const first = weights[0];
  const last = weights[weights.length - 1];
  const delta = round(last.lbs - first.lbs);
  const step = Math.max(1, Math.ceil(weights.length / 15));
  const sample = weights.filter((_, i) => i % step === 0 || i === weights.length - 1);
  return [
    `Objectif : ${WEIGHT_GOAL_LBS} lbs. Derniere pesee : ${round(last.lbs)} lbs le ${dayKey(last.date)}.`,
    `Variation sur la periode : ${delta > 0 ? '+' : ''}${delta} lbs. Reste ${round(
      last.lbs - WEIGHT_GOAL_LBS,
    )} lbs.`,
    '',
    sample.map((w) => `${dayKey(w.date)}: ${round(w.lbs)}`).join(' · '),
  ].join('\n');
}

function renderNutrition(days: NutritionDay[]): string {
  if (days.length === 0) return '_Aucun repas logge sur la periode._';
  const avg = days.reduce(
    (a, d) => ({
      kcal: a.kcal + d.kcal / days.length,
      proteinG: a.proteinG + d.proteinG / days.length,
      carbsG: a.carbsG + d.carbsG / days.length,
      fatG: a.fatG + d.fatG / days.length,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return [
    `Cibles : ${NUTRITION_TARGETS.kcal} kcal · ${NUTRITION_TARGETS.proteinG} g prot · ${NUTRITION_TARGETS.carbsG} g gluc · ${NUTRITION_TARGETS.fatG} g lip.`,
    `Moyenne sur ${days.length} jours logges : ${Math.round(avg.kcal)} kcal · ${Math.round(
      avg.proteinG,
    )} g prot · ${Math.round(avg.carbsG)} g gluc · ${Math.round(avg.fatG)} g lip.`,
    '',
    days.map((d) => `${d.key}: ${Math.round(d.kcal)} kcal / ${Math.round(d.proteinG)}g P`).join(' · '),
  ].join('\n');
}

function renderVaping(days: { key: string; count: number }[]): string {
  if (days.length === 0) return '_Aucun releve de puffs sur la periode._';
  const total = days.reduce((a, d) => a + d.count, 0);
  return [
    `Moyenne : ${round(total / days.length)} puffs/jour sur ${days.length} jours logges.`,
    days.map((d) => `${d.key}: ${d.count}`).join(' · '),
  ].join('\n');
}

function renderRecovery(days: RecoveryDay[]): string {
  if (days.length === 0) return '_Aucune metrique de recuperation._';
  return days
    .map((d) =>
      [
        d.key,
        d.restingHr ? `FCrepos ${d.restingHr}` : null,
        d.sleepMinutes ? `sommeil ${formatDuration(d.sleepMinutes)}` : null,
        d.steps ? `${d.steps} pas` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    )
    .join('\n');
}

// --- Assemblage ------------------------------------------------------------

export async function buildCoachContext(uid: string): Promise<CoachContext> {
  const now = new Date();
  const progress = planProgress(now);
  const weekNumber = progress.weekNumber;

  const weeks: number[] = [];
  for (let w = weekNumber - WEEK_RADIUS; w <= weekNumber + WEEK_RADIUS; w++) {
    if (w >= 1 && w <= TOTAL_WEEKS) weeks.push(w);
  }

  const [workouts, overridesByWeek, weights, nutrition, vaping, recovery] = await Promise.all([
    readWorkouts(uid),
    readOverrides(uid, weeks),
    readWeights(uid),
    readNutrition(uid),
    readVaping(uid),
    INCLUDE_RECOVERY ? readRecovery(uid) : Promise.resolve([] as RecoveryDay[]),
  ]);

  const zones = Object.entries(HR_ZONES)
    .map(([k, z]) => `${k} ${z.min}-${z.max}`)
    .join(' · ');

  const sections = [
    `# Donnees de David — instantane du ${dayKey(now)}`,
    '',
    '## Profil et course cible',
    `- ${ATHLETE_PROFILE.name}, ${ATHLETE_PROFILE.heightCm} cm, FC max ${ATHLETE_PROFILE.fcMax} bpm.`,
    `- Course : ${RACE.name}, le ${dayKey(RACE.date)} — ${RACE.swimKm} km nat / ${RACE.bikeKm} km velo / ${RACE.runKm} km course.`,
    `- Dans ${progress.daysUntilRace} jours. Semaine ${progress.weekNumber}/${progress.totalWeeks} du plan (${progress.pct} %), phase ${progress.phaseLabel}.`,
    `- Focus de la phase : ${progress.focus}`,
    `- Zones FC : ${zones}`,
    '',
    `## Plan des semaines ${weeks[0]} a ${weeks[weeks.length - 1]} (personnalisations comprises)`,
    weeks.map((w) => renderPlanWeek(w, overridesByWeek[w])).join('\n\n'),
    '',
    `## Entrainements logges (${WORKOUT_WINDOW_DAYS} derniers jours)`,
    renderWorkouts(workouts),
    '',
    '## Volume hebdomadaire realise',
    renderWeeklyTotals(workouts),
    '',
    `## Poids (${WEIGHT_WINDOW_DAYS} derniers jours)`,
    renderWeights(weights),
    '',
    `## Nutrition (${NUTRITION_WINDOW_DAYS} derniers jours)`,
    renderNutrition(nutrition),
    '',
    `## Vapotage (${VAPING_WINDOW_DAYS} derniers jours)`,
    renderVaping(vaping),
  ];

  if (INCLUDE_RECOVERY) {
    sections.push('', `## Recuperation (${RECOVERY_WINDOW_DAYS} derniers jours)`, renderRecovery(recovery));
  }

  return { markdown: sections.join('\n'), weekNumber, overridesByWeek };
}
