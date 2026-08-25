import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DayPlan, Discipline, PlanDiscipline, PlannedSession, ZoneKey } from '../types';
import { HR_ZONES } from '../data/trainingPlan';

/** Modifications persistées d'une séance du plan (les champs absents gardent la valeur du plan). */
export interface SessionEdit {
  title?: string;
  targetZone?: ZoneKey;
  targetDistanceKm?: number;
  targetDurationMin?: number;
  notes?: string;
  skipped?: boolean;
  /**
   * Discipline réellement pratiquée à la place de celle du plan (piscine fermée,
   * blessure...). La séance reste visible au calendrier, barrée, avec l'icône du
   * sport de remplacement — contrairement à `skipped` qui la fait disparaître.
   */
  replacedBy?: Discipline;
}

/** Séance ajoutée manuellement, qui n'existe pas dans le plan de base. */
export interface ExtraSession {
  id: string;
  dayIndex: number;
  discipline: PlanDiscipline;
  title: string;
  targetZone: ZoneKey;
  targetDistanceKm: number;
  targetDurationMin: number;
  notes?: string;
}

export interface WeekPlanOverrides {
  moves: Record<string, number>; // sessionId -> dayIndex (0-6)
  edits: Record<string, SessionEdit>;
  extras: Record<string, ExtraSession>;
}

/** @deprecated conservé pour compatibilité — utilise WeekPlanOverrides['moves']. */
export type WeekOverrides = Record<string, number>;

export const EMPTY_OVERRIDES: WeekPlanOverrides = { moves: {}, edits: {}, extras: {} };

/**
 * Les premiers documents ne stockaient que des paires `sessionId: dayIndex` à plat.
 * On les relit comme des `moves` pour ne perdre aucun déplacement déjà enregistré.
 */
function parseOverrides(data: Record<string, unknown> | undefined): WeekPlanOverrides {
  if (!data) return EMPTY_OVERRIDES;

  const legacyMoves: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number' && key !== 'updatedAt') legacyMoves[key] = value;
  }

  return {
    moves: { ...legacyMoves, ...((data.moves as Record<string, number>) ?? {}) },
    edits: (data.edits as Record<string, SessionEdit>) ?? {},
    extras: (data.extras as Record<string, ExtraSession>) ?? {},
  };
}

function weekRef(uid: string, weekNumber: number) {
  return doc(db, 'users', uid, 'scheduleOverrides', String(weekNumber));
}

export function subscribeToWeekOverrides(
  uid: string,
  weekNumber: number,
  callback: (overrides: WeekPlanOverrides) => void,
): () => void {
  return onSnapshot(weekRef(uid, weekNumber), (snap) => {
    callback(parseOverrides(snap.data() as Record<string, unknown> | undefined));
  });
}

