import { PlanDiscipline } from '../types';
import { WeatherDay, WeatherHour, describeCode, isSevereCode } from './weather';

/**
 * Juge si une fenêtre météo est propice à une séance extérieure.
 *
 * Volontairement pur — aucun import React ni Firebase, comme planOverrides.ts —
 * pour que la fonction Netlify du coach puisse réutiliser exactement les mêmes
 * verdicts que l'interface.
 *
 * Rien ici ne modifie le plan : le module produit un avis affiché, David décide.
 */

export type Suitability = 'good' | 'marginal' | 'bad';

export interface SuitabilityVerdict {
  level: Suitability;
  label: string;
  /** Le détail chiffré du verdict : « Rafales 38 km/h », « Pluie 6 mm ». */
  reasons: string[];
  /** Meilleur créneau trouvé dans la journée, si l'évaluation portait sur des heures. */
  window?: { start: Date; end: Date };
  /**
   * Vrai quand le verdict ne vaut que pour ce créneau : ailleurs dans la journée,
   * les conditions sont franchement moins bonnes. Sans ce drapeau, un après-midi
   * d'orage passerait pour « propice » sur la foi d'une matinée dégagée.
   */
  limitedWindow?: boolean;
}

export interface DisciplineThresholds {
  feelsLikeMinBad: number;
  feelsLikeMinMarginal: number;
  feelsLikeMaxMarginal: number;
  feelsLikeMaxBad: number;
  precipMmBad: number;
  precipMmMarginal: number;
  precipProbBad: number;
  precipProbMarginal: number;
  gustBad: number;
  gustMarginal: number;
}

/**
 * Seuils calibrés pour Québec. Le vélo est bien plus sensible que la course :
 * le refroidissement éolien à 30 km/h, la chaussée mouillée et les rafales de
 * travers rendent une sortie désagréable ou risquée bien avant qu'une course le
 * devienne. À réajuster après un hiver d'usage réel.
 */
export const THRESHOLDS: Record<'bike' | 'run', DisciplineThresholds> = {
  bike: {
    feelsLikeMinBad: 0,
    feelsLikeMinMarginal: 7,
    feelsLikeMaxMarginal: 30,
    feelsLikeMaxBad: 35,
    precipMmBad: 3,
    precipMmMarginal: 0.5,
    precipProbBad: 70,
    precipProbMarginal: 40,
    gustBad: 45,
    gustMarginal: 30,
  },
  run: {
    feelsLikeMinBad: -20,
    feelsLikeMinMarginal: -10,
    feelsLikeMaxMarginal: 25,
    feelsLikeMaxBad: 30,
    precipMmBad: 8,
    precipMmMarginal: 2,
    precipProbBad: 90,
    precipProbMarginal: 60,
    gustBad: 55,
    gustMarginal: 35,
  },
};

/** Fenêtre par défaut d'une journée d'entraînement : le plan ne porte pas d'heure. */
export const DAY_WINDOW = { startHour: 7, endHour: 20 };

export const SUITABILITY_LABELS: Record<Suitability, string> = {
  good: 'Propice',
  marginal: 'Limite',
  bad: 'Non propice',
};

/**
 * Classes Tailwind du thème existant, pour que les trois états se lisent partout
 * pareil. Tout est écrit en toutes lettres, jamais assemblé à l'exécution :
 * Tailwind ne génère que les classes qu'il trouve littéralement dans le source.
 */
export const SUITABILITY_STYLES: Record<
  Suitability,
  { text: string; bg: string; border: string; dot: string; icon: string }
> = {
  good: {
    text: 'text-sport-bike',
    bg: 'bg-sport-bike/10',
    border: 'border-sport-bike/40',
    dot: 'bg-sport-bike',
    icon: '✅',
  },
  marginal: {
    text: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/40',
    dot: 'bg-amber-400',
    icon: '⚠️',
  },
  bad: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/40', dot: 'bg-red-400', icon: '⛔' },
};

/**
 * Natation en piscine et musculation en salle : la météo ne les concerne pas.
 * L'information est dérivée plutôt que stockée, ce qui évite d'ajouter un champ
 * `indoor` à PlannedSession et de toucher au modèle de données.
 */
