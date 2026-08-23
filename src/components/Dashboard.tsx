import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplet, Bike, Wind, Zap, Flame, Calendar as CalendarIcon, Link2, RefreshCw } from 'lucide-react';
import { WeeklyStats, TrainingZones, PlanDiscipline, Discipline, Workout } from '../types';
import { RACE, RACE_TARGETS, daysUntilRace, readiness, getWeekForDate, getDayPlan } from '../data/trainingPlan';
import WorkoutDetail from './WorkoutDetail';

interface DashboardProps {
  weeklyStats: WeeklyStats;
  zones: TrainingZones;
  weightData: { date: string; weight: number }[];
  workouts: Workout[];
  stravaConnected: boolean;
  syncing: boolean;
  lastSyncCount: number | null;
  onConnectStrava: () => void;
  onSyncStrava: () => void;
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
  weeklyStats,
  zones,
  weightData,
  workouts,
  stravaConnected,
  syncing,
  lastSyncCount,
  onConnectStrava,
  onSyncStrava,
}: DashboardProps) {
  const [showToday, setShowToday] = useState(false);

  const today = new Date();
  const currentWeek = getWeekForDate(today);
  const todayPlan = getDayPlan(today);
  const raceDays = daysUntilRace(today);
  const overallReadiness = Math.round((readiness('swim') + readiness('bike') + readiness('run')) / 3);

  const stats = [
    {
      label: 'Natation',
      distance: weeklyStats.swimDistance.toFixed(2),
      duration: weeklyStats.swimDuration,
      icon: Droplet,
      color: 'text-sport-swim',
      glow: 'hover:shadow-neon-cyan hover:border-sport-swim/50',
    },
    {
      label: 'Vélo',
      distance: weeklyStats.bikeDistance.toFixed(2),
      duration: weeklyStats.bikeDuration,
      icon: Bike,
      color: 'text-sport-bike',
      glow: 'hover:shadow-neon-green hover:border-sport-bike/50',
    },
    {
      label: 'Course',
      distance: weeklyStats.runDistance.toFixed(2),
      duration: weeklyStats.runDuration,
      icon: Wind,
      color: 'text-sport-run',
      glow: 'hover:shadow-neon-pink hover:border-sport-run/50',
    },
    {
      label: 'Musculation',
      distance: `${weeklyStats.strengthSessions}`,
      duration: 0,
      icon: Zap,
      color: 'text-sport-strength',
      glow: 'hover:shadow-neon-purple hover:border-sport-strength/50',
    },
  ];

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
          <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">Prêt à {overallReadiness}%</p>
          <div className="w-40 bg-cyber-bg rounded-full h-2 border border-cyber-line overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-sport-run via-sport-strength to-primary-400 shadow-neon-cyan"
              style={{ width: `${overallReadiness}%` }}
            />
          </div>
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

      {/* Today's training — clickable */}
      <button
        onClick={() => todayPlan && setShowToday(true)}
        disabled={!todayPlan}
        className="w-full text-left glass-panel p-5 hover:border-primary-400/60 hover:shadow-neon-cyan transition-all disabled:hover:shadow-none"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Entraînement du jour
          </h3>
          <span className="text-xs text-primary-300 font-mono">Semaine {currentWeek?.weekNumber ?? '—'}/48 →</span>
        </div>
        {todayPlan && todayPlan.sessions.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {todayPlan.sessions.map((s, i) => {
              const meta = DISCIPLINE_META[s.discipline];
              return (
                <div key={i} className="flex items-center gap-2 bg-cyber-panel2 border border-cyber-line rounded-lg px-3 py-2">
                  <span className="text-xl">{meta.icon}</span>
                  <div>
                    <div className={`text-sm font-bold ${meta.color}`}>{s.title}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {s.targetZone.toUpperCase()} · {s.targetBpmMin}-{s.targetBpmMax} bpm ·{' '}
                      {s.targetDistanceKm > 0 ? `${s.targetDistanceKm}km` : `${s.targetDurationMin}min`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-500 font-mono text-sm">Repos — aucune séance planifiée aujourd'hui</div>
        )}
      </button>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={`glass-panel p-4 transition-all ${stat.glow}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-400">{stat.label}</h3>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono">{stat.distance}</div>
              <div className="text-xs text-slate-500 mt-1 font-mono">{stat.duration} min</div>
            </div>
          );
        })}
      </div>

      {/* Race Readiness */}
      <div className="glass-panel p-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 uppercase tracking-wide">Race Readiness</h3>
        <div className="space-y-4">
          {(['swim', 'bike', 'run'] as PlanDiscipline[]).map((d) => {
            const meta = DISCIPLINE_META[d];
            const t = RACE_TARGETS[d];
            const pct = readiness(d);
            return (
              <div key={d}>
                <div className="flex justify-between text-sm mb-1 font-mono">
                  <span className={`font-medium ${meta.color}`}>
                    {meta.icon} {meta.label} — {pct}%
                  </span>
                  <span className="text-slate-500">
                    {t.current} / {t.target} {t.unit} · cible {t.paceTarget}
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

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4">
          <div className="text-sm text-slate-500 mb-1">Total Entraînements</div>
          <div className="text-3xl font-bold text-slate-100 font-mono">{weeklyStats.totalWorkouts}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-slate-500 mb-1 flex items-center gap-1">
            <Flame className="w-4 h-4 text-sport-run" /> Calories (semaine)
          </div>
          <div className="text-3xl font-bold text-slate-100 font-mono">{weeklyStats.totalCalories}</div>
        </div>
        <div className="glass-panel p-4">
          <div className="text-sm text-slate-500 mb-1">Volume Total (km)</div>
          <div className="text-3xl font-bold text-slate-100 font-mono">
            {(weeklyStats.swimDistance + weeklyStats.bikeDistance + weeklyStats.runDistance).toFixed(1)}
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
          <h3 className="text-lg font-semibold text-slate-100 mb-4 uppercase tracking-wide">Activités Récentes</h3>
          {workouts.length === 0 ? (
            <div className="text-slate-500 text-sm font-mono">Aucune activité — connecte Strava pour synchroniser</div>
          ) : (
            <div className="space-y-2">
              {[...workouts]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((w) => (
                  <div key={w.id} className="flex items-center justify-between bg-cyber-panel2 border border-cyber-line rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{ACTIVITY_ICON[w.type]}</span>
                      <div className="min-w-0">
                        <div className="text-sm text-slate-200 truncate">{w.notes || w.type}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {new Date(w.date).toLocaleDateString('fr-FR')} · {w.distance ? `${w.distance}km · ` : ''}
                          {w.duration}min
                        </div>
                      </div>
                    </div>
                    {w.source === 'strava' && <span className="text-xs text-orange-400 font-mono shrink-0">Strava</span>}
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

      {showToday && todayPlan && <WorkoutDetail day={todayPlan} onClose={() => setShowToday(false)} />}
    </div>
  );
}
