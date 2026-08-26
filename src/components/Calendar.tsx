import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Move,
  Pencil,
  Plus,
  CalendarDays,
  CalendarRange,
  ListOrdered,
  Flag,
} from 'lucide-react';
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Workout, DayPlan, Discipline, PlannedSession } from '../types';
import { RACE, TRAINING_PLAN } from '../data/trainingPlan';
import { summarizeEffort } from '../lib/format';
import {
  subscribeToWeekOverrides,
  moveSession,
  resetWeekOverrides,
  applyWeekOverrides,
  EMPTY_OVERRIDES,
  WeekPlanOverrides,
} from '../lib/scheduleOverrides';
import WorkoutDetail from './WorkoutDetail';
import SessionEditor from './SessionEditor';
import WeatherBadge from './WeatherBadge';
import { findDay, describeCode } from '../lib/weather';
import { useWeather } from '../lib/useWeather';
import { rateSession } from '../lib/weatherSuitability';

interface CalendarProps {
  workouts: Workout[];
  uid: string;
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_LABELS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Les trois échelles de lecture du plan : la semaine, le mois, les 48 semaines. */
type CalendarView = 'week' | 'month' | 'plan';

const VIEWS: { id: CalendarView; label: string; icon: typeof CalendarDays }[] = [
  { id: 'week', label: 'Semaine', icon: CalendarDays },
  { id: 'month', label: 'Mois', icon: CalendarRange },
  { id: 'plan', label: 'Plan complet', icon: ListOrdered },
];

const PHASE_STYLE: Record<string, string> = {
  Base: 'bg-sport-swim/15 text-sport-swim border-sport-swim/40',
  Build: 'bg-sport-bike/15 text-sport-bike border-sport-bike/40',
  Peak: 'bg-sport-run/15 text-sport-run border-sport-run/40',
  Taper: 'bg-sport-strength/15 text-sport-strength border-sport-strength/40',
};

const DISCIPLINE_STYLE: Record<Discipline, string> = {
  swim: 'bg-sport-swim/15 text-sport-swim border-sport-swim/40',
  bike: 'bg-sport-bike/15 text-sport-bike border-sport-bike/40',
  run: 'bg-sport-run/15 text-sport-run border-sport-run/40',
  strength: 'bg-sport-strength/15 text-sport-strength border-sport-strength/40',
  walk: 'bg-amber-400/15 text-amber-300 border-amber-400/40',
  other: 'bg-slate-400/15 text-slate-300 border-slate-400/40',
};

const DISCIPLINE_ICON: Record<Discipline, string> = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
  strength: '💪',
  walk: '🚶',
  other: '⚡',
};

