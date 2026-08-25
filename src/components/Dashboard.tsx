import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Droplet,
  Bike,
  Wind,
  Zap,
  Flame,
  Calendar as CalendarIcon,
  Link2,
  RefreshCw,
  Plus,
  Check,
  Pencil,
  HeartPulse,
  Moon,
  Footprints,
  Smartphone,
  Target,
  Dumbbell,
} from 'lucide-react';
import { WeeklyStats, TrainingZones, PlanDiscipline, Discipline, PlannedSession, Workout, DailyMetric } from '../types';
import { RACE, getWeekForDate, getDayPlan, planProgress, targetsFromDays } from '../data/trainingPlan';
import { isManualWorkout } from '../lib/manualWorkout';
import { formatDuration, summarizeEffort } from '../lib/format';
import WorkoutDetail from './WorkoutDetail';
import ActivityDetail from './ActivityDetail';
import LogWorkoutModal from './LogWorkoutModal';
import {
  subscribeToWeekOverrides,
  applyWeekOverrides,
  EMPTY_OVERRIDES,
  WeekPlanOverrides,
} from '../lib/scheduleOverrides';

interface DashboardProps {
  uid: string;
  weeklyStats: WeeklyStats;
  /** Mêmes compteurs, mais sur tout l'historique — le tableau bascule entre les deux. */
  allTimeStats: WeeklyStats;
  zones: TrainingZones;
  weightData: { date: string; weight: number }[];
  workouts: Workout[];
  stravaConnected: boolean;
  syncing: boolean;
  lastSyncCount: number | null;
  onConnectStrava: () => void;
  onSyncStrava: () => void;
  /** false sur le web : Health Connect n'existe que dans l'app Android. */
  healthSupported: boolean;
  healthConnected: boolean;
  healthSyncing: boolean;
  lastHealthSyncCount: number | null;
  healthError: string | null;
  todayMetric: DailyMetric | undefined;
  onConnectHealth: () => void;
  onSyncHealth: () => void;
}

const HEALTH_ERROR_LABELS: Record<string, string> = {
  not_logged_in: 'Connecte-toi d’abord',
  not_native: 'Disponible seulement dans l’app Android',
  health_connect_unavailable: 'Health Connect n’est pas installé sur ce téléphone',
  not_authorized: 'Permissions Health Connect non accordées',
  permissions_refusees: 'Permissions refusées',
};

/** 487 min → "8h07" */
function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

const DISCIPLINE_META: Record<PlanDiscipline, { label: string; color: string; bar: string; icon: string }> = {
  swim: { label: 'Natation', color: 'text-sport-swim', bar: 'bg-sport-swim', icon: '🏊' },
  bike: { label: 'Vélo', color: 'text-sport-bike', bar: 'bg-sport-bike', icon: '🚴' },
  run: { label: 'Course', color: 'text-sport-run', bar: 'bg-sport-run', icon: '🏃' },
  strength: { label: 'Force', color: 'text-sport-strength', bar: 'bg-sport-strength', icon: '💪' },
};

const ACTIVITY_ICON: Record<Discipline, string> = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
  strength: '💪',
  walk: '🚶',
  other: '⚡',
};

