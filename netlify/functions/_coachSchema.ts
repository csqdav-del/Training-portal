import type { CoachProposal, CoachProposalEnvelope, CoachObservation } from '../../src/types/coach';
import type { ExtraSession } from '../../src/lib/planOverrides';

/**
 * Schéma imposé au modèle (structured outputs / tool `strict`).
 *
 * Le corps d'une proposition est volontairement *plat* — un `kind` plus tous les
 * champs possibles en nullable — plutôt qu'une union discriminée : c'est la seule
 * forme qui passe de façon fiable en mode strict (`additionalProperties: false`
 * + tous les champs `required`). On le remet en union discriminée dans
 * `normalizeEnvelope`, juste avant la validation métier.
 */

const ZONE_ENUM = ['z1', 'z2', 'z3', 'z4', 'z5'];
const PLAN_DISCIPLINE_ENUM = ['swim', 'bike', 'run', 'strength'];

const EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'targetZone', 'targetDistanceKm', 'targetDurationMin', 'notes', 'skipped'],
  properties: {
    title: { type: ['string', 'null'], description: 'Nouveau titre, ou null pour garder celui du plan.' },
    // Pas de `type` ici : l'API rejette `enum` combiné à un type nullable écrit en
    // tableau (« Enum value 'z1' does not match declared type ["string","null"] »).
    // L'enum contient déjà null, donc il contraint la valeur à lui seul.
    targetZone: { enum: [...ZONE_ENUM, null], description: 'Nouvelle zone FC, ou null pour garder celle du plan.' },
    targetDistanceKm: { type: ['number', 'null'], description: 'Nouvelle distance cible en km, ou null.' },
    targetDurationMin: { type: ['number', 'null'], description: 'Nouvelle durée cible en minutes, ou null.' },
    notes: { type: ['string', 'null'], description: 'Consigne ajoutée à la structure de la séance, ou null.' },
    skipped: { type: ['boolean', 'null'] },
  },
};

const NEW_SESSION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dayIndex', 'discipline', 'title', 'targetZone', 'targetDistanceKm', 'targetDurationMin', 'notes'],
  properties: {
    dayIndex: { type: 'integer', minimum: 0, maximum: 6, description: '0 = lundi ... 6 = dimanche.' },
    discipline: { type: 'string', enum: PLAN_DISCIPLINE_ENUM },
    title: { type: 'string' },
    targetZone: { type: 'string', enum: ZONE_ENUM },
    targetDistanceKm: { type: 'number', description: '0 pour la musculation.' },
    targetDurationMin: { type: 'number' },
    notes: { type: ['string', 'null'] },
  },
};

const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'sessionId', 'toDayIndex', 'edit', 'skipped', 'session', 'extraId'],
  properties: {
    kind: {
      type: 'string',
      enum: ['move', 'edit', 'skip', 'add', 'remove', 'reset'],
      description:
        'move = changer la séance de jour ; edit = changer ses cibles ; skip = la sauter ; add = ajouter une séance ; remove = retirer une séance ajoutée ; reset = revenir au plan d’origine.',
    },
    sessionId: {
      type: ['string', 'null'],
      description:
        'Identifiant exact de la séance, repris tel quel du contexte (ex. "w12-run-long"). Requis pour move, edit, skip, reset. null sinon.',
    },
    // Pas de minimum/maximum sur un type nullable : le validateur de l'API gère mal
    // les contraintes appliquées à une union (même famille de problème que l'enum
    // ci-dessus). Les bornes 0..6 sont de toute façon imposées par validateProposal.
    toDayIndex: {
      type: ['integer', 'null'],
      description: 'Jour cible, 0 = lundi ... 6 = dimanche. Requis pour move, null sinon.',
    },
    edit: { ...EDIT_SCHEMA, type: ['object', 'null'], description: 'Requis pour edit. null sinon.' },
    skipped: { type: ['boolean', 'null'], description: 'Requis pour skip. null sinon.' },
    session: { ...NEW_SESSION_SCHEMA, type: ['object', 'null'], description: 'Requis pour add. null sinon.' },
    extraId: { type: ['string', 'null'], description: 'Requis pour remove. null sinon.' },
  },
};

const ENVELOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['weekNumber', 'rationale', 'beforeLabel', 'afterLabel', 'proposal'],
  properties: {
    weekNumber: { type: 'integer', description: 'Numéro de semaine du plan, tel qu’affiché dans le contexte.' },
    rationale: { type: 'string', description: 'Pourquoi ce changement, en une ou deux phrases, en français.' },
    beforeLabel: {
      type: 'string',
      description: 'État actuel en clair, ex. "Vélo — Sortie Longue · dimanche · 60 km · Z2".',
    },
    afterLabel: { type: 'string', description: 'État proposé en clair, même format que beforeLabel.' },
    proposal: PROPOSAL_SCHEMA,
  },
};

/** Format de sortie du mode « Analyser ma progression ». */
export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'observations', 'proposals'],
  properties: {
    summary: { type: 'string', description: 'Deux ou trois phrases en français sur où en est David.' },
    observations: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'tone'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          tone: {
            type: 'string',
            enum: ['good', 'watch', 'risk'],
            description: 'good = ça va bien ; watch = à surveiller ; risk = problème à corriger.',
          },
        },
      },
    },
    proposals: { type: 'array', maxItems: 5, items: ENVELOPE_SCHEMA },
  },
};

/** Outil offert au modèle en mode conversation, pour proposer un changement au fil de l’échange. */
export const PROPOSE_TOOL = {
  name: 'propose_plan_change',
  description:
    'Propose UN changement au calendrier d’entraînement de David. Le changement n’est pas appliqué : il est affiché pour approbation. Appelle cet outil une fois par changement proposé, et seulement si David demande un ajustement ou si un ajustement est clairement justifié.',
  strict: true,
  input_schema: ENVELOPE_SCHEMA,
};

// --- Normalisation ---------------------------------------------------------

interface FlatProposal {
  kind: string;
  sessionId: string | null;
  toDayIndex: number | null;
  edit: Record<string, unknown> | null;
  skipped: boolean | null;
  session: Record<string, unknown> | null;
  extraId: string | null;
}

interface FlatEnvelope {
  weekNumber: number;
  rationale: string;
  beforeLabel: string;
  afterLabel: string;
  proposal: FlatProposal;
}

/** Retire les clés à `null` — le modèle doit toutes les fournir, mais nous n'en voulons aucune. */
function stripNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

function toProposal(flat: FlatProposal): CoachProposal | null {
  switch (flat.kind) {
    case 'move':
      if (flat.sessionId == null || flat.toDayIndex == null) return null;
      return { kind: 'move', sessionId: flat.sessionId, toDayIndex: flat.toDayIndex };
    case 'edit': {
      if (flat.sessionId == null || flat.edit == null) return null;
      const edit = stripNulls(flat.edit);
      if (Object.keys(edit).length === 0) return null;
      return { kind: 'edit', sessionId: flat.sessionId, edit };
    }
    case 'skip':
      if (flat.sessionId == null || flat.skipped == null) return null;
      return { kind: 'skip', sessionId: flat.sessionId, skipped: flat.skipped };
    case 'add': {
      if (flat.session == null) return null;
      // Le cast est assumé : la forme réelle est vérifiée juste après par validateProposal.
      const session = stripNulls(flat.session) as unknown as Omit<ExtraSession, 'id'>;
      return { kind: 'add', session };
    }
    case 'remove':
      if (flat.extraId == null) return null;
      return { kind: 'remove', extraId: flat.extraId };
    case 'reset':
      if (flat.sessionId == null) return null;
      return { kind: 'reset', sessionId: flat.sessionId };
    default:
      return null;
  }
}

/**
 * Convertit une enveloppe « plate » produite par le modèle en enveloppe applicable.
 * Renvoie `null` si la forme est incohérente — l'appelant la jette silencieusement
 * plutôt que de montrer à David un bouton qui échouerait.
 */
export function normalizeEnvelope(raw: unknown, index: number): CoachProposalEnvelope | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const flat = raw as FlatEnvelope;
  if (!flat.proposal || typeof flat.proposal !== 'object') return null;

  const proposal = toProposal(flat.proposal);
  if (!proposal) return null;

  return {
    id: `${Date.now().toString(36)}-${index}`,
    weekNumber: flat.weekNumber,
    proposal,
    rationale: String(flat.rationale ?? ''),
    beforeLabel: String(flat.beforeLabel ?? ''),
    afterLabel: String(flat.afterLabel ?? ''),
  };
}

export function normalizeObservations(raw: unknown): CoachObservation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map<CoachObservation>((o) => ({
      title: String(o.title ?? ''),
      detail: String(o.detail ?? ''),
      tone: o.tone === 'good' || o.tone === 'risk' ? o.tone : 'watch',
    }))
    .filter((o) => o.title !== '');
}
