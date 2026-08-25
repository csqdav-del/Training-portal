import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Discipline } from '../types';
import { ExtraSession, SessionEdit, WeekPlanOverrides, parseOverrides } from './planOverrides';

/**
 * Couche d'écriture des personnalisations du plan (Firestore client).
 * Les types et la composition pure vivent dans ./planOverrides — ré-exportés ici
 * pour que les appelants historiques (Calendar, Dashboard, SessionEditor)
 * continuent d'importer depuis un seul endroit.
 */
export type { SessionEdit, ExtraSession, WeekPlanOverrides, WeekOverrides } from './planOverrides';
export {
  EMPTY_OVERRIDES,
  applySessionEdit,
  applyWeekOverrides,
  extraToSession,
  parseOverrides,
} from './planOverrides';

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
