import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, RotateCcw, Move } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Workout, DayPlan, Discipline, PlannedSession } from '../types';
import { TRAINING_PLAN } from '../data/trainingPlan';
import { subscribeToWeekOverrides, moveSession, resetWeekOverrides, WeekOverrides } from '../lib/scheduleOverrides';
import WorkoutDetail from './WorkoutDetail';

interface CalendarProps {
  workouts: Workout[];
  uid: string;
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

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

function applyOverrides(days: DayPlan[], overrides: WeekOverrides): DayPlan[] {
  const bucket: PlannedSession[][] = [[], [], [], [], [], [], []];
  for (const day of days) {
    for (const session of day.sessions) {
      const target = overrides[session.id] ?? day.dayIndex;
      const safeTarget = target >= 0 && target <= 6 ? target : day.dayIndex;
      bucket[safeTarget].push(session);
    }
  }
  return days.map((day) => ({ ...day, sessions: bucket[day.dayIndex] }));
}

export default function Calendar({ workouts, uid }: CalendarProps) {
  const rawWeekIndex = TRAINING_PLAN.findIndex((w) => new Date() >= w.startDate && new Date() <= w.endDate);
  const currentWeekIndex = rawWeekIndex === -1 ? 0 : rawWeekIndex;
  const [weekIndex, setWeekIndex] = useState(currentWeekIndex);
  const [selectedDay, setSelectedDay] = useState<DayPlan | null>(null);
  const [overrides, setOverrides] = useState<WeekOverrides>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const week = TRAINING_PLAN[weekIndex];

  useEffect(() => {
    const unsub = subscribeToWeekOverrides(uid, week.weekNumber, setOverrides);
    return unsub;
  }, [uid, week.weekNumber]);

  const effectiveDays = applyOverrides(week.days, overrides);
  const hasOverrides = Object.keys(overrides).length > 0;

  const hasLoggedWorkout = (date: Date, discipline: Discipline) =>
    workouts.some((w) => w.type === discipline && new Date(w.date).toDateString() === date.toDateString());

  const handleDrop = (dayIndex: number) => {
    if (draggingId) moveSession(uid, week.weekNumber, draggingId, dayIndex);
    setDraggingId(null);
    setDragOverDay(null);
  };

  return (
    <div className="glass-panel p-6">
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
              onClick={() => resetWeekOverrides(uid, week.weekNumber, Object.keys(overrides))}
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
        <Move className="w-3.5 h-3.5" /> Glisse une séance vers un autre jour pour l'adapter à ton horaire (desktop uniquement)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mt-2">
        {effectiveDays.map((day) => {
          const isToday = day.date.toDateString() === new Date().toDateString();
          const isDragOver = dragOverDay === day.dayIndex;
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

              <div className="space-y-1.5">
                {day.sessions.length === 0 ? (
                  <div className="text-xs text-slate-600">Repos</div>
                ) : (
                  day.sessions.map((session) => (
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
                      }`}
                      title={session.title}
                    >
                      <span className="truncate">
                        {DISCIPLINE_ICON[session.discipline]} {session.targetDistanceKm > 0 ? `${session.targetDistanceKm}km` : `${session.targetDurationMin}min`}
                      </span>
                      {hasLoggedWorkout(day.date, session.discipline) && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sport-bike shrink-0" />
                      )}
                    </div>
                  ))
                )}
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

      {selectedDay && <WorkoutDetail day={selectedDay} workouts={workouts} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}
