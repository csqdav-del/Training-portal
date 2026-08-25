import { collection, doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** Un document par jour, id = clé locale YYYY-MM-DD → le compteur « repart » seul à minuit. */
export interface PuffDay {
  date: string;
  count: number;
  /** Horodatages ISO de chaque puff, pour pouvoir annuler le dernier et voir la répartition. */
  times: string[];
}

/** Plan de sevrage, stocké dans le même doc de settings que la date d'arrêt. */
export interface VapingPlan {
  /** Puffs/jour au départ. `null` = phase de mesure, on n'a pas encore de référence. */
  baseline: number | null;
  /** Nombre de jours pour descendre de `baseline` à 0. */
  targetDays: number;
  /** Jour 1 du plan (YYYY-MM-DD local). */
  planStart: string | null;
}

export const DEFAULT_PLAN: VapingPlan = { baseline: null, targetDays: 30, planStart: null };

/** Estimation du coût d'une journée au rythme de départ — sert à chiffrer les économies. */
const COST_PER_BASELINE_DAY = 5;

/** Clé de jour en heure locale : `toISOString()` basculerait les puffs du soir au lendemain. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Nombre de jours calendaires entre deux clés (b - a). */
export function daysBetween(aKey: string, bKey: string): number {
  const ms = dayKeyToDate(bKey).getTime() - dayKeyToDate(aKey).getTime();
  return Math.round(ms / 86400000);
}

/** La clé du jour décalée de `offset` jours (négatif = dans le passé). */
export function shiftDayKey(key: string, offset: number): string {
  return dayKey(new Date(dayKeyToDate(key).getTime() + offset * 86400000));
}

function puffDayRef(uid: string, key: string) {
  return doc(db, 'users', uid, 'vapingLogs', key);
}

/**
 * Tous les jours loggés, du plus récent au plus ancien.
 * Pas de `orderBy` Firestore : un doc sans champ `date` serait écarté
 * silencieusement (même piège que pour les pesées), et l'id suffit à trier.
 */
export function subscribeToPuffDays(uid: string, callback: (days: PuffDay[]) => void): () => void {
  return onSnapshot(collection(db, 'users', uid, 'vapingLogs'), (snap) => {
    const days = snap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const count = Number(data.count);
        return {
          date: typeof data.date === 'string' ? data.date : docSnap.id,
          count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
          times: Array.isArray(data.times) ? (data.times as string[]) : [],
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    callback(days);
  });
}

/**
 * +1 puff sur la journée en cours. Transaction plutôt qu'`increment()` :
 * on veut aussi empiler l'horodatage, et deux taps rapprochés ne doivent
 * pas se perdre (ni être dédupliqués comme le ferait `arrayUnion`).
 */
export async function logPuff(uid: string, at: Date = new Date()): Promise<void> {
  const key = dayKey(at);
  const ref = puffDayRef(uid, key);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const count = Number(data?.count);
    const times = Array.isArray(data?.times) ? (data?.times as string[]) : [];
    tx.set(
      ref,
      {
        date: key,
        count: (Number.isFinite(count) ? count : 0) + 1,
        // On borne l'historique intra-journée : au-delà, seul le compte importe.
        times: [...times, at.toISOString()].slice(-500),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });
}

/** Annule le dernier puff loggé (faux tap). Ne descend jamais sous zéro. */
export async function undoLastPuff(uid: string, key: string = dayKey()): Promise<void> {
  const ref = puffDayRef(uid, key);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const count = Number(data?.count);
    const times = Array.isArray(data?.times) ? (data?.times as string[]) : [];
    tx.set(
      ref,
      {
        date: key,
        count: Math.max(0, (Number.isFinite(count) ? count : 0) - 1),
        times: times.slice(0, -1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  });
}

/**
 * Correction manuelle d'une journée (« j'ai oublié de logger ce matin »).
 * Les horodatages ne sont plus fiables après coup, on les efface.
 */
export async function setPuffCount(uid: string, key: string, count: number): Promise<void> {
  const safe = Math.max(0, Math.floor(count));
  await setDoc(puffDayRef(uid, key), { date: key, count: safe, times: [], updatedAt: Date.now() }, { merge: true });
}

/**
 * Objectif du jour : descente linéaire de `baseline` à 0 sur `targetDays`.
 * `null` tant que le plan n'a pas de référence — on ne fixe pas d'objectif au pif.
 */
export function goalForDay(plan: VapingPlan, key: string): number | null {
  if (plan.baseline == null || !plan.planStart) return null;
  const elapsed = daysBetween(plan.planStart, key);
  if (elapsed < 0) return plan.baseline; // avant le début du plan : pas encore de contrainte
  const remaining = plan.baseline * (1 - elapsed / Math.max(1, plan.targetDays));
  return Math.max(0, Math.round(remaining));
}

export interface PuffStats {
  todayCount: number;
  todayGoal: number | null;
  /** Jours complets consécutifs (hier en remontant) où l'objectif a été tenu. */
  streak: number;
  bestStreak: number;
  /** Moyenne sur les 7 derniers jours complets qui ont des données. */
  avg7: number | null;
  /** Meilleure journée complète (le moins de puffs). */
  bestDay: PuffDay | null;
  /** Puffs évités par rapport au rythme de départ, sur les jours complets. */
  puffsAvoided: number;
  moneySaved: number;
  level: number;
  xpInLevel: number;
  xpForLevel: number;
}

const XP_PER_LEVEL = 100;

export function computeStats(days: PuffDay[], plan: VapingPlan, today: string): PuffStats {
  const byKey = new Map(days.map((d) => [d.date, d]));
  const todayCount = byKey.get(today)?.count ?? 0;

  // Journées complètes uniquement : celle en cours n'est pas jugeable.
  const completed = days.filter((d) => d.date < today);

  // Série en cours : on remonte jour par jour depuis hier, un jour non loggé casse la série.
  let streak = 0;
  for (let i = 1; ; i++) {
    const key = shiftDayKey(today, -i);
    const day = byKey.get(key);
    if (!day) break;
    const goal = goalForDay(plan, key);
    if (goal == null || day.count > goal) break;
    streak++;
  }

  // Meilleure série historique : balayage chronologique des jours complets.
  let bestStreak = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const day of [...completed].reverse()) {
    if (prevKey && daysBetween(prevKey, day.date) !== 1) run = 0; // trou dans le log = série cassée
    const goal = goalForDay(plan, day.date);
    run = goal != null && day.count <= goal ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
    prevKey = day.date;
  }
  bestStreak = Math.max(bestStreak, streak);

  const last7 = completed.slice(0, 7);
  const avg7 = last7.length ? last7.reduce((s, d) => s + d.count, 0) / last7.length : null;

  const bestDay = completed.length ? completed.reduce((a, b) => (b.count < a.count ? b : a)) : null;

  const baseline = plan.baseline;
  const puffsAvoided = baseline ? completed.reduce((sum, d) => sum + Math.max(0, baseline - d.count), 0) : 0;
  const moneySaved = baseline ? (puffsAvoided / baseline) * COST_PER_BASELINE_DAY : 0;

  // L'XP récompense les puffs évités, plus un bonus par journée d'objectif tenu.
  const goalDaysHit = completed.filter((d) => {
    const goal = goalForDay(plan, d.date);
    return goal != null && d.count <= goal;
  }).length;
  const xp = puffsAvoided + goalDaysHit * 25;

  return {
    todayCount,
    todayGoal: goalForDay(plan, today),
    streak,
    bestStreak,
    avg7,
    bestDay,
    puffsAvoided,
    moneySaved,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpInLevel: xp % XP_PER_LEVEL,
    xpForLevel: XP_PER_LEVEL,
  };
}

export interface Badge {
  id: string;
  label: string;
  icon: string;
  hint: string;
  earned: boolean;
}

export function computeBadges(days: PuffDay[], plan: VapingPlan, stats: PuffStats, today: string): Badge[] {
  const completed = days.filter((d) => d.date < today);
  const zeroDays = completed.filter((d) => d.count === 0).length;
  const halved = plan.baseline != null && stats.avg7 != null && stats.avg7 <= plan.baseline / 2;

  return [
    { id: 'first-log', label: 'Premier log', icon: '📍', hint: 'Logger un premier puff', earned: days.length > 0 },
    { id: 'streak-3', label: '3 jours', icon: '🔥', hint: "3 jours d'affilée sous l'objectif", earned: stats.bestStreak >= 3 },
    { id: 'streak-7', label: 'Une semaine', icon: '⚡', hint: "7 jours d'affilée sous l'objectif", earned: stats.bestStreak >= 7 },
    { id: 'streak-30', label: 'Un mois', icon: '👑', hint: "30 jours d'affilée sous l'objectif", earned: stats.bestStreak >= 30 },
    { id: 'halved', label: 'Moitié moins', icon: '✂️', hint: 'Moyenne 7j à la moitié du départ', earned: halved },
    { id: 'zero-day', label: 'Journée blanche', icon: '🫧', hint: 'Une journée complète à 0 puff', earned: zeroDays >= 1 },
    { id: 'zero-week', label: '7 jours blancs', icon: '🏆', hint: '7 journées à 0 puff', earned: zeroDays >= 7 },
    { id: 'saved-500', label: '500 évités', icon: '🛡️', hint: '500 puffs évités au total', earned: stats.puffsAvoided >= 500 },
  ];
}
