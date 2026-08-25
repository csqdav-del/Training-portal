import { DayPlan, Discipline, PlanDiscipline, PlannedSession, ZoneKey } from '../types';
import { HR_ZONES } from '../data/trainingPlan';

/**
 * Partie *pure* de la couche de personnalisation du plan : types, parsing et
 * composition. Volontairement sans aucun import Firebase — les fonctions
 * serverless (Admin SDK) doivent pouvoir recomposer le plan effectif sans tirer
 * le SDK client dans leur bundle. Les écritures vivent dans scheduleOverrides.ts.
 */

/** Modifications persistées d'une séance du plan (les champs absents gardent la valeur du plan). */
export interface SessionEdit {
  title?: string;
  targetZone?: ZoneKey;
  targetDistanceKm?: number;
  targetDurationMin?: number;
  notes?: string;
  skipped?: boolean;
  /**
   * Discipline réellement pratiquée à la place de celle du plan (piscine fermée,
   * blessure...). La séance reste visible au calendrier, barrée, avec l'icône du
   * sport de remplacement — contrairement à `skipped` qui la fait disparaître.
   */
  replacedBy?: Discipline;
}

/** Séance ajoutée manuellement, qui n'existe pas dans le plan de base. */
export interface ExtraSession {
  id: string;
  dayIndex: number;
  discipline: PlanDiscipline;
  title: string;
  targetZone: ZoneKey;
  targetDistanceKm: number;
  targetDurationMin: number;
  notes?: string;
}

export interface WeekPlanOverrides {
  moves: Record<string, number>; // sessionId -> dayIndex (0-6)
  edits: Record<string, SessionEdit>;
  extras: Record<string, ExtraSession>;
}

/** @deprecated conservé pour compatibilité — utilise WeekPlanOverrides['moves']. */
export type WeekOverrides = Record<string, number>;

export const EMPTY_OVERRIDES: WeekPlanOverrides = { moves: {}, edits: {}, extras: {} };

/**
 * Les premiers documents ne stockaient que des paires `sessionId: dayIndex` à plat.
 * On les relit comme des `moves` pour ne perdre aucun déplacement déjà enregistré.
 */
export function parseOverrides(data: Record<string, unknown> | undefined): WeekPlanOverrides {
  if (!data) return EMPTY_OVERRIDES;

  const legacyMoves: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number' && key !== 'updatedAt') legacyMoves[key] = value;
  }

  return {
    moves: { ...legacyMoves, ...((data.moves as Record<string, number>) ?? {}) },
    edits: (data.edits as Record<string, SessionEdit>) ?? {},
    extras: (data.extras as Record<string, ExtraSession>) ?? {},
  };
}

/** Applique un SessionEdit à une séance du plan (recalcule les BPM si la zone change). */
export function applySessionEdit(session: PlannedSession, edit: SessionEdit | undefined): PlannedSession {
  if (!edit) return session;
  const zone = edit.targetZone ?? session.targetZone;
  const z = HR_ZONES[zone];
  return {
    ...session,
    title: edit.title ?? session.title,
    targetZone: zone,
    targetBpmMin: z.min,
    targetBpmMax: z.max,
    targetDistanceKm: edit.targetDistanceKm ?? session.targetDistanceKm,
    targetDurationMin: edit.targetDurationMin ?? session.targetDurationMin,
    structure: edit.notes ? [...session.structure, edit.notes] : session.structure,
  };
}

/**
 * Reconstruit les 7 jours affichés à partir du plan de base + des personnalisations
 * persistées : déplacements, cibles modifiées, séances ajoutées.
 * Utilisé par le calendrier ET le tableau de bord pour qu'ils montrent la même chose.
 */
export function applyWeekOverrides(days: DayPlan[], overrides: WeekPlanOverrides): DayPlan[] {
  const bucket: PlannedSession[][] = [[], [], [], [], [], [], []];

  for (const day of days) {
    for (const session of day.sessions) {
      const target = overrides.moves[session.id] ?? day.dayIndex;
      const safeTarget = target >= 0 && target <= 6 ? target : day.dayIndex;
      bucket[safeTarget].push(applySessionEdit(session, overrides.edits[session.id]));
    }
  }

  for (const extra of Object.values(overrides.extras)) {
    const target = overrides.moves[extra.id] ?? extra.dayIndex;
    const safeTarget = target >= 0 && target <= 6 ? target : extra.dayIndex;
    bucket[safeTarget].push(extraToSession(extra));
  }

  return days.map((day) => ({ ...day, sessions: bucket[day.dayIndex] }));
}

/** Convertit une séance ajoutée à la main en PlannedSession utilisable par l'UI. */
export function extraToSession(extra: ExtraSession): PlannedSession {
  const z = HR_ZONES[extra.targetZone];
  return {
    id: extra.id,
    discipline: extra.discipline,
    title: extra.title,
    structure: extra.notes ? [extra.notes] : ['Séance ajoutée manuellement'],
    targetZone: extra.targetZone,
    targetBpmMin: z.min,
    targetBpmMax: z.max,
    targetDistanceKm: extra.targetDistanceKm,
    targetDurationMin: extra.targetDurationMin,
  };
}
