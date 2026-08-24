import { addDays, endOfDay, startOfWeek } from 'date-fns';
import type {
  DayPlan,
  Phase,
  PlanDiscipline,
  PlannedSession,
  TrainingZones,
  WeekPlan,
  ZoneKey,
} from '../types';

// Source: OVERVIEW_TRIATHLON_2027_POUR_APP.md — profil & zones FC (FC max 185 bpm)
export const ATHLETE_PROFILE = {
  name: 'David Bibeau',
  heightCm: 188,
  fcMax: 185,
};

export const RACE = {
  name: 'Challenge Sail Québec 2027',
  date: new Date(2027, 6, 23), // 23 juillet 2027
  swimKm: 1.5,
  bikeKm: 40,
  runKm: 10,
};

export const HR_ZONES: TrainingZones = {
  z1: { min: 92, max: 111, label: 'Z1 - Récupération' },
  z2: { min: 111, max: 130, label: 'Z2 - Endurance' },
  z3: { min: 130, max: 148, label: 'Z3 - Tempo' },
  z4: { min: 148, max: 167, label: 'Z4 - Seuil' },
  z5: { min: 167, max: 192, label: 'Z5 - VO2 Max' },
};

export const RACE_TARGETS: Record<PlanDiscipline, { current: number; target: number; unit: string; paceTarget: string }> = {
  swim: { current: 1.3, target: 1.5, unit: 'km', paceTarget: '2:30-2:45/100m' },
  bike: { current: 23.7, target: 40, unit: 'km', paceTarget: '24-26 km/h' },
  run: { current: 3.22, target: 10, unit: 'km', paceTarget: '6:10/km (aspirationnel)' },
  strength: { current: 0, target: 2, unit: 'x/sem', paceTarget: '—' },
};

export const PLAN_START = startOfWeek(new Date(2026, 7, 18), { weekStartsOn: 1 }); // lundi 17 août 2026
export const TOTAL_WEEKS = 48;

export const WEIGHT_GOAL_LBS = 275; // 125 kg cible race
export const WEIGHT_START_LBS = 290; // 131.5 kg baseline août 2026

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

function blockValue(week: number, blocks: { from: number; to: number; valFrom: number; valTo: number }[]): number {
  const block = blocks.find((b) => week >= b.from && week <= b.to);
  if (!block) return 0;
  const t = block.to === block.from ? 1 : (week - block.from) / (block.to - block.from);
  return Math.round(lerp(block.valFrom, block.valTo, t) * 10) / 10;
}

function blockText<T>(week: number, blocks: { from: number; to: number; value: T }[]): T {
  const block = blocks.find((b) => week >= b.from && week <= b.to) ?? blocks[blocks.length - 1];
  return block.value;
}

function phaseOf(week: number): { phase: Phase; label: string; focus: string } {
  if (week <= 11) return { phase: 'Base', label: 'Phase 1 — Base Building', focus: 'Réveiller natation, démarrer running, maintenir vélo' };
  if (week <= 22) return { phase: 'Build', label: 'Phase 2 — Build', focus: 'Distance longue, tempo/seuil, natation vitesse' };
  if (week <= 36) return { phase: 'Peak', label: 'Phase 3 — Peak Build', focus: 'VO2max, long slow distance, race-pace' };
  return { phase: 'Taper', label: 'Phase 4 — Taper & Race', focus: 'Réduire fatigue, maintenir capacité, mental sharp' };
}

// ---- Volumes hebdo par semaine (interpolés depuis les paliers du plan) ----
const SWIM_VOL = [
  { from: 1, to: 2, valFrom: 0.6, valTo: 0.7 },
  { from: 3, to: 4, valFrom: 1.0, valTo: 1.3 },
  { from: 5, to: 8, valFrom: 1.3, valTo: 1.6 },
  { from: 9, to: 11, valFrom: 1.5, valTo: 1.7 },
  { from: 12, to: 16, valFrom: 1.6, valTo: 1.6 },
  { from: 17, to: 22, valFrom: 1.7, valTo: 1.7 },
  { from: 23, to: 30, valFrom: 1.8, valTo: 1.8 },
  { from: 31, to: 36, valFrom: 1.7, valTo: 1.7 },
  { from: 37, to: 42, valFrom: 1.6, valTo: 1.6 },
  { from: 43, to: 45, valFrom: 1.2, valTo: 1.2 },
  { from: 46, to: 47, valFrom: 0.8, valTo: 0.8 },
  { from: 48, to: 48, valFrom: 0.3, valTo: 0.3 },
];