export default function Calendar({ workouts, uid }: CalendarProps) {
  const rawWeekIndex = TRAINING_PLAN.findIndex((w) => new Date() >= w.startDate && new Date() <= w.endDate);
  const currentWeekIndex = rawWeekIndex === -1 ? 0 : rawWeekIndex;
  const [weekIndex, setWeekIndex] = useState(currentWeekIndex);
  const [selectedDay, setSelectedDay] = useState<DayPlan | null>(null);
  const [overrides, setOverrides] = useState<WeekPlanOverrides>(EMPTY_OVERRIDES);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ dayIndex: number; session: PlannedSession | null } | null>(null);
  const [view, setView] = useState<CalendarView>('week');
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  // La prévision ne couvre que 7 jours : les semaines plus lointaines n'affichent rien.
  const { forecast } = useWeather();

  const week = TRAINING_PLAN[weekIndex];

  useEffect(() => {
    const unsub = subscribeToWeekOverrides(uid, week.weekNumber, setOverrides);
    return unsub;
  }, [uid, week.weekNumber]);

  // --- Vue mois -------------------------------------------------------------
  // La grille déborde sur les semaines voisines : on liste les jours affichés,
  // puis les semaines du plan qu'ils recouvrent.
  const monthDays = useMemo(() => {
    if (view !== 'month') return [];
    const first = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let d = first; d <= last; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      days.push(d);
    }
    return days;
  }, [view, monthCursor]);

  const monthWeekNumbers = useMemo(() => {
    const numbers = new Set<number>();
    for (const day of monthDays) {
      const w = TRAINING_PLAN.find((p) => day >= p.startDate && day <= p.endDate);
      if (w) numbers.add(w.weekNumber);
    }
    return [...numbers].sort((a, b) => a - b);
  }, [monthDays]);

  // Le mois couvre 5 à 6 semaines : on s'abonne à leurs personnalisations pour
  // que déplacements et séances ajoutées apparaissent au bon jour.
  const [monthOverrides, setMonthOverrides] = useState<Record<number, WeekPlanOverrides>>({});
  const monthWeekKey = monthWeekNumbers.join(',');

  useEffect(() => {
    if (view !== 'month' || monthWeekNumbers.length === 0) return;
    const unsubs = monthWeekNumbers.map((weekNumber) =>
      subscribeToWeekOverrides(uid, weekNumber, (o) =>
        setMonthOverrides((prev) => ({ ...prev, [weekNumber]: o })),
      ),
    );
    return () => unsubs.forEach((unsub) => unsub());
    // monthWeekKey résume la liste : évite de relancer les abonnements à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, view, monthWeekKey]);

  /** Le programme d'un jour donné, personnalisations comprises. */
  const dayPlanFor = (date: Date): DayPlan | undefined => {
    const planWeek = TRAINING_PLAN.find((p) => date >= p.startDate && date <= p.endDate);
    if (!planWeek) return undefined;
    const applied = applyWeekOverrides(planWeek.days, monthOverrides[planWeek.weekNumber] ?? EMPTY_OVERRIDES);
    const day = applied.find((d) => d.date.toDateString() === date.toDateString());
    if (!day) return undefined;
    const edits = (monthOverrides[planWeek.weekNumber] ?? EMPTY_OVERRIDES).edits;
    return { ...day, sessions: day.sessions.filter((s) => !edits[s.id]?.skipped) };
  };

  const effectiveDays = applyWeekOverrides(week.days, overrides);
  const hasOverrides =
    Object.keys(overrides.moves).length > 0 ||
    Object.keys(overrides.edits).length > 0 ||
    Object.keys(overrides.extras).length > 0;

  /**
   * Une séance est cochée si une activité pointe explicitement vers elle (saisie
   * manuelle) ou si un entraînement du même sport a été enregistré ce jour-là.
   */
  const hasLoggedWorkout = (date: Date, session: PlannedSession) =>
    workouts.some(
      (w) =>
        w.plannedSessionId === session.id ||
        (w.type === session.discipline && new Date(w.date).toDateString() === date.toDateString()),
    );

  const handleDrop = (dayIndex: number) => {
    if (draggingId) moveSession(uid, week.weekNumber, draggingId, dayIndex);
    setDraggingId(null);
    setDragOverDay(null);
  };

  return (
    <div className="glass-panel p-6">
      {/* Sélecteur d'échelle : la semaine pour agir, le mois et le plan complet
          pour voir venir jusqu'à la course. */}
      <div className="flex bg-cyber-panel2 border border-cyber-line rounded-lg p-0.5 text-xs font-mono w-fit mb-4">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                view === v.id ? 'bg-primary-600/25 text-primary-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {v.label}
            </button>
          );
        })}
      </div>

      {view === 'week' && (
      <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">
            Semaine {week.weekNumber}/48 — {format(week.startDate, 'd MMM', { locale: fr })} au {format(week.endDate, 'd MMM', { locale: fr })}
          </h2>
          <p className="text-sm text-primary-300 font-mono">{week.phaseLabel} · {week.focus}</p>
        </div>
        <div className="flex gap-2">
          {hasOverrides && (
            <button
              onClick={() => resetWeekOverrides(uid, week.weekNumber)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium hover:bg-cyber-panel2 border border-cyber-line rounded-lg font-mono text-slate-400 hover:text-primary-300"
            >
              <RotateCcw className="w-4 h-4" /> Réinitialiser
            </button>
          )}
          <button
            onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
            disabled={weekIndex === 0}
            className="p-2 hover:bg-cyber-panel2 border border-cyber-line rounded-lg disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setWeekIndex(currentWeekIndex)}
            className="px-3 py-2 text-sm font-medium hover:bg-cyber-panel2 border border-cyber-line rounded-lg font-mono"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setWeekIndex((i) => Math.min(TRAINING_PLAN.length - 1, i + 1))}
            disabled={weekIndex === TRAINING_PLAN.length - 1}
            className="p-2 hover:bg-cyber-panel2 border border-cyber-line rounded-lg disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600 font-mono mb-4 flex items-center gap-1.5">
        <Move className="w-3.5 h-3.5" /> Glisse une séance vers un autre jour (desktop) · ✏️ pour modifier distance, durée ou zone ·
        « + Séance » pour en ajouter une — tout est sauvegardé sur ton compte
      </p>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mt-2">
        {effectiveDays.map((day) => {
          const isToday = day.date.toDateString() === new Date().toDateString();
          const isDragOver = dragOverDay === day.dayIndex;
          const weatherDay = findDay(forecast, day.date);
          return (
            <div
              key={day.dayIndex}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDay(day.dayIndex);
              }}
              onDragLeave={() => setDragOverDay((d) => (d === day.dayIndex ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(day.dayIndex);
              }}
              className={`border rounded-lg p-3 min-h-32 transition-all ${
                isDragOver
                  ? 'bg-primary-400/10 border-primary-400 shadow-neon-cyan'
                  : isToday
                  ? 'bg-primary-400/5 border-primary-400/50'
                  : 'bg-cyber-panel2 border-cyber-line'
              }`}
            >
              <div
                onClick={() => setSelectedDay(day)}
                className={`text-sm font-semibold mb-2 font-mono cursor-pointer ${isToday ? 'text-primary-300' : 'text-slate-400'}`}
              >
                {DAY_LABELS[day.dayIndex]}
                <br />
                {format(day.date, 'd MMM', { locale: fr })}
              </div>

              {weatherDay && (
                <div
                  className="text-[11px] font-mono text-slate-500 mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
                  title={`${describeCode(weatherDay.code).label} · ressenti ${Math.round(
                    weatherDay.feelsLikeMinC,
                  )} à ${Math.round(weatherDay.feelsLikeMaxC)} °C · vent max ${Math.round(
                    weatherDay.windMaxKmh,
                  )} km/h · ${weatherDay.precipSumMm.toFixed(1)} mm (${Math.round(weatherDay.precipProbMax)} %)`}
                >
                  <span>{describeCode(weatherDay.code).icon}</span>
                  <span className="text-slate-400">{Math.round(weatherDay.tempMaxC)}°</span>
                  <span className="text-slate-600">{Math.round(weatherDay.tempMinC)}°</span>
                  <span className="text-slate-600">{Math.round(weatherDay.windMaxKmh)} km/h</span>
                  {/* La pluie décide d'une sortie : elle doit se lire sans survoler. */}
                  {weatherDay.precipSumMm >= 0.2 ? (
                    <span className="text-sport-swim">{weatherDay.precipSumMm.toFixed(1)} mm</span>
                  ) : weatherDay.precipProbMax >= 40 ? (
                    <span className="text-slate-600">{Math.round(weatherDay.precipProbMax)} %</span>
                  ) : null}
                </div>
              )}

              <div className="space-y-1.5">
                {day.sessions.length === 0 ? (
                  <div className="text-xs text-slate-600">Repos</div>
                ) : (
                  day.sessions.map((session) => {
                    const isSkipped = Boolean(overrides.edits[session.id]?.skipped);
                    // Séance troquée contre un autre sport : on la barre mais on
                    // affiche le sport réellement pratiqué pour garder la trace.
                    const replacedBy = overrides.edits[session.id]?.replacedBy;
                    const isCustom =
                      Boolean(overrides.extras[session.id]) ||
                      Object.keys(overrides.edits[session.id] ?? {}).some((k) => k !== 'skipped');
                    // Pastille météo : seulement pour une séance extérieure encore d'actualité.
                    const weather =
                      isSkipped || replacedBy
                        ? null
                        : rateSession(session.discipline, weatherDay, session.targetDurationMin);
                    return (
                      <div
                        key={session.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', session.id);
                          setDraggingId(session.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverDay(null);
                        }}
                        onClick={() => setSelectedDay(day)}
                        className={`text-xs px-2 py-1.5 rounded border cursor-grab active:cursor-grabbing ${DISCIPLINE_STYLE[session.discipline]} flex items-center justify-between gap-1 ${
                          draggingId === session.id ? 'opacity-40' : ''
                        } ${isSkipped || replacedBy ? 'opacity-40 line-through' : ''}`}
                        title={replacedBy ? `${session.title} — remplacée` : session.title}
                      >
                        <span className="truncate">
                          {DISCIPLINE_ICON[session.discipline]}{' '}
                          {session.targetDistanceKm > 0 ? `${session.targetDistanceKm}km` : `${session.targetDurationMin}min`}
                          {isCustom && <span className="text-[10px] ml-1 opacity-70">•</span>}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {weather && <WeatherBadge verdict={weather} variant="dot" />}
                          {replacedBy && (
                            <span className="no-underline" title={`Remplacée par : ${replacedBy}`}>
                              → {DISCIPLINE_ICON[replacedBy]}
                            </span>
                          )}
                          {hasLoggedWorkout(day.date, session) && !isSkipped && !replacedBy && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-sport-bike" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing({ dayIndex: day.dayIndex, session });
                            }}
                            title="Modifier la séance"
                            className="opacity-60 hover:opacity-100"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}

                <button
                  onClick={() => setEditing({ dayIndex: day.dayIndex, session: null })}
                  className="w-full flex items-center justify-center gap-1 text-[11px] font-mono text-slate-600 hover:text-primary-300 border border-dashed border-cyber-line hover:border-primary-400/50 rounded py-1"
                >
                  <Plus className="w-3 h-3" /> Séance
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Résumé volume semaine */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-mono">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-sport-swim rounded shadow-neon-cyan"></div>
          <span className="text-slate-400">Natation: {week.volumeSummary.swimKm} km</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-sport-bike rounded shadow-neon-green"></div>
          <span className="text-slate-400">Vélo: {week.volumeSummary.bikeKm} km</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-sport-run rounded shadow-neon-pink"></div>
          <span className="text-slate-400">Course: {week.volumeSummary.runKm} km</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-sport-strength rounded shadow-neon-purple"></div>
          <span className="text-slate-400">Force: {week.volumeSummary.strengthSessions}x</span>
        </div>
      </div>
      </>
      )}

      {/* ---------------------------- Vue mois ---------------------------- */}
      {view === 'month' && (
        <>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">
              {format(monthCursor, 'MMMM yyyy', { locale: fr })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMonthCursor((m) => addMonths(m, -1))}
                className="p-2 hover:bg-cyber-panel2 border border-cyber-line rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setMonthCursor(startOfMonth(new Date()))}
                className="px-3 py-2 text-sm font-medium hover:bg-cyber-panel2 border border-cyber-line rounded-lg font-mono"
              >
                Ce mois-ci
              </button>
              <button
                onClick={() => setMonthCursor((m) => addMonths(m, 1))}
                className="p-2 hover:bg-cyber-panel2 border border-cyber-line rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS_SHORT.map((label, i) => (
              <div key={i} className="text-center text-[11px] text-slate-600 font-mono uppercase py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((date) => {
              const plan = dayPlanFor(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const inMonth = isSameMonth(date, monthCursor);
              const isRace = date.toDateString() === RACE.date.toDateString();
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => plan && setSelectedDay(plan)}
                  className={`min-h-[4.5rem] border rounded-lg p-1.5 text-left transition-all ${
                    isRace
                      ? 'bg-amber-400/10 border-amber-400/60'
                      : isToday
                        ? 'bg-primary-400/5 border-primary-400/50'
                        : 'bg-cyber-panel2 border-cyber-line hover:border-primary-400/40'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  <div
                    className={`text-[11px] font-mono mb-1 ${isToday ? 'text-primary-300' : 'text-slate-500'}`}
                  >
                    {format(date, 'd')}
                    {isRace && <span className="ml-1 text-amber-300">🏁</span>}
                  </div>
                  <div className="space-y-0.5">
                    {plan?.sessions.map((session) => (
                      <div
                        key={session.id}
                        title={`${session.title} — ${summarizeEffort(
                          session.discipline,
                          session.targetDistanceKm,
                          session.targetDurationMin,
                        )}`}
                        className={`text-[10px] px-1 py-0.5 rounded border truncate flex items-center gap-0.5 ${
                          DISCIPLINE_STYLE[session.discipline]
                        }`}
                      >
                        <span>{DISCIPLINE_ICON[session.discipline]}</span>
                        <span className="truncate">
                          {session.targetDistanceKm > 0
                            ? `${session.targetDistanceKm}km`
                            : `${session.targetDurationMin}min`}
                        </span>
                        {hasLoggedWorkout(date, session) && (
                          <CheckCircle2 className="w-2.5 h-2.5 text-sport-bike shrink-0 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-600 font-mono mt-3">
            Clique un jour pour ouvrir le détail des séances · 🏁 = jour de course
          </p>
        </>
      )}

      {/* ------------------------ Vue plan complet ------------------------ */}
      {view === 'plan' && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">
              Plan complet — 48 semaines
            </h2>
            <span className="text-sm text-primary-300 font-mono flex items-center gap-1.5">
              <Flag className="w-4 h-4" /> {RACE.name} · {format(RACE.date, 'd MMMM yyyy', { locale: fr })}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {TRAINING_PLAN.map((w) => {
              const isCurrent = w.weekNumber === TRAINING_PLAN[currentWeekIndex].weekNumber;
              const isPast = w.endDate < new Date();
              return (
                <button
                  key={w.weekNumber}
                  onClick={() => {
                    setWeekIndex(w.weekNumber - 1);
                    setView('week');
                  }}
                  className={`w-full text-left border rounded-lg px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 transition-all ${
                    isCurrent
                      ? 'bg-primary-400/10 border-primary-400/60 shadow-neon-cyan'
                      : 'bg-cyber-panel2 border-cyber-line hover:border-primary-400/40'
                  } ${isPast && !isCurrent ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`text-sm font-mono font-bold w-12 shrink-0 ${
                      isCurrent ? 'text-primary-300' : 'text-slate-400'
                    }`}
                  >
                    S{w.weekNumber}
                  </span>
                  <span className="text-xs text-slate-500 font-mono w-32 shrink-0">
                    {format(w.startDate, 'd MMM', { locale: fr })} – {format(w.endDate, 'd MMM yy', { locale: fr })}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                      PHASE_STYLE[w.phase] ?? 'border-cyber-line text-slate-400'
                    }`}
                  >
                    {w.phase}
                  </span>
                  <span className="text-xs font-mono text-slate-400 flex gap-3 flex-wrap">
                    <span className="text-sport-swim">🏊 {w.volumeSummary.swimKm}km</span>
                    <span className="text-sport-bike">🚴 {w.volumeSummary.bikeKm}km</span>
                    <span className="text-sport-run">🏃 {w.volumeSummary.runKm}km</span>
                    <span className="text-sport-strength">💪 {w.volumeSummary.strengthSessions}x</span>
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-primary-300 font-mono ml-auto shrink-0">◀ en cours</span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-600 font-mono mt-3">
            Clique une semaine pour l'ouvrir en détail
          </p>
        </>
      )}

      {selectedDay && (
        <WorkoutDetail uid={uid} day={selectedDay} workouts={workouts} onClose={() => setSelectedDay(null)} />
      )}

      {editing && (
        <SessionEditor
          uid={uid}
          weekNumber={week.weekNumber}
          dayIndex={editing.dayIndex}
          dayLabel={DAY_LABELS[editing.dayIndex]}
          session={editing.session}
          isExtra={Boolean(editing.session && overrides.extras[editing.session.id])}
          currentEdit={editing.session ? overrides.edits[editing.session.id] : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
