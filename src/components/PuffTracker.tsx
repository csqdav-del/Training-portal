import { useEffect, useMemo, useState } from 'react';
import { Undo2, Target, Flame, TrendingDown, Settings2, Check, X } from 'lucide-react';
import {
  Badge,
  DEFAULT_PLAN,
  PuffDay,
  VapingPlan,
  computeBadges,
  computeStats,
  dayKey,
  dayKeyToDate,
  goalForDay,
  logPuff,
  setPuffCount,
  shiftDayKey,
  subscribeToPuffDays,
  undoLastPuff,
} from '../lib/vapingPuffs';
import { saveVapingPlan, subscribeToVapingPlan } from '../lib/vaping';

interface PuffTrackerProps {
  uid: string;
}

const CHART_DAYS = 14;

/** La clé du jour, réévaluée toutes les minutes : le compteur se remet à zéro seul à minuit. */
function useTodayKey(): string {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    const id = setInterval(() => {
      const now = dayKey();
      setToday((prev) => (prev === now ? prev : now));
    }, 60000);
    return () => clearInterval(id);
  }, []);
  return today;
}

function weekdayLabel(key: string): string {
  return dayKeyToDate(key).toLocaleDateString('fr-CA', { weekday: 'short' }).replace('.', '');
}

export default function PuffTracker({ uid }: PuffTrackerProps) {
  const today = useTodayKey();
  const [days, setDays] = useState<PuffDay[]>([]);
  const [plan, setPlan] = useState<VapingPlan>(DEFAULT_PLAN);
  const [loaded, setLoaded] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [pulse, setPulse] = useState(0); // relance l'animation du bouton à chaque tap
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubDays = subscribeToPuffDays(uid, (next) => {
      setDays(next);
      setLoaded(true);
    });
    const unsubPlan = subscribeToVapingPlan(uid, setPlan);
    return () => {
      unsubDays();
      unsubPlan();
    };
  }, [uid]);

  const stats = useMemo(() => computeStats(days, plan, today), [days, plan, today]);
  const badges = useMemo(() => computeBadges(days, plan, stats, today), [days, plan, stats, today]);

  const chart = useMemo(() => {
    const byKey = new Map(days.map((d) => [d.date, d]));
    return Array.from({ length: CHART_DAYS }, (_, i) => {
      const key = shiftDayKey(today, -(CHART_DAYS - 1 - i));
      return {
        key,
        count: byKey.get(key)?.count ?? 0,
        logged: byKey.has(key),
        goal: goalForDay(plan, key),
        isToday: key === today,
      };
    });
  }, [days, plan, today]);

  const chartMax = Math.max(1, ...chart.map((c) => Math.max(c.count, c.goal ?? 0)));

  /**
   * Point de départ proposé : la dernière journée complète loggée est la mesure
   * la plus honnête. À défaut, ce qui est déjà compté aujourd'hui.
   */
  const suggestedBaseline = useMemo(() => {
    const lastComplete = days.find((d) => d.date < today && d.count > 0);
    if (lastComplete) return lastComplete.count;
    const todayCount = days.find((d) => d.date === today)?.count ?? 0;
    return todayCount > 0 ? todayCount : null;
  }, [days, today]);

  const run = (action: Promise<void>, label: string) => {
    setError(null);
    action.catch((err) => {
      console.error(`${label} failed`, err);
      setError("Impossible d'enregistrer — vérifie ta connexion.");
    });
  };

  const handlePuff = () => {
    setPulse((p) => p + 1);
    if (navigator.vibrate) navigator.vibrate(15);
    run(logPuff(uid), 'logPuff');
  };

  const { todayCount, todayGoal } = stats;
  const overGoal = todayGoal != null && todayCount > todayGoal;
  const remaining = todayGoal != null ? todayGoal - todayCount : null;
  const goalPct = todayGoal && todayGoal > 0 ? Math.min(100, (todayCount / todayGoal) * 100) : todayCount > 0 ? 100 : 0;

  return (
    <div className="space-y-6">
      {/* Barre de progression / niveau */}
      <div className="glass-panel p-5 border-sport-strength/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-sport-strength/20 border border-sport-strength/50 flex flex-col items-center justify-center shrink-0">
              <span className="text-[9px] text-slate-400 font-mono uppercase leading-none">Niv.</span>
              <span className="text-xl font-bold text-sport-strength font-mono leading-none">{stats.level}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-100 font-display font-bold uppercase tracking-wide">
                <Flame className={`w-4 h-4 ${stats.streak > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
                {stats.streak} jour{stats.streak > 1 ? 's' : ''} de série
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">Record : {stats.bestStreak} j</div>
            </div>
          </div>

          <div className="flex-1 min-w-[180px]">
            <div className="flex justify-between text-[11px] font-mono text-slate-500 mb-1">
              <span>XP</span>
              <span>
                {stats.xpInLevel} / {stats.xpForLevel}
              </span>
            </div>
            <div className="h-2 bg-cyber-bg rounded-full overflow-hidden border border-cyber-line">
              <div
                className="h-full bg-sport-strength transition-all duration-500"
                style={{ width: `${(stats.xpInLevel / stats.xpForLevel) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => setEditingPlan((v) => !v)}
            className="p-2 rounded-lg border border-cyber-line text-slate-400 hover:text-primary-300 hover:border-primary-400/50"
            title="Régler le plan de sevrage"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editingPlan && <PlanEditor uid={uid} plan={plan} today={today} onClose={() => setEditingPlan(false)} />}

      {/* Sans point de départ, aucun objectif n'a de sens : on propose de le fixer
          à partir de ce qui est déjà loggé plutôt que d'inventer un chiffre. */}
      {loaded && plan.baseline == null && !editingPlan && (
        <div className="glass-panel p-5 border-amber-400/30">
          <p className="text-slate-300 text-sm mb-3">
            <span className="text-amber-400 font-semibold">Phase de mesure.</span> Logge une journée normale, puis fixe ton
            point de départ — c'est de là que l'objectif descendra jour après jour.
          </p>
          {suggestedBaseline != null ? (
            <button
              onClick={() =>
                run(
                  saveVapingPlan(uid, { baseline: suggestedBaseline, targetDays: plan.targetDays, planStart: today }),
                  'saveVapingPlan',
                )
              }
              className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/50 text-amber-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400/25"
            >
              <Target className="w-4 h-4" /> Fixer mon départ à {suggestedBaseline} puffs/jour
            </button>
          ) : (
            <p className="text-xs text-slate-500 font-mono">
              Pas encore assez de données — reviens demain, ou saisis le chiffre à la main via ⚙️.
            </p>
          )}
        </div>
      )}

      {/* Compteur du jour + gros bouton */}
      <div className="glass-panel p-8 border-sport-strength/30 shadow-neon-purple">
        <div className="text-center mb-6">
          <div className="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">Aujourd'hui</div>
          <div
            className={`text-7xl font-bold font-mono leading-none ${
              overGoal ? 'text-sport-run' : 'text-sport-strength text-glow-cyan'
            }`}
          >
            {todayCount}
          </div>
          <div className="text-slate-400 text-sm mt-2">
            puff{todayCount > 1 ? 's' : ''}
            {todayGoal != null && <span className="text-slate-600"> / objectif {todayGoal}</span>}
          </div>
        </div>

        {todayGoal != null && (
          <div className="mb-6">
            <div className="h-3 bg-cyber-bg rounded-full overflow-hidden border border-cyber-line">
              <div
                className={`h-full transition-all duration-300 ${overGoal ? 'bg-sport-run' : 'bg-sport-bike'}`}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className={`text-center text-sm mt-2 font-mono ${overGoal ? 'text-sport-run' : 'text-sport-bike'}`}>
              {remaining != null && remaining >= 0
                ? `Il te reste ${remaining} puff${remaining > 1 ? 's' : ''} avant de dépasser`
                : `Objectif dépassé de ${Math.abs(remaining ?? 0)}`}
            </p>
          </div>
        )}

        <button
          key={pulse}
          onClick={handlePuff}
          className="w-full py-10 rounded-2xl bg-sport-strength/20 border-2 border-sport-strength/60 text-sport-strength font-display font-bold text-2xl uppercase tracking-widest hover:bg-sport-strength/30 hover:shadow-neon-purple active:scale-[0.98] transition-all select-none"
        >
          + 1 Puff
        </button>

        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => run(undoLastPuff(uid, today), 'undoLastPuff')}
            disabled={todayCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyber-line text-slate-400 text-sm hover:text-slate-100 hover:border-slate-500 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-cyber-line"
          >
            <Undo2 className="w-4 h-4" /> Annuler le dernier
          </button>
        </div>

        {error && <p className="text-center text-sport-run text-sm mt-3 font-mono">{error}</p>}

        <p className="text-center text-slate-300 text-sm mt-6">{encouragement(stats, plan, loaded)}</p>
      </div>

      {/* Historique 14 jours */}
      <div className="glass-panel p-6 border-cyber-line">
        <h3 className="text-sm font-display font-bold text-slate-300 uppercase tracking-wide mb-5 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-sport-bike" /> 14 derniers jours
        </h3>
        <div className="flex items-end justify-between gap-1.5 h-40">
          {chart.map((d) => {
            const hit = d.goal != null && d.count <= d.goal;
            const barPct = (d.count / chartMax) * 100;
            const goalPctBar = d.goal != null ? (d.goal / chartMax) * 100 : null;
            return (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 h-full" title={`${d.key} — ${d.count} puffs`}>
                <div className="relative flex-1 w-full flex items-end">
                  {/* Trait d'objectif du jour, pour voir d'un coup d'œil si la barre passe dessous. */}
                  {goalPctBar != null && (
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-slate-600"
                      style={{ bottom: `${Math.min(100, goalPctBar)}%` }}
                    />
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${
                      !d.logged && !d.isToday
                        ? 'bg-cyber-line'
                        : hit
                        ? 'bg-sport-bike/70'
                        : d.goal == null
                        ? 'bg-slate-600'
                        : 'bg-sport-run/70'
                    } ${d.isToday ? 'ring-1 ring-sport-strength' : ''}`}
                    style={{ height: `${Math.max(d.count > 0 ? 4 : 2, barPct)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-mono ${d.isToday ? 'text-sport-strength' : 'text-slate-600'}`}>
                  {d.count}
                </span>
                <span className="text-[9px] font-mono text-slate-700 uppercase">{weekdayLabel(d.key)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Moyenne 7 j" value={stats.avg7 != null ? stats.avg7.toFixed(1) : '—'} />
        <StatCard label="Meilleure journée" value={stats.bestDay ? String(stats.bestDay.count) : '—'} />
        <StatCard label="Puffs évités" value={String(stats.puffsAvoided)} />
        <StatCard label="Économisé" value={`$${stats.moneySaved.toFixed(2)}`} />
      </div>

      {/* Badges */}
      <div className="glass-panel p-6 border-cyber-line">
        <h3 className="text-sm font-display font-bold text-slate-300 uppercase tracking-wide mb-4">Trophées</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((b) => (
            <BadgeTile key={b.id} badge={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
      <div className="text-[11px] text-slate-500 font-mono uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-100 font-mono">{value}</div>
    </div>
  );
}

function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div
      title={badge.hint}
      className={`rounded-lg p-3 text-center border ${
        badge.earned ? 'bg-sport-strength/10 border-sport-strength/50' : 'bg-cyber-panel2 border-cyber-line opacity-40'
      }`}
    >
      <div className={`text-2xl mb-1 ${badge.earned ? '' : 'grayscale'}`}>{badge.icon}</div>
      <div className={`text-[11px] font-mono ${badge.earned ? 'text-slate-200' : 'text-slate-500'}`}>{badge.label}</div>
    </div>
  );
}

function encouragement(stats: ReturnType<typeof computeStats>, plan: VapingPlan, loaded: boolean): string {
  if (!loaded) return '…';
  if (plan.baseline == null) {
    return "Phase de mesure : logge chaque puff aujourd'hui, ça donnera ton point de départ.";
  }
  if (stats.todayGoal === 0) return "Objectif du jour : zéro. C'est la dernière marche 🫧";
  if (stats.todayGoal != null && stats.todayCount > stats.todayGoal) {
    return 'Objectif dépassé, mais la journée compte quand même. Demain on reprend.';
  }
  if (stats.streak >= 7) return `${stats.streak} jours d'affilée sous l'objectif. Tu es en train de le faire 🔥`;
  if (stats.streak > 0) return `Série de ${stats.streak} jour${stats.streak > 1 ? 's' : ''}. Ne la casse pas aujourd'hui.`;
  return 'Chaque puff non pris est un point gagné. Vas-y doucement.';
}

/** Réglage du plan : point de départ, durée du sevrage, et correction du compteur du jour. */
function PlanEditor({
  uid,
  plan,
  today,
  onClose,
}: {
  uid: string;
  plan: VapingPlan;
  today: string;
  onClose: () => void;
}) {
  const [baseline, setBaseline] = useState(plan.baseline != null ? String(plan.baseline) : '');
  const [targetDays, setTargetDays] = useState(String(plan.targetDays));
  const [correction, setCorrection] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const b = Number(baseline);
    const t = Number(targetDays);
    if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(t) || t <= 0) return;
    setSaving(true);
    try {
      await saveVapingPlan(uid, {
        baseline: Math.round(b),
        targetDays: Math.round(t),
        // Le plan démarre aujourd'hui s'il n'a jamais été lancé ; sinon on garde
        // la date d'origine pour ne pas remettre la descente à zéro.
        planStart: plan.planStart ?? today,
      });
      const c = Number(correction);
      if (correction.trim() !== '' && Number.isFinite(c) && c >= 0) {
        await setPuffCount(uid, today, Math.round(c));
      }
      onClose();
    } catch (err) {
      console.error('saveVapingPlan failed', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel p-6 border-primary-400/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-bold text-primary-300 uppercase tracking-wide flex items-center gap-2">
          <Target className="w-4 h-4" /> Plan de sevrage
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200" title="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wide">Point de départ (puffs/jour)</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            placeholder="ex. 60"
            className="mt-1 w-full bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-primary-400 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wide">Jours pour arriver à 0</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={targetDays}
            onChange={(e) => setTargetDays(e.target.value)}
            className="mt-1 w-full bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-primary-400 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wide">Corriger aujourd'hui</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="laisser vide"
            className="mt-1 w-full bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-primary-400 focus:outline-none"
          />
        </label>
      </div>

      <p className="text-xs text-slate-500 font-mono mt-3">
        L'objectif descend en ligne droite du point de départ jusqu'à 0
        {plan.planStart ? ` (plan démarré le ${plan.planStart})` : ' à partir d’aujourd’hui'}.
      </p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-2 bg-primary-500/20 border border-primary-400/60 text-primary-300 px-5 py-2 rounded-lg font-semibold hover:bg-primary-500/30 disabled:opacity-50"
      >
        <Check className="w-4 h-4" /> Enregistrer
      </button>
    </div>
  );
}