export default function Dashboard({
  uid,
  weeklyStats,
  allTimeStats,
  zones,
  weightData,
  workouts,
  stravaConnected,
  syncing,
  lastSyncCount,
  onConnectStrava,
  onSyncStrava,
  healthSupported,
  healthConnected,
  healthSyncing,
  lastHealthSyncCount,
  healthError,
  todayMetric,
  onConnectHealth,
  onSyncHealth,
}: DashboardProps) {
  const [showToday, setShowToday] = useState(false);
  // Les totaux affichent au choix la semaine en cours ou tout l'historique.
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [weekOverrides, setWeekOverrides] = useState<WeekPlanOverrides>(EMPTY_OVERRIDES);

  const currentWeekNumber = getWeekForDate(new Date())?.weekNumber;

  useEffect(() => {
    if (!currentWeekNumber) return;
    return subscribeToWeekOverrides(uid, currentWeekNumber, setWeekOverrides);
  }, [uid, currentWeekNumber]);
  /**
   * Saisie manuelle : `null` = fermé. `session` pré-remplit le formulaire avec la
   * séance du jour qu'on vient valider ou troquer, `workout` ouvre en modification.
   */
  const [logging, setLogging] = useState<{
    workout?: Workout | null;
    session?: PlannedSession | null;
  } | null>(null);

  const today = new Date();
  const currentWeek = getWeekForDate(today);
  // On applique les personnalisations enregistrées pour que le tableau de bord
  // affiche le même plan que le calendrier — objectifs hebdo compris.
  const effectiveDays = currentWeek ? applyWeekOverrides(currentWeek.days, weekOverrides) : [];
  // Les séances sautées ne comptent plus dans l'objectif de la semaine.
  const plannedDays = effectiveDays.map((d) => ({
    ...d,
    sessions: d.sessions.filter((sess) => !weekOverrides.edits[sess.id]?.skipped),
  }));
  const weekTargets = targetsFromDays(plannedDays);
  const rawTodayPlan = currentWeek
    ? effectiveDays.find((d) => d.date.toDateString() === today.toDateString())
    : getDayPlan(today);
  // Les séances marquées « sautée » disparaissent du programme du jour.
  const todayPlan = rawTodayPlan
    ? { ...rawTodayPlan, sessions: rawTodayPlan.sessions.filter((s) => !weekOverrides.edits[s.id]?.skipped) }
    : undefined;
  /**
   * Une séance compte comme faite si une activité du jour la référence
   * explicitement (bouton « Logger »), si elle a été troquée contre un autre
   * sport, ou si une activité de la même discipline est arrivée par Strava.
   */
  const isSessionDone = (session: PlannedSession): boolean => {
    if (weekOverrides.edits[session.id]?.replacedBy) return true;
    return workouts.some((w) => {
      if (w.plannedSessionId === session.id) return true;
      return w.type === session.discipline && new Date(w.date).toDateString() === today.toDateString();
    });
  };

  const progress = planProgress(today);
  const raceDays = progress.daysUntilRace;

  /**
   * Une carte par discipline : ce qui a été fait cette semaine, l'objectif du
   * plan, et le pourcentage d'atteinte. C'est ce % qui donne envie de boucler
   * la semaine — d'où la barre sous chaque carte.
   */
  const stats = [
    {
      key: 'swim' as PlanDiscipline,
      label: 'Natation',
      done: weeklyStats.swimDistance,
      doneDuration: weeklyStats.swimDuration,
      unit: 'km',
      decimals: 2,
      icon: Droplet,
      color: 'text-sport-swim',
      bar: 'bg-sport-swim',
      glow: 'hover:shadow-neon-cyan hover:border-sport-swim/50',
    },
    {
      key: 'bike' as PlanDiscipline,
      label: 'Vélo',
      done: weeklyStats.bikeDistance,
      doneDuration: weeklyStats.bikeDuration,
      unit: 'km',
      decimals: 1,
      icon: Bike,
      color: 'text-sport-bike',
      bar: 'bg-sport-bike',
      glow: 'hover:shadow-neon-green hover:border-sport-bike/50',
    },
    {
      key: 'run' as PlanDiscipline,
      label: 'Course',
      done: weeklyStats.runDistance,
      doneDuration: weeklyStats.runDuration,
      unit: 'km',
      decimals: 2,
      icon: Wind,
      color: 'text-sport-run',
      bar: 'bg-sport-run',
      glow: 'hover:shadow-neon-pink hover:border-sport-run/50',
    },
    {
      key: 'strength' as PlanDiscipline,
      label: 'Musculation',
      done: weeklyStats.strengthSessions,
      doneDuration: weeklyStats.strengthDuration,
      unit: 'séances',
      decimals: 0,
      icon: Zap,
      color: 'text-sport-strength',
      bar: 'bg-sport-strength',
      glow: 'hover:shadow-neon-purple hover:border-sport-strength/50',
    },
  ];

  // Totaux affichés : semaine en cours ou historique complet.
  const shown = period === 'week' ? weeklyStats : allTimeStats;
  const periodLabel = period === 'week' ? 'cette semaine' : 'depuis le début';

  return (
    <div className="space-y-6">
      {/* Race Countdown Banner */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4 border-primary-400/30">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">{RACE.name}</p>
          <p className="text-3xl font-bold text-primary-300 text-glow-cyan font-mono">
            J-{raceDays} <span className="text-base text-slate-400 font-body">avant la course</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">
            Plan : semaine {progress.weekNumber}/{progress.totalWeeks} · {progress.pct}%
          </p>
          <div className="w-40 bg-cyber-bg rounded-full h-2 border border-cyber-line overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-sport-run via-sport-strength to-primary-400 shadow-neon-cyan transition-all duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-600 font-mono mt-1">{progress.phaseLabel}</p>
        </div>
      </div>

      {/* Strava connection */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link2 className={`w-4 h-4 ${stravaConnected ? 'text-sport-bike' : 'text-slate-500'}`} />
          <span className={stravaConnected ? 'text-sport-bike' : 'text-slate-400'}>
            {stravaConnected ? 'Strava connecté' : 'Strava non connecté'}
          </span>
          {lastSyncCount !== null && (
            <span className="text-slate-600 font-mono">· {lastSyncCount} activités synchronisées</span>
          )}
        </div>
        {stravaConnected ? (
          <button
            onClick={onSyncStrava}
            disabled={syncing}
            className="flex items-center gap-2 bg-primary-600/20 border border-primary-400/50 text-primary-300 px-3 py-1.5 rounded-lg hover:bg-primary-600/30 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        ) : (
          <button
            onClick={onConnectStrava}
            className="flex items-center gap-2 bg-orange-500/20 border border-orange-400/50 text-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-500/30 text-sm font-medium"
          >
            <Link2 className="w-4 h-4" />
            Connecter Strava
          </button>
        )}
      </div>

      {/* Health Connect — lecture sur l'appareil, donc app Android seulement */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <HeartPulse
            className={`w-4 h-4 shrink-0 ${healthConnected ? 'text-sport-strength' : 'text-slate-500'}`}
          />
          <span className={healthConnected ? 'text-sport-strength' : 'text-slate-400'}>
            {!healthSupported
              ? 'Health Connect'
              : healthConnected
                ? 'Health Connect connecté'
                : 'Health Connect non connecté'}
          </span>
          {healthSupported && lastHealthSyncCount !== null && (
            <span className="text-slate-600 font-mono">· {lastHealthSyncCount} entrées synchronisées</span>
          )}
          {healthSupported && healthError && (
            <span className="text-sport-run font-mono truncate">
              · {HEALTH_ERROR_LABELS[healthError] ?? healthError}
            </span>
          )}
        </div>

        {!healthSupported ? (
          <span className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <Smartphone className="w-4 h-4" />
            Disponible dans l&apos;app Android
          </span>
        ) : healthConnected ? (
          <button
            onClick={onSyncHealth}
            disabled={healthSyncing}
            className="flex items-center gap-2 bg-primary-600/20 border border-primary-400/50 text-primary-300 px-3 py-1.5 rounded-lg hover:bg-primary-600/30 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${healthSyncing ? 'animate-spin' : ''}`} />
            {healthSyncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        ) : (
          <button
            onClick={onConnectHealth}
            className="flex items-center gap-2 bg-sport-strength/20 border border-sport-strength/50 text-sport-strength px-3 py-1.5 rounded-lg hover:bg-sport-strength/30 text-sm font-medium"
          >
            <Link2 className="w-4 h-4" />
            Autoriser Health Connect
          </button>
        )}
      </div>

      {/* Récupération du jour (Health Connect) */}
      {todayMetric && (
        <div className="glass-panel p-4 grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-sport-swim shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">Sommeil</div>
              <div className="text-lg text-slate-100 font-mono">
                {todayMetric.sleepMinutes ? formatSleep(todayMetric.sleepMinutes) : '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-sport-run shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">Pas</div>
              <div className="text-lg text-slate-100 font-mono">
                {todayMetric.steps != null ? todayMetric.steps.toLocaleString('fr-CA') : '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-sport-strength shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">FC repos</div>
              <div className="text-lg text-slate-100 font-mono">
                {todayMetric.restingHr != null ? `${todayMetric.restingHr} bpm` : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entraînement du jour — chaque séance se logge en un clic */}
      <div className="glass-panel p-5">
        <button
          onClick={() => todayPlan && setShowToday(true)}
          disabled={!todayPlan}
          className="w-full text-left flex items-center justify-between mb-3 group"
        >
          <h3 className="text-sm font-semibold text-slate-400 group-hover:text-primary-300 uppercase tracking-wide flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Entraînement du jour
          </h3>
          <span className="text-xs text-primary-300 font-mono">Semaine {currentWeek?.weekNumber ?? '—'}/48 →</span>
        </button>

        {todayPlan && todayPlan.sessions.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {todayPlan.sessions.map((s) => {
              const meta = DISCIPLINE_META[s.discipline];
              const done = isSessionDone(s);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 bg-cyber-panel2 border border-cyber-line rounded-lg px-3 py-2"
                >
                  <span className="text-xl">{meta.icon}</span>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold ${meta.color}`}>{s.title}</div>
                    {/* En salle, ni zone FC ni distance : la durée et les mouvements suffisent. */}
                    <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      {s.targetExercises ? (
                        <>
                          <Dumbbell className="w-3 h-3" />
                          {formatDuration(s.targetDurationMin)} · {s.targetExercises.length} exercices
                        </>
                      ) : (
                        <>
                          {s.targetZone.toUpperCase()} · {s.targetBpmMin}-{s.targetBpmMax} bpm ·{' '}
                          {summarizeEffort(s.discipline, s.targetDistanceKm, s.targetDurationMin)}
                        </>
                      )}
                    </div>
                  </div>
                  {done ? (
                    <span className="flex items-center gap-1 text-xs text-sport-bike font-mono shrink-0">
                      <Check className="w-3.5 h-3.5" /> Fait
                    </span>
                  ) : (
                    <button
                      onClick={() => setLogging({ session: s })}
                      className="flex items-center gap-1 text-xs bg-primary-600/20 border border-primary-400/50 text-primary-300 px-2.5 py-1.5 rounded-lg hover:bg-primary-600/30 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" /> Logger
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-500 font-mono text-sm">Repos — aucune séance planifiée aujourd'hui</div>
        )}

        <button
          onClick={() => setLogging({})}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-mono text-slate-500 hover:text-primary-300 border border-dashed border-cyber-line hover:border-primary-400/50 rounded-lg py-2"
        >
          <Plus className="w-3.5 h-3.5" /> Logger un autre entraînement (muscu, séance libre…)
        </button>
      </div>

      {/* Objectifs de la semaine, par discipline */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-primary-300" />
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Objectifs de la semaine {currentWeek ? `— S${currentWeek.weekNumber}` : ''}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const target = weekTargets[stat.key];
            const goal = target.target;
            const pct = goal > 0 ? Math.min(100, Math.round((stat.done / goal) * 100)) : null;
            const reached = pct !== null && pct >= 100;
            return (
              <div key={stat.key} className={`glass-panel p-4 transition-all ${stat.glow}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">{stat.label}</h3>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-100 font-mono">
                    {stat.done.toFixed(stat.decimals)}
                  </span>
                  {goal > 0 && (
                    <span className="text-sm text-slate-500 font-mono">
                      / {goal.toFixed(stat.decimals)} {stat.unit}
                    </span>
                  )}
                  {goal === 0 && <span className="text-sm text-slate-500 font-mono">{stat.unit}</span>}
                </div>

                {pct !== null ? (
                  <>
                    <div className="w-full bg-cyber-bg rounded-full h-2 border border-cyber-line overflow-hidden mt-2">
                      <div
                        className={`h-full ${stat.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1.5 font-mono">
                      <span className={reached ? 'text-sport-bike' : stat.color}>
                        {reached ? 'Objectif atteint 🎯' : `${pct}% de l'objectif`}
                      </span>
                      <span className="text-slate-500">
                        {formatDuration(stat.doneDuration)}
                        {target.targetDurationMin > 0 ? ` / ${formatDuration(target.targetDurationMin)}` : ''}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 mt-2 font-mono">
                    Rien de prévu cette semaine · {formatDuration(stat.doneDuration)} fait
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progression du plan — remplace l'ancien « Race Readiness », qui comparait
          des distances figées et ne disait rien de l'état de forme réel. */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-100 uppercase tracking-wide">Progression du plan</h3>
          <span className="text-xs text-slate-500 font-mono">
            {progress.notStarted
              ? 'Le plan démarre bientôt'
              : `${progress.weeksRemaining} semaines restantes · J-${raceDays}`}
          </span>
        </div>

        <div className="w-full bg-cyber-bg rounded-full h-3 border border-cyber-line overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 via-sport-strength to-sport-run transition-all duration-500"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1.5 font-mono">
          <span>S1</span>
          <span className="text-primary-300">
            Semaine {progress.weekNumber}/{progress.totalWeeks} · {progress.pct}%
          </span>
          <span>S{progress.totalWeeks}</span>
        </div>

        <div className="mt-4 bg-cyber-panel2 border border-cyber-line rounded-lg p-3">
          <div className="text-xs text-primary-300 font-mono uppercase tracking-wide">{progress.phaseLabel}</div>
          <div className="text-sm text-slate-400 mt-0.5">{progress.focus}</div>
        </div>

        {/* Volume de la semaine face au programme */}
        <div className="space-y-3 mt-4">
          {stats.map((stat) => {
            const meta = DISCIPLINE_META[stat.key];
            const goal = weekTargets[stat.key].target;
            const pct = goal > 0 ? Math.min(100, Math.round((stat.done / goal) * 100)) : 0;
            return (
              <div key={stat.key}>
                <div className="flex justify-between text-sm mb-1 font-mono">
                  <span className={`font-medium ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-slate-500">
                    {stat.done.toFixed(stat.decimals)} / {goal.toFixed(stat.decimals)} {stat.unit}
                    {goal > 0 ? ` · ${pct}%` : ''}
                  </span>
                </div>
                <div className="w-full bg-cyber-bg rounded-full h-2.5 border border-cyber-line overflow-hidden">
                  <div className={`h-full ${meta.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totaux — toutes disciplines confondues, marche comprise. La période est
          explicite : les compteurs étaient hebdomadaires sans le dire. */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Totaux ({periodLabel})</h3>
          <div className="flex bg-cyber-panel2 border border-cyber-line rounded-lg p-0.5 text-xs font-mono">
            {[
              { id: 'week' as const, label: 'Semaine' },
              { id: 'all' as const, label: 'Depuis le début' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  period === opt.id ? 'bg-primary-600/25 text-primary-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4">
            <div className="text-sm text-slate-500 mb-1">Entraînements</div>
            <div className="text-3xl font-bold text-slate-100 font-mono">{shown.totalWorkouts}</div>
            <div className="text-xs text-slate-600 font-mono mt-1">{periodLabel}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
              <Flame className="w-4 h-4 text-sport-run" /> Calories
            </div>
            <div className="text-3xl font-bold text-slate-100 font-mono">
              {shown.totalCalories.toLocaleString('fr-CA')}
            </div>
            <div className="text-xs text-slate-600 font-mono mt-1">{periodLabel}</div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-sm text-slate-500 mb-1">Volume total</div>
            <div className="text-3xl font-bold text-slate-100 font-mono">{shown.totalDistance.toFixed(1)}</div>
            <div className="text-xs text-slate-600 font-mono mt-1">
              km · dont marche {shown.walkDistance.toFixed(1)} km
            </div>
          </div>
          <div className="glass-panel p-4">
            <div className="text-sm text-slate-500 mb-1">Temps total</div>
            <div className="text-3xl font-bold text-slate-100 font-mono">{formatDuration(shown.totalDuration)}</div>
            <div className="text-xs text-slate-600 font-mono mt-1">
              muscu {shown.strengthSessions}x · marche {formatDuration(shown.walkDuration)}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weight Trend */}
        {weightData.length > 0 && (
          <div className="glass-panel p-4">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 uppercase tracking-wide">Poids (tendance)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#20233a" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0c0c15', border: '1px solid #20233a', borderRadius: 8, color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="weight" stroke="#22d3ee" strokeWidth={2} dot={{ r: 4, fill: '#22d3ee' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Activités récentes */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100 uppercase tracking-wide">Activités Récentes</h3>
            <button
              onClick={() => setLogging({})}
              className="flex items-center gap-1 text-xs bg-primary-600/20 border border-primary-400/50 text-primary-300 px-2.5 py-1.5 rounded-lg hover:bg-primary-600/30"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {workouts.length === 0 ? (
            <div className="text-slate-500 text-sm font-mono">Aucune activité — connecte Strava ou ajoute-en une manuellement</div>
          ) : (
            <div className="space-y-2">
              {[...workouts]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-2 bg-cyber-panel2 border border-cyber-line rounded-lg px-3 py-2 hover:border-primary-400/50 transition-colors"
                  >
                    <button
                      onClick={() => setSelectedWorkout(w)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <span className="text-lg shrink-0">{ACTIVITY_ICON[w.type]}</span>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-200 truncate">{w.title || w.notes || w.type}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {new Date(w.date).toLocaleDateString('fr-FR')} ·{' '}
                          {summarizeEffort(w.type, w.distance, w.duration)}
                          {w.exercises?.length ? ` · ${w.exercises.length} exos` : ''}
                          {w.elevationGain ? ` · ${w.elevationGain}m D+` : ''}
                          {w.avgWatts ? ` · ${w.avgWatts}W` : ''}
                        </div>
                      </div>
                    </button>
                    {w.source === 'strava' && <span className="text-xs text-orange-400 font-mono shrink-0">Strava</span>}
                    {w.source === 'health_connect' && (
                      <span className="text-xs text-sport-strength font-mono shrink-0">Health</span>
                    )}
                    {isManualWorkout(w.id) && (
                      <button
                        onClick={() => setLogging({ workout: w })}
                        title="Modifier cette activité"
                        className="text-slate-600 hover:text-primary-300 shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* HR Zones Distribution */}
        <div className="glass-panel p-4">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 uppercase tracking-wide">Zones d'Entraînement</h3>
          <div className="space-y-3">
            {Object.entries(zones).map(([key, zone]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1 font-mono">
                  <span className="font-medium text-slate-300">{zone.label}</span>
                  <span className="text-slate-500">{zone.min}-{zone.max} bpm</span>
                </div>
                <div className="w-full bg-cyber-bg rounded-full h-2 border border-cyber-line"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showToday && todayPlan && (
        <WorkoutDetail uid={uid} day={todayPlan} workouts={workouts} onClose={() => setShowToday(false)} />
      )}
      {selectedWorkout && (
        <ActivityDetail
          workout={selectedWorkout}
          onEdit={
            isManualWorkout(selectedWorkout.id)
              ? () => {
                  setLogging({ workout: selectedWorkout });
                  setSelectedWorkout(null);
                }
              : undefined
          }
          onClose={() => setSelectedWorkout(null)}
        />
      )}
      {logging && (
        <LogWorkoutModal
          uid={uid}
          workout={logging.workout}
          plannedSession={logging.session}
          plannedWeekNumber={currentWeekNumber}
          plannedDate={logging.session ? today : undefined}
          onClose={() => setLogging(null)}
        />
      )}
    </div>
  );
}
