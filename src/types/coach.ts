import type { ExtraSession, SessionEdit } from '../lib/planOverrides';

/**
 * Contrat entre le Coach IA et le portail.
 *
 * Règle d'or : l'IA n'écrit jamais dans Firestore. Elle retourne des propositions,
 * David les approuve, et c'est le client qui écrit. Chaque `kind` correspond
 * exactement à une fonction déjà présente dans lib/scheduleOverrides.ts — c'est ce
 * qui garde l'application triviale et auditable.
 */
export type CoachProposal =
  | { kind: 'move'; sessionId: string; toDayIndex: number } // -> moveSession
  | { kind: 'edit'; sessionId: string; edit: SessionEdit } // -> updateSession
  | { kind: 'skip'; sessionId: string; skipped: boolean } // -> setSessionSkipped
  | { kind: 'add'; session: Omit<ExtraSession, 'id'> } // -> addExtraSession
  | { kind: 'remove'; extraId: string } // -> removeExtraSession
  | { kind: 'reset'; sessionId: string }; // -> resetSession

export interface CoachProposalEnvelope {
  /** Identifiant stable côté client (clé React + idempotence de l'application). */
  id: string;
  /** Semaine du plan visée, 1..TOTAL_WEEKS. */
  weekNumber: number;
  proposal: CoachProposal;
  /** Pourquoi ce changement — affiché sous le diff. */
  rationale: string;
  /** État actuel, en clair. Ex. « Vélo — Sortie Longue · dimanche · 60 km · Z2 ». */
  beforeLabel: string;
  /** État proposé, en clair. */
  afterLabel: string;
}

export type ObservationTone = 'good' | 'watch' | 'risk';

export interface CoachObservation {
  title: string;
  detail: string;
  tone: ObservationTone;
}

export interface CoachAnalysis {
  summary: string;
  observations: CoachObservation[];
  proposals: CoachProposalEnvelope[];
}

/** Rapport tel que persisté dans users/{uid}/coachReports/{id}. */
export interface CoachReport extends CoachAnalysis {
  id: string;
  createdAt: number;
  weekNumber: number;
}

/** Un tour de conversation, tel que rendu par l'UI (le fil brut vit côté serveur). */
export interface CoachChatTurn {
  role: 'user' | 'assistant';
  text: string;
  proposals?: CoachProposalEnvelope[];
}

// --- Protocole HTTP de /.netlify/functions/coach ---------------------------

export type CoachRequest =
  | { mode: 'analyze' }
  | { mode: 'chat'; message: string }
  | { mode: 'reset-thread' }
  | { mode: 'history' };

export interface CoachAnalyzeResponse {
  analysis: CoachAnalysis;
  weekNumber: number;
  reportId: string;
}

export interface CoachHistoryResponse {
  turns: CoachChatTurn[];
  lastReport: CoachReport | null;
}

/** Événements SSE émis par le mode `chat`. */
export type CoachStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; proposals: CoachProposalEnvelope[] }
  | { type: 'error'; error: string };

export const COACH_ERROR_NOT_CONFIGURED = 'coach_not_configured';
