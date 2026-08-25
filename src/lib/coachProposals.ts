import type { CoachProposalEnvelope } from '../types/coach';
import type { WeekPlanOverrides } from './planOverrides';
import { EMPTY_OVERRIDES } from './planOverrides';
import { validateProposal } from './coachValidation';
import {
  addExtraSession,
  moveSession,
  removeExtraSession,
  resetSession,
  setSessionSkipped,
  updateSession,
} from './scheduleOverrides';

/**
 * Applique une proposition approuvée par David. C'est le seul chemin d'écriture
 * du Coach — et il passe par les mêmes fonctions que les boutons du calendrier,
 * donc par les mêmes règles Firestore. On revalide ici même si le serveur l'a
 * déjà fait : la réponse HTTP n'est pas une source de vérité.
 *
 * Renvoie l'id de la séance créée pour un `add` (nécessaire pour l'annuler).
 */
export async function applyProposal(
  uid: string,
  envelope: CoachProposalEnvelope,
  overrides: WeekPlanOverrides = EMPTY_OVERRIDES,
): Promise<{ createdExtraId?: string }> {
  const error = validateProposal(envelope, overrides);
  if (error) throw new Error(`Proposition rejetée : ${error}`);

  const { weekNumber, proposal } = envelope;

  switch (proposal.kind) {
    case 'move':
      await moveSession(uid, weekNumber, proposal.sessionId, proposal.toDayIndex);
      return {};
    case 'edit':
      await updateSession(uid, weekNumber, proposal.sessionId, proposal.edit);
      return {};
    case 'skip':
      await setSessionSkipped(uid, weekNumber, proposal.sessionId, proposal.skipped);
      return {};
    case 'add': {
      const createdExtraId = await addExtraSession(uid, weekNumber, proposal.session);
      return { createdExtraId };
    }
    case 'remove':
      await removeExtraSession(uid, weekNumber, proposal.extraId);
      return {};
    case 'reset':
      await resetSession(uid, weekNumber, proposal.sessionId);
      return {};
  }
}

/**
 * Annule une proposition déjà appliquée. `resetSession` remet la séance du plan
 * telle qu'elle était ; pour une séance ajoutée par l'IA, il faut la retirer.
 */
export async function undoProposal(
  uid: string,
  envelope: CoachProposalEnvelope,
  createdExtraId?: string,
): Promise<void> {
  const { weekNumber, proposal } = envelope;
  if (proposal.kind === 'add') {
    if (createdExtraId) await removeExtraSession(uid, weekNumber, createdExtraId);
    return;
  }
  // Une séance ajoutée puis supprimée n'est pas restaurable : on n'en garde pas de copie.
  if (proposal.kind === 'remove') return;
  await resetSession(uid, weekNumber, proposal.sessionId);
}
