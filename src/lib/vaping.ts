import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_PLAN, VapingPlan } from './vapingPuffs';

function vapingRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'vaping');
}

/**
 * Date d'arrêt de la vapoteuse, persistée sur le compte.
 * Renvoie `null` tant que l'utilisateur n'a pas saisi sa date — on ne l'invente pas,
 * sinon le compteur repart à zéro à la première ouverture.
 */
export function subscribeToVaping(uid: string, callback: (startDate: Date | null) => void): () => void {
  return onSnapshot(vapingRef(uid), (snap) => {
    const stored = snap.data()?.startDate;
    callback(stored ? new Date(stored) : null);
  });
}

export async function setVapingStart(uid: string, startDate: Date) {
  await setDoc(vapingRef(uid), { startDate: startDate.toISOString(), updatedAt: Date.now() }, { merge: true });
}

/** Rechute : le compteur repart de maintenant. */
export async function resetVapingStreak(uid: string) {
  await setVapingStart(uid, new Date());
}

/**
 * Plan de réduction progressive (baseline + durée), rangé dans le même doc de
 * settings que la date d'arrêt : c'est la même préférence côté utilisateur.
 */
export function subscribeToVapingPlan(uid: string, callback: (plan: VapingPlan) => void): () => void {
  return onSnapshot(vapingRef(uid), (snap) => {
    const data = snap.data();
    const baseline = Number(data?.baseline);
    const targetDays = Number(data?.targetDays);
    callback({
      baseline: Number.isFinite(baseline) && baseline > 0 ? Math.round(baseline) : null,
      targetDays: Number.isFinite(targetDays) && targetDays > 0 ? Math.round(targetDays) : DEFAULT_PLAN.targetDays,
      planStart: typeof data?.planStart === 'string' ? data.planStart : null,
    });
  });
}

export async function saveVapingPlan(uid: string, plan: Partial<VapingPlan>) {
  await setDoc(vapingRef(uid), { ...plan, updatedAt: Date.now() }, { merge: true });
}