const SWIM_FOCUS = [
  { from: 1, to: 2, value: 'Forcer respiration alternée (drill mono D/G)' },
  { from: 3, to: 4, value: 'Alternance progressive, tempo léger' },
  { from: 5, to: 8, value: 'Distance building vers 1.5km continu' },
  { from: 9, to: 11, value: 'Intensité & race-pace (2:35-2:40/100m)' },
  { from: 12, to: 16, value: 'Race-pace intervals + distance continue' },
  { from: 17, to: 22, value: 'Seuil + variété distance/intensité' },
  { from: 23, to: 30, value: 'Vitesse + maintien race-pace fluide' },
  { from: 31, to: 36, value: 'Maintenance, race-pace établi' },
  { from: 37, to: 42, value: 'Taper — maintenance facile' },
  { from: 43, to: 45, value: 'Mini-taper, très facile' },
  { from: 46, to: 47, value: 'Pre-race taper' },
  { from: 48, to: 48, value: 'Race week — activation légère' },
];

const RUN_VOL = [
  { from: 1, to: 3, valFrom: 3, valTo: 4 },
  { from: 4, to: 6, valFrom: 4, valTo: 5.5 },
  { from: 7, to: 11, valFrom: 5.5, valTo: 7 },
  { from: 12, to: 16, valFrom: 14.5, valTo: 17 },
  { from: 17, to: 22, valFrom: 16, valTo: 17.5 },
  { from: 23, to: 30, valFrom: 21.5, valTo: 23 },
  { from: 31, to: 36, valFrom: 23, valTo: 26 },
  { from: 37, to: 42, valFrom: 16.5, valTo: 14.5 },
  { from: 43, to: 45, valFrom: 13, valTo: 11 },
  { from: 46, to: 47, valFrom: 9.5, valTo: 7 },
  { from: 48, to: 48, valFrom: 7, valTo: 7 },
];

const RUN_FOCUS = [
  { from: 1, to: 3, value: 'Run/walk — accoutumance, pas de vitesse' },
  { from: 4, to: 6, value: 'Continu facile, réduit le walk' },
  { from: 7, to: 11, value: 'Endurance + intro tempo' },
  { from: 12, to: 16, value: 'Endurance longue + tempo' },
  { from: 17, to: 22, value: 'Seuil + long easy' },
  { from: 23, to: 30, value: 'VO2max + endurance longue' },
  { from: 31, to: 36, value: 'Race-pace 10km + peak endurance' },
  { from: 37, to: 42, value: 'Taper — réduit volume, garde intensité brève' },
  { from: 43, to: 45, value: 'Mini-taper, fraîcheur musculaire' },
  { from: 46, to: 47, value: 'Pre-race taper, minimal stress' },
  { from: 48, to: 48, value: 'Race week — sharpening final' },
];

const RUN_STRUCT_MID = [
  { from: 1, to: 3, value: '5-6x(2min run / 1min walk), pace 11:00-12:00/km' },
  { from: 4, to: 6, value: '12-22min continu facile, pace 10:00-11:00/km' },
  { from: 7, to: 11, value: '6x1min tempo (6:00/km) / 1min easy + finish easy' },
  { from: 12, to: 16, value: '6x2min tempo (5:50/km) / 1min easy' },
  { from: 17, to: 22, value: '3x3min seuil (5:45/km) / 1min easy' },
  { from: 23, to: 30, value: '4x2min VO2max (5:30/km) / 1min easy' },
  { from: 31, to: 36, value: '2x(3min@6:30/km + 1min easy) + 4x1min@6:00/km' },
  { from: 37, to: 42, value: '1-2x(2min@6:30/km + 1min easy) + 3x1min@6:00/km' },
  { from: 43, to: 45, value: '3x1min@6:00/km / 1min easy + 10min easy' },
  { from: 46, to: 47, value: '10min easy + 5min strides' },
  { from: 48, to: 48, value: 'Facile + 4x30s strides (activation)' },
];

