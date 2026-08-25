import { useState } from 'react';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import type { CoachProposalEnvelope } from '../types/coach';
import { applyProposal, undoProposal } from '../lib/coachProposals';
import type { WeekPlanOverrides } from '../lib/planOverrides';

interface ProposalCardProps {
  uid: string;
  envelope: CoachProposalEnvelope;
  /** Personnalisations connues pour cette semaine — requises pour valider avant d'écrire. */
  overrides?: WeekPlanOverrides;
}

const KIND_LABELS: Record<CoachProposalEnvelope['proposal']['kind'], string> = {
  move: 'Déplacer',
  edit: 'Modifier',
  skip: 'Sauter',
  add: 'Ajouter',
  remove: 'Retirer',
  reset: 'Rétablir',
};

type Status = 'pending' | 'applied' | 'dismissed';

export default function ProposalCard({ uid, envelope, overrides }: ProposalCardProps) {
  const [status, setStatus] = useState<Status>('pending');
  // `busy` est distinct de `status` : pendant une annulation la carte doit rester
  // affichée comme « appliquée », sinon les boutons sautent d'un état à l'autre.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdExtraId, setCreatedExtraId] = useState<string | undefined>();

  const handleApply = async () => {
    setBusy(true);
    setError(null);
    try {
      const { createdExtraId: newId } = await applyProposal(uid, envelope, overrides);
      setCreatedExtraId(newId);
      setStatus('applied');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’application.');
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    setBusy(true);
    setError(null);
    try {
      await undoProposal(uid, envelope, createdExtraId);
      setCreatedExtraId(undefined);
      setStatus('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’annulation.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'dismissed') return null;

  const applied = status === 'applied';

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        applied ? 'border-sport-bike/50 bg-sport-bike/5' : 'border-cyber-line bg-cyber-panel2'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-primary-900/60 text-primary-300 border border-primary-700/50">
          {KIND_LABELS[envelope.proposal.kind]}
        </span>
        <span className="text-[10px] font-mono text-slate-500">Semaine {envelope.weekNumber}</span>
        {applied && (
          <span className="text-[10px] font-mono text-sport-bike ml-auto flex items-center gap-1">
            <Check size={12} /> appliqué
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <span className="text-sm text-slate-500 line-through decoration-slate-600">{envelope.beforeLabel}</span>
        <ArrowRight size={14} className="text-primary-400 shrink-0" />
        <span className="text-sm text-slate-100 font-medium">{envelope.afterLabel}</span>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed mb-3">{envelope.rationale}</p>

      {error && <p className="text-xs font-mono text-sport-run mb-3">{error}</p>}

      <div className="flex gap-2">
        {applied ? (
          <button
            onClick={handleUndo}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-cyber-line text-slate-400 hover:text-slate-100 hover:border-slate-500 disabled:opacity-50"
          >
            <RotateCcw size={13} /> Annuler
          </button>
        ) : (
          <>
            <button
              onClick={handleApply}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/60 text-primary-300 hover:bg-primary-500/30 disabled:opacity-50"
            >
              <Check size={13} /> {busy ? 'Application…' : 'Appliquer'}
            </button>
            <button
              onClick={() => setStatus('dismissed')}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-cyber-line text-slate-500 hover:text-slate-300 disabled:opacity-50"
            >
              <X size={13} /> Ignorer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