export function isOutdoorDiscipline(discipline: PlanDiscipline): boolean {
  return discipline === 'bike' || discipline === 'run';
}

function worst(a: Suitability, b: Suitability): Suitability {
  if (a === 'bad' || b === 'bad') return 'bad';
  if (a === 'marginal' || b === 'marginal') return 'marginal';
  return 'good';
}

const round = (n: number, d = 0): number => Number(n.toFixed(d));

/** Agrégat d'un bloc d'heures : on juge sur le pire moment, pas sur la moyenne. */
interface Aggregate {
  feelsLikeMin: number;
  feelsLikeMax: number;
  precipMm: number;
  precipProb: number;
  gustKmh: number;
  severe: boolean;
  worstCode: number;
}

function aggregate(hours: WeatherHour[]): Aggregate {
  return hours.reduce<Aggregate>(
    (acc, h) => ({
      feelsLikeMin: Math.min(acc.feelsLikeMin, h.feelsLikeC),
      feelsLikeMax: Math.max(acc.feelsLikeMax, h.feelsLikeC),
      precipMm: acc.precipMm + h.precipMm,
      precipProb: Math.max(acc.precipProb, h.precipProb),
      gustKmh: Math.max(acc.gustKmh, h.gustKmh),
      severe: acc.severe || isSevereCode(h.code),
      worstCode: isSevereCode(h.code) && !isSevereCode(acc.worstCode) ? h.code : acc.worstCode,
    }),
    {
      feelsLikeMin: Infinity,
      feelsLikeMax: -Infinity,
      precipMm: 0,
      precipProb: 0,
      gustKmh: 0,
      severe: false,
      worstCode: hours[0]?.code ?? 0,
    },
  );
}

function judge(discipline: 'bike' | 'run', agg: Aggregate): SuitabilityVerdict {
  const t = THRESHOLDS[discipline];
  let level: Suitability = 'good';
  const reasons: string[] = [];

  if (agg.severe) {
    level = 'bad';
    reasons.push(describeCode(agg.worstCode).label);
  }

  if (agg.feelsLikeMin <= t.feelsLikeMinBad) {
    level = worst(level, 'bad');
    reasons.push('Ressenti ' + round(agg.feelsLikeMin) + ' °C');
  } else if (agg.feelsLikeMin <= t.feelsLikeMinMarginal) {
    level = worst(level, 'marginal');
    reasons.push('Ressenti ' + round(agg.feelsLikeMin) + ' °C');
  }

  if (agg.feelsLikeMax >= t.feelsLikeMaxBad) {
    level = worst(level, 'bad');
    reasons.push('Ressenti ' + round(agg.feelsLikeMax) + ' °C');
  } else if (agg.feelsLikeMax >= t.feelsLikeMaxMarginal) {
    level = worst(level, 'marginal');
    reasons.push('Ressenti ' + round(agg.feelsLikeMax) + ' °C');
  }

  if (agg.precipMm >= t.precipMmBad) {
    level = worst(level, 'bad');
    reasons.push('Pluie ' + round(agg.precipMm, 1) + ' mm');
  } else if (agg.precipMm >= t.precipMmMarginal) {
    level = worst(level, 'marginal');
    reasons.push('Pluie ' + round(agg.precipMm, 1) + ' mm');
  } else if (agg.precipProb >= t.precipProbBad) {
    level = worst(level, 'bad');
    reasons.push('Précipitations ' + round(agg.precipProb) + ' %');
  } else if (agg.precipProb >= t.precipProbMarginal) {
    level = worst(level, 'marginal');
    reasons.push('Précipitations ' + round(agg.precipProb) + ' %');
  }

  if (agg.gustKmh >= t.gustBad) {
    level = worst(level, 'bad');
    reasons.push('Rafales ' + round(agg.gustKmh) + ' km/h');
  } else if (agg.gustKmh >= t.gustMarginal) {
    level = worst(level, 'marginal');
    reasons.push('Rafales ' + round(agg.gustKmh) + ' km/h');
  }

  if (reasons.length === 0) {
    reasons.push(
      round(agg.feelsLikeMin) + '–' + round(agg.feelsLikeMax) + ' °C ressenti · vent ' + round(agg.gustKmh) + ' km/h',
    );
  }

  return { level, label: SUITABILITY_LABELS[level], reasons };
}

