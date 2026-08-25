import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WeightEntry } from '../types';

export function subscribeToWeights(uid: string, callback: (entries: WeightEntry[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'weights'), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: uid,
          date: new Date(data.date),
          weight: data.weight ?? 0,
          notes: data.notes ?? undefined,
          bodyFatPct: data.bodyFatPct ?? undefined,
          source: data.source ?? 'manual',
        };
      }),
    );
  });
}

export async function addWeightEntry(uid: string, weight: number, date: Date, notes?: string) {
  // Un seul relevé par jour : l'id est la date, donc une nouvelle saisie écrase la précédente.
  const id = date.toISOString().slice(0, 10);
  await setDoc(doc(db, 'users', uid, 'weights', id), {
    id,
    userId: uid,
    date: date.toISOString(),
    weight,
    notes: notes ?? null,
  });
}

export async function deleteWeightEntry(uid: string, entryId: string) {
  await deleteDoc(doc(db, 'users', uid, 'weights', entryId));
}