const RUN_STRUCT_LONG = [
  { from: 1, to: 3, value: '6x(2min run / 1min walk) — un peu plus long' },
  { from: 4, to: 6, value: '18-22min continu facile' },
  { from: 7, to: 11, value: '1.5km easy + 2x2min tempo (6:00/km) + 1.5km easy' },
  { from: 12, to: 16, value: '20-25min continu easy (Z2)' },
  { from: 17, to: 22, value: '25-30min continu easy, varie terrain' },
  { from: 23, to: 30, value: '35-40min continu easy (Z2)' },
  { from: 31, to: 36, value: '40-45min continu easy (Z2)' },
  { from: 37, to: 42, value: '30-35min long easy, 1-2 surges courts' },
  { from: 43, to: 45, value: '20-25min facile' },
  { from: 46, to: 47, value: '15min facile' },
  { from: 48, to: 48, value: 'Repos ou 2km très facile' },
];

const BIKE_VOL = [
  { from: 1, to: 6, valFrom: 50, valTo: 65 },
  { from: 7, to: 16, valFrom: 60, valTo: 65 },
  { from: 17, to: 26, valFrom: 60, valTo: 65 },
  { from: 27, to: 36, valFrom: 65, valTo: 70 },
  { from: 37, to: 42, valFrom: 60, valTo: 55 },
  { from: 43, to: 45, valFrom: 45, valTo: 40 },
  { from: 46, to: 47, valFrom: 25, valTo: 20 },
  { from: 48, to: 48, valFrom: 15, valTo: 15 },
];

const BIKE_FOCUS = [
  { from: 1, to: 6, value: 'Base build — distance easy, technique' },
  { from: 7, to: 16, value: 'Endurance build — 2h30 durée @ Z2' },
  { from: 17, to: 26, value: 'Intensité build — long easy ou tempo court' },
  { from: 27, to: 36, value: 'Peak endurance — 65-70km, climbing OK' },
  { from: 37, to: 42, value: 'Taper prep — réduit distance' },
  { from: 43, to: 45, value: 'Mini-taper — fraîcheur' },
  { from: 46, to: 47, value: 'Pre-race taper — maintenance' },
  { from: 48, to: 48, value: 'Race week' },
];

const FORCE_FREQ = (week: number) => (week <= 45 ? 2 : week <= 47 ? 1 : 0);

function makeSession(
  id: string,
  discipline: PlanDiscipline,
  title: string,
  structure: string[],
  zone: ZoneKey,
  distanceKm: number,
  durationMin: number,
): PlannedSession {
  const z = HR_ZONES[zone];
  return {
    id,
    discipline,
    title,
    structure,
    targetZone: zone,
    targetBpmMin: z.min,
    targetBpmMax: z.max,
    targetDistanceKm: Math.round(distanceKm * 100) / 100,
    targetDurationMin: Math.round(durationMin),
  };
}

