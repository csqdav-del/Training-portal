import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Workout, DayPlan, Discipline } from '../types';
import { TRAINING_PLAN } from '../data/trainingPlan';
import WorkoutDetail from './WorkoutDetail';

interface CalendarProps {
  workouts: Workout[];
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const DISCIPLINE_STYLE: Record<Discipline, string> = {
  swim: 'bg-sport-swim/15 text-sport-swim border-sport-swim/40',
  bike: 'bg-sport-bike/15 text-sport-bike border-sport-bike/40',
  run: 'bg-sport-run/15 text-sport-run border-sport-run/40',
  strength: 'bg-sport-strength/15 text-sport-strength border-sport-strength/40',
};

const DISCIPLINE_ICON: Record<Discipline, string> = {
  swim: '🏊',
  bike: '🚴',
  run: '🏃',
  strength: '💪',
};

export default function Calendar({ workouts }: CalendarProps) {
  const rawWeekIndex = TRAINING_PLAN.findIndex((w) => new Date() >= w.startDate && new Date() <= w.endDate);
  const currentWeekIndex = rawWeekIndex === -1 ? 0 : rawWeekIndex;
  const [weekIndex, setWeekIndex] = useState(currentWeekIndex);
  const [selectedDay, setSelectedDay] = useState<DayPlan | null>(null);

  const week = TRAINING_PLAN[weekIndex];

  const hasLoggedWorkout = (date: Date, discipline: Discipline) =>
    workouts.some((w) => w.type === discipline && new Date(w.date).toDateString() === date.toDateString());

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

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mt-6">
        {week.days.map((day) => {
          const isToday = day.date.toDateString() === new Date().toDateString();
          return (
            <div
              key={day.dayIndex}
              onClick={() => setSelectedDay(day)}
              className={`border rounded-lg p-3 min-h-32 cursor-pointer transition-all hover:border-primary-400/60 hover:shadow-neon-cyan ${
                isToday ? 'bg-primary-400/5 border-primary-400/50' : 'bg-cyber-panel2 border-cyber-line'
              }`}
            >
              <div className={`text-sm font-semibold mb-2 font-mono ${isToday ? 'text-primary-300' : 'text-slate-400'}`}>
                {DAY_LABELS[day.dayIndex]}
                <br />
                {format(day.date, 'd MMM', { locale: fr })}
              </div>

              <div className="space-y-1.5">
                {day.sessions.length === 0 ? (
                  <div className="text-xs text-slate-600">Repos</div>
                ) : (
                  day.sessions.map((session, wIdx) => (
                    <div
                      key={wIdx}
                      className={`text-xs px-2 py-1.5 rounded border ${DISCIPLINE_STYLE[session.discipline]} flex items-center justify-between gap-1`}
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

      {selectedDay && <WorkoutDetail day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  );
}
