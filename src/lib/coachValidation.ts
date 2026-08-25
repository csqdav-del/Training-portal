import { TOTAL_WEEKS, TRAINING_PLAN } from '../data/trainingPlan';
import type { CoachProposal, CoachProposalEnvelope } from '../types/coach';
import type { WeekPlanOverrides } from './planOverrides';
import { EMPTY_OVERRIDES } from './planOverrides';

/**
 * Garde-fou appliqué DEUX fois : par la fonction serverless avant de renvoyer une
 * proposition, et par le client avant d'écrire. Un modèle qui hallucine un
 * identifiant de séance ou une semaine 999 ne doit jamais toucher Firestore.
 */

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5'];
const PLAN_DISCIPLINES = ['swim', 'bike', 'run', 'strength'];
const DISCIPLINES = ['swim', 'bike', 'run', 'strength', 'walk', 'other'];

const MAX_DISTANCE_KM = 300;
const MAX_DURATION_MIN = 600;

function isInt(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function isNum(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

/** Identifiants de séance réellement existants pour cette semaine (plan + extras). */
export function knownSessionIds(weekNumber: number, overrides: WeekPlanOverrides): Set<string> {
  const ids = new Set<string>();
  const week = TRAINING_PLAN[weekNumber - 1];
  if (week) {
    for (const day of week.days) for (const s of day.sessions) ids.add(s.id);
  }
  for (const id of Object.keys(overrides.extras)) ids.add(id);
  return ids;
}

function validateEditFields(edit: unknown): string | null {
  if (typeof edit !== 'object' || edit === null) return 'edit doit être un objet';
  const e = edit as Record<string, unknown>;
  const allowed = ['title', 'targetZone', 'targetDistanceKm', 'targetDurationMin', 'notes', 'skipped', 'replacedBy'];
  for (const key of Object.keys(e)) {
    if (!allowed.includes(key)) return `champ inconnu dans edit: ${key}`;
  }
  if (Object.keys(e).length === 0) return 'edit est vide';
  if (e.title !== undefined && (typeof e.title !== 'string' || e.title.trim() === '' || e.title.length > 120))
    return 'title invalide';
  if (e.targetZone !== undefined && !ZONE_KEYS.includes(e.targetZone as string)) return 'targetZone invalide';
  if (e.targetDistanceKm !== undefined && !isNum(e.targetDistanceKm, 0, MAX_DISTANCE_KM))
    return 'targetDistanceKm hors limites';
  if (e.targetDurationMin !== undefined && !isNum(e.targetDurationMin, 0, MAX_DURATION_MIN))
    return 'targetDurationMin hors limites';
  if (e.notes !== undefined && (typeof e.notes !== 'string' || e.notes.length > 500)) return 'notes invalide';
  if (e.skipped !== undefined && typeof e.skipped !== 'boolean') return 'skipped invalide';
  if (e.replacedBy !== undefined && !DISCIPLINES.includes(e.replacedBy as string)) return 'replacedBy invalide';
  return null;
}

function validateProposalBody(p: CoachProposal, ids: Set<string>, overrides: WeekPlanOverrides): string | null {
  switch (p.kind) {
    case 'move':
      if (!ids.has(p.sessionId)) return `séance inconnue: ${p.sessionId}`;
      if (!isInt(p.toDayIndex, 0, 6)) return 'toDayIndex doit être un entier 0..6';
      return null;
    case 'edit':
      if (!ids.has(p.sessionId)) return `séance inconnue: ${p.sessionId}`;
      return validateEditFields(p.edit);
    case 'skip':
      if (!ids.has(p.sessionId)) return `séance inconnue: ${p.sessionId}`;
      if (typeof p.skipped !== 'boolean') return 'skipped invalide';
      return null;
    case 'add': {
      const s = p.session;
      if (typeof s !== 'object' || s === null) return 'session manquante';
      if (!isInt(s.dayIndex, 0, 6)) return 'dayIndex doit être un entier 0..6';
      if (!PLAN_DISCIPLINES.includes(s.discipline)) return 'discipline invalide';
      if (typeof s.title !== 'string' || s.title.trim() === '' || s.title.length > 120) return 'title invalide';
      if (!ZONE_KEYS.includes(s.targetZone)) return 'targetZone invalide';
      if (!isNum(s.targetDistanceKm, 0, MAX_DISTANCE_KM)) return 'targetDistanceKm hors limites';
      if (!isNum(s.targetDurationMin, 0, MAX_DURATION_MIN)) return 'targetDurationMin hors limites';
      if (s.notes !== undefined && (typeof s.notes !== 'string' || s.notes.length > 500)) return 'notes invalide';
      return null;
    }
    case 'remove':
      if (!overrides.extras[p.extraId]) return `séance ajoutée inconnue: ${p.extraId}`;
      return null;
    case 'reset':
      if (!ids.has(p.sessionId)) return `séance inconnue: ${p.sessionId}`;
      return null;
    default:
      return `type de proposition inconnu: ${(p as { kind?: string }).kind}`;
  }
}

/**
 * Renvoie un message d'erreur, ou `null` si la proposition est applicable telle quelle.
 * `overrides` = les personnalisations déjà enregistrées pour cette semaine (nécessaires
 * pour connaître les séances ajoutées à la main).
 */
export function validateProposal(
  envelope: CoachProposalEnvelope,
  overrides: WeekPlanOverrides = EMPTY_OVERRIDES,
): string | null {
  if (!envelope || typeof envelope !== 'object') return 'proposition vide';
  if (typeof envelope.id !== 'string' || envelope.id.trim() === '') return 'id manquant';
  if (!isInt(envelope.weekNumber, 1, TOTAL_WEEKS)) return `weekNumber doit être un entier 1..${TOTAL_WEEKS}`;
  if (typeof envelope.rationale !== 'string' || envelope.rationale.trim() === '') return 'rationale manquant';
  if (typeof envelope.beforeLabel !== 'string' || typeof envelope.afterLabel !== 'string')
    return 'libellés avant/après manquants';
  if (!envelope.proposal || typeof envelope.proposal !== 'object') return 'corps de proposition manquant';

  return validateProposalBody(
    envelope.proposal,
    knownSessionIds(envelope.weekNumber, overrides),
    overrides,
  );
}