function buildWeek(weekNumber: number): WeekPlan {
  const { phase, label, focus } = phaseOf(weekNumber);
  const startDate = addDays(PLAN_START, (weekNumber - 1) * 7);
  const endDate = endOfDay(addDays(startDate, 6));

  const swimTotal = blockValue(weekNumber, SWIM_VOL);
  const swimFocus = blockText(weekNumber, SWIM_FOCUS);
  const runTotal = blockValue(weekNumber, RUN_VOL);
  const runFocus = blockText(weekNumber, RUN_FOCUS);
  const runStructMid = blockText(weekNumber, RUN_STRUCT_MID);
  const runStructLong = blockText(weekNumber, RUN_STRUCT_LONG);
  const bikeTotal = blockValue(weekNumber, BIKE_VOL);
  const bikeFocus = blockText(weekNumber, BIKE_FOCUS);
  const forceFreq = FORCE_FREQ(weekNumber);

  const runHasLong = weekNumber >= 12;
  const runHasRecovery = weekNumber >= 23;

  const days: DayPlan[] = Array.from({ length: 7 }, (_, dayIndex) => {
    const date = addDays(startDate, dayIndex);
    const sessions: PlannedSession[] = [];

    const sid = (slot: string) => `w${weekNumber}-${slot}`;

    // Lundi (0): recovery run dès semaine 23
    if (dayIndex === 0 && runHasRecovery) {
      sessions.push(
        makeSession(sid('run-recovery'), 'run', 'Course — Récupération', ['15-20min easy (Z2), jambes légères'], 'z2', runTotal * 0.18, 20),
      );
    }

    // Mardi (1): natation + force A
    if (dayIndex === 1) {
      sessions.push(
        makeSession(sid('swim-a'), 'swim', 'Natation — ' + swimFocus, [swimFocus], 'z2', swimTotal * 0.45, 25 + weekNumber * 0.3),
      );
      if (forceFreq >= 1) {
        sessions.push(
          makeSession(sid('strength-a'), 'strength', 'Force — Bas du corps', ['Squats 3x10', 'Deadlifts 3x8', 'Fentes 3x8/jambe', 'Core 5-10min'], 'z2', 0, 45),
        );
      }
    }

    // Mercredi (2): course — séance qualité
    if (dayIndex === 2) {
      sessions.push(
        makeSession(sid('run-quality'), 'run', 'Course — ' + runFocus, [runStructMid], weekNumber >= 23 ? 'z4' : weekNumber >= 7 ? 'z3' : 'z2', runTotal * (runHasLong ? 0.4 : 0.5), 25 + weekNumber * 0.3),
      );
    }

    // Jeudi (3): vélo intensité optionnel (à partir de S17), sinon repos
    if (dayIndex === 3 && weekNumber >= 17 && weekNumber <= 36) {
      sessions.push(
        makeSession(sid('bike-intensity'), 'bike', 'Vélo — Intensité (optionnel)', ['4-5x2-3min @ Z3 (tempo) / 1min easy', 'Warm-up + cool-down easy'], 'z3', bikeTotal * 0.3, 40),
      );
    }

    // Vendredi (4): natation + force B
    if (dayIndex === 4) {
      sessions.push(
        makeSession(sid('swim-b'), 'swim', 'Natation — ' + swimFocus, [swimFocus], 'z2', swimTotal * 0.55, 25 + weekNumber * 0.3),
      );
      if (forceFreq >= 2) {
        sessions.push(
          makeSession(sid('strength-b'), 'strength', 'Force — Haut du corps', ['Push-ups 3x10', 'Rowing haltères 3x10/bras', 'Développé 3x8', 'Core 5-10min'], 'z2', 0, 45),
        );
      } else if (forceFreq === 1) {
        sessions.push(
          makeSession(sid('strength-b'), 'strength', 'Force — Maintenance légère', ['Circuit léger 20-30min, jambes/glutes'], 'z2', 0, 30),
        );
      }
    }

    // Samedi (5): course longue (dès S12), sinon repos
    if (dayIndex === 5 && runHasLong) {
      sessions.push(
        makeSession(sid('run-long'), 'run', 'Course — Sortie Longue', [runStructLong], 'z2', runTotal * 0.42, 30 + weekNumber * 0.5),
      );
    }

    // Dimanche (6): vélo long — règle permanente
    if (dayIndex === 6) {
      sessions.push(
        makeSession(sid('bike-long'), 'bike', 'Vélo — Sortie Longue (' + bikeFocus + ')', [bikeFocus, 'Cadence 85-95 rpm, Z2 majoritaire'], 'z2', bikeTotal, (bikeTotal / 25) * 60),
      );
    }

    return { dayIndex, date, sessions };
  });

  const volumeSummary = {
    swimKm: Math.round(swimTotal * 100) / 100,
    bikeKm: Math.round((bikeTotal + (weekNumber >= 17 && weekNumber <= 36 ? bikeTotal * 0.3 : 0)) * 10) / 10,
    runKm: Math.round(runTotal * 10) / 10,
    strengthSessions: forceFreq,
  };

  return { weekNumber, phase, phaseLabel: label, focus, startDate, endDate, days, volumeSummary };
}

export const TRAINING_PLAN: WeekPlan[] = Array.from({ length: TOTAL_WEEKS }, (_, i) => buildWeek(i + 1));

export function getWeekForDate(date: Date): WeekPlan | undefined {
  return TRAINING_PLAN.find((w) => date >= w.startDate && date <= w.endDate);
}

export function getDayPlan(date: Date): DayPlan | undefined {
  const week = getWeekForDate(date);
  if (!week) return undefined;
  return week.days.find((d) => d.date.toDateString() === date.toDateString());
}

export function daysUntilRace(from: Date = new Date()): number {
  return Math.max(0, Math.ceil((RACE.date.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export function readiness(discipline: PlanDiscipline): number {
  const t = RACE_TARGETS[discipline];
  if (t.target === 0) return 100;
  return Math.min(100, Math.round((t.current / t.target) * 100));
}