const SCORE: Record<Suitability, number> = { good: 0, marginal: 1, bad: 2 };

/** Sévérité continue, pour départager deux créneaux de même niveau. */
function penalty(discipline: 'bike' | 'run', agg: Aggregate): number {
  const t = THRESHOLDS[discipline];
  return (
    (agg.severe ? 100 : 0) +
    Math.max(0, t.feelsLikeMinMarginal - agg.feelsLikeMin) +
    Math.max(0, agg.feelsLikeMax - t.feelsLikeMaxMarginal) +
    agg.precipMm * 5 +
    agg.precipProb / 10 +
    Math.max(0, agg.gustKmh - t.gustMarginal)
  );
}

/** Verdict sur un bloc d'heures déjà choisi (utile pour « en ce moment »). */
export function rateWindow(discipline: PlanDiscipline, hours: WeatherHour[]): SuitabilityVerdict | null {
  if (!isOutdoorDiscipline(discipline) || hours.length === 0) return null;
  return judge(discipline as 'bike' | 'run', aggregate(hours));
}

/**
 * Cherche le meilleur bloc contigu de `durationMin` entre 7 h et 20 h et rend son
 * verdict. C'est ce qui rend l'avertissement actionnable : « Limite, meilleure
 * fenêtre 13 h–15 h » vaut mieux qu'un jugement sur la journée entière, où une
 * averse matinale condamnerait un après-midi parfait.
 */
export function rateSession(
  discipline: PlanDiscipline,
  day: WeatherDay | undefined,
  durationMin: number,
): SuitabilityVerdict | null {
  if (!isOutdoorDiscipline(discipline) || !day) return null;

  const daylight = day.hours.filter((h) => {
    const hour = h.time.getHours();
    return hour >= DAY_WINDOW.startHour && hour < DAY_WINDOW.endHour;
  });
  if (daylight.length === 0) return null;

  const span = Math.max(1, Math.min(Math.ceil((durationMin || 60) / 60), daylight.length));
  const d = discipline as 'bike' | 'run';

  let best: { verdict: SuitabilityVerdict; score: number } | null = null;
  let worstLevel: Suitability = 'good';

  for (let i = 0; i + span <= daylight.length; i++) {
    const block = daylight.slice(i, i + span);
    const agg = aggregate(block);
    const verdict = judge(d, agg);
    worstLevel = worst(worstLevel, verdict.level);
    const score = SCORE[verdict.level] * 1000 + penalty(d, agg);
    if (!best || score < best.score) {
      const start = block[0].time;
      const end = new Date(block[block.length - 1].time.getTime() + 3600000);
      best = { verdict: { ...verdict, window: { start, end } }, score };
    }
  }

  if (!best) return null;

  // Le reste de la journée est nettement pire : le verdict tient au créneau seul.
  const limitedWindow = SCORE[worstLevel] > SCORE[best.verdict.level];
  return { ...best.verdict, limitedWindow };
}

/** Durée de séance supposée quand on juge une journée sans séance précise. */
export const TYPICAL_SESSION_MIN = 90;

/**
 * Verdict d'une journée, sans séance précise en tête.
 *
 * Délègue à `rateSession` avec une durée typique plutôt que de juger les 13 h
 * d'un coup : les seuils sont exprimés en mm de pluie cumulés, donc les appliquer
 * à une journée entière la condamnerait dès la moindre averse, et le coach
 * contredirait le badge affiché sur la même séance dans l'interface.
 */
export function rateDay(discipline: PlanDiscipline, day: WeatherDay | undefined): SuitabilityVerdict | null {
  return rateSession(discipline, day, TYPICAL_SESSION_MIN);
}

/** « 13 h à 15 h » */
export function formatWindow(window: { start: Date; end: Date } | undefined): string | null {
  if (!window) return null;
  return window.start.getHours() + ' h à ' + window.end.getHours() + ' h';
}
