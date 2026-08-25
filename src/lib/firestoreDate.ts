/**
 * Les dates ont été écrites de plusieurs façons au fil du temps : chaîne ISO
 * (saisie manuelle et fonctions serverless), Timestamp Firestore (anciens
 * documents), ou millisecondes. Une lecture naïve (`new Date(data.date)`) rend
 * une date invalide pour les deux derniers cas — l'entrée est alors mal triée et
 * disparaît en pratique de l'écran. On normalise donc ici, une fois pour toutes.
 */
export function parseFirestoreDate(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'number') {
    // Une valeur en secondes (Timestamp brut) est ~1000x trop petite pour être des ms.
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'object') {
    const obj = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof obj.toDate === 'function') {
      const d = obj.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const seconds = obj.seconds ?? obj._seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }

  return null;
}

/** Comme `parseFirestoreDate`, mais garantit une date (repli sur `fallback`). */
export function parseFirestoreDateOr(value: unknown, fallback: Date): Date {
  return parseFirestoreDate(value) ?? fallback;
}
