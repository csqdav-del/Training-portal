import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
