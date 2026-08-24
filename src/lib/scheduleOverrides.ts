import { deleteField, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type WeekOverrides = Record<string, number>; // sessionId -> dayIndex (0-6)

export function subscribeToWeekOverrides(
  uid: string,
  weekNumber: number,
  callback: (overrides: WeekOverrides) => void,
): () => void {
  const ref = doc(db, 'users', uid, 'scheduleOverrides', String(weekNumber));
  return onSnapshot(ref, (snap) => {
    callback((snap.data() as WeekOverrides | undefined) ?? {});
  });
}

export async function moveSession(uid: string, weekNumber: number, sessionId: string, dayIndex: number) {
  const ref = doc(db, 'users', uid, 'scheduleOverrides', String(weekNumber));
  await setDoc(ref, { [sessionId]: dayIndex }, { merge: true });
}

export async function resetWeekOverrides(uid: string, weekNumber: number, sessionIds: string[]) {
  const ref = doc(db, 'users', uid, 'scheduleOverrides', String(weekNumber));
  const clearFields = Object.fromEntries(sessionIds.map((id) => [id, deleteField()]));
  await setDoc(ref, clearFields, { merge: true });
}