export async function moveSession(uid: string, weekNumber: number, sessionId: string, dayIndex: number) {
  await setDoc(
    weekRef(uid, weekNumber),
    { moves: { [sessionId]: dayIndex }, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function updateSession(uid: string, weekNumber: number, sessionId: string, edit: SessionEdit) {
  // On retire les champs vides pour qu'ils retombent sur la valeur du plan.
  const clean = Object.fromEntries(
    Object.entries(edit).filter(([, v]) => v !== undefined && v !== '' && !Number.isNaN(v as number)),
  );
  await setDoc(weekRef(uid, weekNumber), { edits: { [sessionId]: clean }, updatedAt: Date.now() }, { merge: true });
}

export async function setSessionSkipped(uid: string, weekNumber: number, sessionId: string, skipped: boolean) {
  await setDoc(
    weekRef(uid, weekNumber),
    { edits: { [sessionId]: { skipped } }, updatedAt: Date.now() },
    { merge: true },
  );
}

/**
 * Note qu'une séance planifiée a été troquée contre un autre sport. Appelé quand
 * David logge une activité en cochant « remplace la séance du jour ».
 */
export async function setSessionReplaced(
  uid: string,
  weekNumber: number,
  sessionId: string,
  replacedBy: Discipline | null,
) {
  await setDoc(
    weekRef(uid, weekNumber),
    {
      edits: { [sessionId]: { replacedBy: replacedBy ?? deleteField() } },
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function resetSession(uid: string, weekNumber: number, sessionId: string) {
  await setDoc(
    weekRef(uid, weekNumber),
    { edits: { [sessionId]: deleteField() }, moves: { [sessionId]: deleteField() }, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function addExtraSession(
  uid: string,
  weekNumber: number,
  session: Omit<ExtraSession, 'id'>,
): Promise<string> {
  const id = `extra-${weekNumber}-${Date.now()}`;
  await setDoc(
    weekRef(uid, weekNumber),
    { extras: { [id]: { ...session, id } }, updatedAt: Date.now() },
    { merge: true },
  );
  return id;
}

export async function removeExtraSession(uid: string, weekNumber: number, extraId: string) {
  await setDoc(
    weekRef(uid, weekNumber),
    { extras: { [extraId]: deleteField() }, updatedAt: Date.now() },
    { merge: true },
  );
}

/** Efface toutes les personnalisations de la semaine (retour au plan d'origine). */
export async function resetWeekOverrides(uid: string, weekNumber: number) {
  await setDoc(weekRef(uid, weekNumber), { moves: {}, edits: {}, extras: {}, updatedAt: Date.now() });
}

/** Applique un SessionEdit à une séance du plan (recalcule les BPM si la zone change). */
export function applySessionEdit(session: PlannedSession, edit: SessionEdit | undefined): PlannedSession {
  if (!edit) return session;
  const zone = edit.targetZone ?? session.targetZone;
  const z = HR_ZONES[zone];
  return {
    ...session,
    title: edit.title ?? session.title,
    targetZone: zone,
    targetBpmMin: z.min,
    targetBpmMax: z.max,
    targetDistanceKm: edit.targetDistanceKm ?? session.targetDistanceKm,
    targetDurationMin: edit.targetDurationMin ?? session.targetDurationMin,
    structure: edit.notes ? [...session.structure, edit.notes] : session.structure,
  };
}

/**
 * Reconstruit les 7 jours affichés à partir du plan de base + des personnalisations
 * persistées : déplacements, cibles modifiées, séances ajoutées.
 * Utilisé par le calendrier ET le tableau de bord pour qu'ils montrent la même chose.
 */
export function applyWeekOverrides(days: DayPlan[], overrides: WeekPlanOverrides): DayPlan[] {
  const bucket: PlannedSession[][] = [[], [], [], [], [], [], []];

  for (const day of days) {
    for (const session of day.sessions) {
      const target = overrides.moves[session.id] ?? day.dayIndex;
      const safeTarget = target >= 0 && target <= 6 ? target : day.dayIndex;
      bucket[safeTarget].push(applySessionEdit(session, overrides.edits[session.id]));
    }
  }

  for (const extra of Object.values(overrides.extras)) {
    const target = overrides.moves[extra.id] ?? extra.dayIndex;
    const safeTarget = target >= 0 && target <= 6 ? target : extra.dayIndex;
    bucket[safeTarget].push(extraToSession(extra));
  }

  return days.map((day) => ({ ...day, sessions: bucket[day.dayIndex] }));
}

/** Convertit une séance ajoutée à la main en PlannedSession utilisable par l'UI. */
export function extraToSession(extra: ExtraSession): PlannedSession {
  const z = HR_ZONES[extra.targetZone];
  return {
    id: extra.id,
    discipline: extra.discipline,
    title: extra.title,
    structure: extra.notes ? [extra.notes] : ['Séance ajoutée manuellement'],
    targetZone: extra.targetZone,
    targetBpmMin: z.min,
    targetBpmMax: z.max,
    targetDistanceKm: extra.targetDistanceKm,
    targetDurationMin: extra.targetDurationMin,
  };
}
