import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eye, Send, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { TOTAL_WEEKS, planProgress } from '../data/trainingPlan';
import { EMPTY_OVERRIDES } from '../lib/planOverrides';
import type { WeekPlanOverrides } from '../lib/planOverrides';
import { subscribeToWeekOverrides } from '../lib/scheduleOverrides';
import {
  CoachNotConfiguredError,
  loadCoachHistory,
  requestAnalysis,
  resetCoachThread,
  sendChatMessage,
} from '../lib/coachApi';
import type { CoachAnalysis, CoachChatTurn, ObservationTone } from '../types/coach';
import ProposalCard from './ProposalCard';

interface CoachProps {
  uid: string;
}

/** Même rayon que WEEK_RADIUS côté serveur : l'IA ne propose rien en dehors. */
const WEEK_RADIUS = 2;
/** Fenêtre pendant laquelle on grise le bouton d'analyse (garde-fou de coût, côté confort). */
const ANALYSIS_COOLDOWN_MS = 60 * 60 * 1000;

const TONE_STYLES: Record<ObservationTone, { border: string; text: string; label: string }> = {
  good: { border: 'border-sport-bike/40', text: 'text-sport-bike', label: 'ça va bien' },
  watch: { border: 'border-primary-500/40', text: 'text-primary-300', label: 'à surveiller' },
  risk: { border: 'border-sport-run/40', text: 'text-sport-run', label: 'à corriger' },
};

