import { Discipline } from '../types';

/** 95 → "1h35", 45 → "45min". */
export function formatDuration(minutes: number | undefined | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '—';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

/** 6.1667 min → "6:10". */
function minPerUnit(minutes: number): string {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  // 5:60 n'existe pas — on reporte sur la minute.
  return secs === 60 ? `${mins + 1}:00` : `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * L'allure telle qu'on la lit dans chaque sport : min/100m en natation,
 * km/h à vélo, min/km à pied. Renvoie `null` s'il manque distance ou durée.
 */
export function formatPace(
  discipline: Discipline,
  distanceKm: number | undefined | null,
  durationMin: number | undefined | null,
): string | null {
  if (!distanceKm || !durationMin || distanceKm <= 0 || durationMin <= 0) return null;

  if (discipline === 'swim') return `${minPerUnit(durationMin / (distanceKm * 10))}/100m`;
  if (discipline === 'bike') return `${(distanceKm / (durationMin / 60)).toFixed(1)} km/h`;
  return `${minPerUnit(durationMin / distanceKm)}/km`;
}

/** Libellé de l'allure selon le sport, pour les en-têtes de colonne. */
export function paceLabel(discipline: Discipline): string {
  if (discipline === 'swim') return 'Allure /100m';
  if (discipline === 'bike') return 'Vitesse moy';
  return 'Allure /km';
}

/**
 * Résumé court d'une séance : « 2.5 km · 45min · 6:10/km ».
 * La muscu n'a pas de distance : on ne montre que la durée (et le volume s'il existe).
 */
export function summarizeEffort(
  discipline: Discipline,
  distanceKm: number | undefined | null,
  durationMin: number | undefined | null,
  extra?: string | null,
): string {
  const parts: string[] = [];
  if (distanceKm && distanceKm > 0) parts.push(`${distanceKm.toFixed(2).replace(/\.?0+$/, '')} km`);
  if (durationMin && durationMin > 0) parts.push(formatDuration(durationMin));
  const pace = formatPace(discipline, distanceKm, durationMin);
  if (pace) parts.push(pace);
  if (extra) parts.push(extra);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** "+0.75 km", "-4 min" — avec le signe, pour comparer réel vs plan. */
export function formatDelta(delta: number, unit: string, decimals = 0): string {
  const rounded = Number(delta.toFixed(decimals));
  if (rounded === 0) return `= ${unit}`;
  return `${rounded > 0 ? '+' : ''}${rounded} ${unit}`;
}
