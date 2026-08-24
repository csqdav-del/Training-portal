import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function vapingRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'vaping');
}

/**
 * Date d'arrêt de la vapoteuse, persistée sur le compte.
 * Si aucune date n'existe encore, on en crée une à la première ouverture.
 */
export function subscribeToVaping(uid: string, callback: (startDate: Date) => void): () => void {
  return onSnapshot(vapingRef(uid), (snap) => {
    const stored = snap.data()?.startDate;
    if (stored) {
      callback(new Date(stored));
      return;
    }
    const now = new Date();
    setDoc(vapingRef(uid), { startDate: now.toISOString() }, { merge: true }).catch(() => {});
    callback(now);
  });
}

export async function resetVapingStreak(uid: string, startDate: Date = new Date()) {
  await setDoc(vapingRef(uid), { startDate: startDate.toISOString() }, { merge: true });
}
