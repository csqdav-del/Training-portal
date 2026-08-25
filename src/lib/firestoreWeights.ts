import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WeightEntry } from '../types';
import { parseFirestoreDate } from './firestoreDate';

export function subscribeToWeights(uid: string, callback: (entries: WeightEntry[]) => void): () => void {
  // Pas de `orderBy` côté Firestore : la requête écarterait silencieusement tout
  // document dont le champ `date` manque ou n'a pas le même type que les autres
  // — c'est ce qui faisait « disparaître » d'anciennes pesées. On lit tout et on
  // trie ici, en se rabattant sur l'id du document (YYYY-MM-DD) si besoin.
  const ref = collection(db, 'users', uid, 'weights');
  return onSnapshot(ref, (snap) => {
    const entries = snap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const date = parseFirestoreDate(data.date) ?? parseFirestoreDate(docSnap.id);
        if (!date) return null;
        const weight = Number(data.weight);
        if (!Number.isFinite(weight) || weight <= 0) return null;
        return {
          id: docSnap.id,
          userId: uid,
          date,
          weight,
          notes: data.notes ?? undefined,
          bodyFatPct: data.bodyFatPct ?? undefined,
          source: data.source ?? 'manual',
        } as WeightEntry;
      })
      .filter((e): e is WeightEntry => e !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    callback(entries);
  });
}

/** Clé de jour en heure locale — `toISOString` décalerait les pesées du soir. */
function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function addWeightEntry(uid: string, weight: number, date: Date, notes?: string) {
  // Un seul relevé par jour : l'id est la date, donc une nouvelle saisie écrase la précédente.
  const id = dayKey(date);
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
