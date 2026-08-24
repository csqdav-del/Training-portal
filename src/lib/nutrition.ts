import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FoodSearchResult, MealEntry } from '../types';

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10); // yyyy-mm-dd
}

export function subscribeToNutritionLog(
  uid: string,
  date: Date,
  callback: (entries: MealEntry[]) => void,
): () => void {
  const ref = doc(db, 'users', uid, 'nutritionLogs', dateKey(date));
  return onSnapshot(ref, (snap) => {
    callback((snap.data()?.entries as MealEntry[] | undefined) ?? []);
  });
}

export async function addMealEntry(uid: string, date: Date, entries: MealEntry[], entry: MealEntry) {
  const ref = doc(db, 'users', uid, 'nutritionLogs', dateKey(date));
  await setDoc(ref, { entries: [...entries, entry] }, { merge: true });
}

export async function removeMealEntry(uid: string, date: Date, entries: MealEntry[], entryId: string) {
  const ref = doc(db, 'users', uid, 'nutritionLogs', dateKey(date));
  await setDoc(ref, { entries: entries.filter((e) => e.id !== entryId) }, { merge: true });
}

export async function searchFood(query: string): Promise<FoodSearchResult[] | { error: string }> {
  const res = await fetch(`/.netlify/functions/nutrition-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error ?? `http_${res.status}` };
  }
  const data = await res.json();
  return data.results as FoodSearchResult[];
}