export default function Coach({ uid }: CoachProps) {
  const [analysis, setAnalysis] = useState<CoachAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<number | null>(null);

  const [turns, setTurns] = useState<CoachChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [overridesByWeek, setOverridesByWeek] = useState<Record<number, WeekPlanOverrides>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const weekNumber = useMemo(() => planProgress(new Date()).weekNumber, []);

  const weeks = useMemo(() => {
    const list: number[] = [];
    for (let w = weekNumber - WEEK_RADIUS; w <= weekNumber + WEEK_RADIUS; w++) {
      if (w >= 1 && w <= TOTAL_WEEKS) list.push(w);
    }
    return list;
  }, [weekNumber]);

  // Les personnalisations servent à valider une proposition avant d'écrire, et
  // sont en temps réel — donc une séance ajoutée ailleurs est connue ici aussi.
  useEffect(() => {
    const unsubs = weeks.map((w) =>
      subscribeToWeekOverrides(uid, w, (o) => setOverridesByWeek((prev) => ({ ...prev, [w]: o }))),
    );
    return () => unsubs.forEach((fn) => fn());
  }, [uid, weeks]);

  useEffect(() => {
    let cancelled = false;
    loadCoachHistory()
      .then(({ turns: loaded, lastReport }) => {
        if (cancelled) return;
        setTurns(loaded);
        if (lastReport) {
          setAnalysis({
            summary: lastReport.summary,
            observations: lastReport.observations ?? [],
            proposals: lastReport.proposals ?? [],
          });
          setLastAnalysisAt(lastReport.createdAt);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof CoachNotConfiguredError) setNotConfigured(true);
        else setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, streamText]);

  const cooldownRemaining = lastAnalysisAt ? lastAnalysisAt + ANALYSIS_COOLDOWN_MS - Date.now() : 0;
  const onCooldown = cooldownRemaining > 0;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const result = await requestAnalysis();
      setAnalysis(result.analysis);
      setLastAnalysisAt(Date.now());
    } catch (err) {
      if (err instanceof CoachNotConfiguredError) setNotConfigured(true);
      else setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSend = async () => {
    const message = draft.trim();
    if (!message || streaming) return;

    setDraft('');
    setTurns((prev) => [...prev, { role: 'user', text: message }]);
    setStreaming(true);
    setStreamText('');
    setError(null);

    let accumulated = '';
    try {
      await sendChatMessage(message, {
        onText: (chunk) => {
          accumulated += chunk;
          setStreamText(accumulated);
        },
        onProposals: (proposals) => {
          setTurns((prev) => [
            ...prev,
            { role: 'assistant', text: accumulated, ...(proposals.length > 0 ? { proposals } : {}) },
          ]);
          setStreamText('');
        },
      });
    } catch (err) {
      if (err instanceof CoachNotConfiguredError) setNotConfigured(true);
      else setError(err instanceof Error ? err.message : String(err));
      setStreamText('');
    } finally {
      setStreaming(false);
    }
  };

  const handleResetThread = async () => {
    try {
      await resetCoachThread();
      setTurns([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (notConfigured) {
    return (
      <div className="glass-panel p-6 border border-cyber-line rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="text-primary-400" size={18} />
          <h2 className="font-display text-lg text-slate-100">Coach non configuré</h2>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          La clé <code className="font-mono text-primary-300">ANTHROPIC_API_KEY</code> n’est pas définie côté
          serveur. Ajoute-la dans les variables d’environnement Netlify (ou dans{' '}
          <code className="font-mono text-primary-300">.env</code> pour le développement local, avec{' '}
          <code className="font-mono text-primary-300">npx netlify dev</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* --- Analyse --- */}
      <section className="glass-panel p-5 border border-cyber-line rounded-2xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-lg text-slate-100 flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-400" />
              Analyse de progression
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Semaine {weekNumber} · basée sur tes 90 derniers jours
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || onCooldown}
            title={onCooldown ? 'Analyse déjà faite dans la dernière heure' : undefined}
            className="shrink-0 flex items-center gap-2 text-sm font-mono px-4 py-2 rounded-lg bg-primary-500/20 border border-primary-500/60 text-primary-300 hover:bg-primary-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles size={15} />
            {analyzing ? 'Analyse en cours…' : 'Analyser ma progression'}
          </button>
        </div>

        {analyzing && (
          <p className="text-sm text-primary-300 font-mono animate-pulse">
            Le coach lit tes entraînements… ça prend une trentaine de secondes.
          </p>
        )}

        {!analyzing && !analysis && !loadingHistory && (
          <p className="text-sm text-slate-500">
            Aucune analyse encore. Lance-en une pour voir où tu en es par rapport au plan.
          </p>
        )}

        {analysis && !analyzing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed">{analysis.summary}</p>

            {analysis.observations.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {analysis.observations.map((obs, i) => {
                  const tone = TONE_STYLES[obs.tone];
                  return (
                    <div key={i} className={`rounded-lg border ${tone.border} bg-cyber-panel2 p-3`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm text-slate-100 font-medium">{obs.title}</h3>
                        <span className={`text-[10px] font-mono uppercase ${tone.text}`}>{tone.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{obs.detail}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {analysis.proposals.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                  Changements proposés — rien n’est appliqué sans ton accord
                </h3>
                {analysis.proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    uid={uid}
                    envelope={p}
                    overrides={overridesByWeek[p.weekNumber] ?? EMPTY_OVERRIDES}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono">
                Aucun changement proposé — le coach juge que le plan tient la route.
              </p>
            )}
          </div>
        )}
      </section>

      {/* --- Conversation --- */}
      <section className="glass-panel p-5 border border-cyber-line rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-slate-100 flex items-center gap-2">
            <Eye size={18} className="text-primary-400" />
            Poser une question
          </h2>
          {turns.length > 0 && (
            <button
              onClick={handleResetThread}
              className="flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-300"
            >
              <Trash2 size={13} /> Vider le fil
            </button>
          )}
        </div>

        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          {turns.length === 0 && !streamText && (
            <p className="text-sm text-slate-500">
              Ex. « pourquoi tu déplaces ma sortie longue ? », « je pars en voyage la semaine prochaine »,
              « mon genou tire depuis mardi ».
            </p>
          )}

          {turns.map((turn, i) => (
            <div key={i} className={turn.role === 'user' ? 'flex justify-end' : ''}>
              <div
                className={
                  turn.role === 'user'
                    ? 'max-w-[85%] rounded-xl px-3 py-2 bg-primary-500/15 border border-primary-500/40 text-sm text-slate-100'
                    : 'w-full space-y-3'
                }
              >
                {turn.text && (
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                )}
                {turn.proposals?.map((p) => (
                  <ProposalCard
                    key={p.id}
                    uid={uid}
                    envelope={p}
                    overrides={overridesByWeek[p.weekNumber] ?? EMPTY_OVERRIDES}
                  />
                ))}
              </div>
            </div>
          ))}

          {streamText && (
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{streamText}</p>
          )}
          {streaming && !streamText && (
            <p className="text-sm text-primary-300 font-mono animate-pulse">Le coach réfléchit…</p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 mt-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={streaming}
            placeholder="Ta question…"
            maxLength={2000}
            className="flex-1 bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-primary-400 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={streaming || draft.trim() === ''}
            className="flex items-center gap-1.5 text-sm font-mono px-4 py-2 rounded-lg bg-primary-500/20 border border-primary-500/60 text-primary-300 hover:bg-primary-500/30 disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </section>

      {error && (
        <p className="text-sm font-mono text-sport-run flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

      <p className="text-[11px] text-slate-600 leading-relaxed">
        Le coach donne des conseils d’entraînement, pas des avis médicaux. Devant une douleur qui persiste,
        consulte un professionnel.
      </p>
    </div>
  );
}
