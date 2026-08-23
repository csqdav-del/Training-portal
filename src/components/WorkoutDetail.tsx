import { X, Target, Heart, Ruler, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DayPlan, Discipline } from '../types';
import { TRAINING_PLAN } from '../data/trainingPlan';

interface WorkoutDetailProps {
  day: DayPlan;
  onClose: () => void;
}

const DISCIPLINE_META: Record<Discipline, { label: string; color: string; glow: string; icon: string }> = {
  swim: { label: 'Natation', color: 'text-sport-swim', glow: 'shadow-neon-cyan border-sport-swim/50', icon: '🏊' },
  bike: { label: 'Vélo', color: 'text-sport-bike', glow: 'shadow-neon-green border-sport-bike/50', icon: '🚴' },
  run: { label: 'Course', color: 'text-sport-run', glow: 'shadow-neon-pink border-sport-run/50', icon: '🏃' },
  strength: { label: 'Force', color: 'text-sport-strength', glow: 'shadow-neon-purple border-sport-strength/50', icon: '💪' },
};

const progressionData = TRAINING_PLAN.map((w) => ({
  week: w.weekNumber,
  Natation: w.volumeSummary.swimKm,
  Vélo: w.volumeSummary.bikeKm,
  Course: w.volumeSummary.runKm,
}));

export default function WorkoutDetail({ day, onClose }: WorkoutDetailProps) {
  const currentWeekNumber = TRAINING_PLAN.find((w) => day.date >= w.startDate && day.date <= w.endDate)?.weekNumber ?? 1;
  const disciplinesInDay = Array.from(new Set(day.sessions.map((s) => s.discipline)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-neon-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 uppercase tracking-wide">
              {format(day.date, 'EEEE d MMMM', { locale: fr })}
            </h2>
            <p className="text-sm text-slate-500 font-mono">Semaine {currentWeekNumber} du plan</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        {day.sessions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono">Repos — aucune séance planifiée</div>
        ) : (
          <div className="space-y-4 mb-8">
            {day.sessions.map((session, idx) => {
              const meta = DISCIPLINE_META[session.discipline];
              return (
                <div key={idx} className={`bg-cyber-panel2 border rounded-lg p-4 ${meta.glow}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{meta.icon}</span>
                    <h3 className={`text-lg font-bold ${meta.color}`}>{session.title}</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-cyber-bg border border-cyber-line rounded-lg p-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <Target className="w-3.5 h-3.5" /> ZONE
                      </div>
                      <div className={`text-lg font-bold font-mono ${meta.color}`}>{session.targetZone.toUpperCase()}</div>
                    </div>
                    <div className="bg-cyber-bg border border-cyber-line rounded-lg p-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <Heart className="w-3.5 h-3.5" /> BPM
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-100">
                        {session.targetBpmMin}-{session.targetBpmMax}
                      </div>
                    </div>
                    <div className="bg-cyber-bg border border-cyber-line rounded-lg p-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <Ruler className="w-3.5 h-3.5" /> DISTANCE
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-100">
                        {session.targetDistanceKm > 0 ? `${session.targetDistanceKm} km` : '—'}
                      </div>
                    </div>
                    <div className="bg-cyber-bg border border-cyber-line rounded-lg p-3">
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <Clock className="w-3.5 h-3.5" /> DURÉE
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-100">{session.targetDurationMin} min</div>
                    </div>
                  </div>

                  <ul className="space-y-1">
                    {session.structure.map((line, i) => (
                      <li key={i} className="text-sm text-slate-400 flex gap-2">
                        <span className={meta.color}>▸</span> {line}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* Progression 12 mois */}
        <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Progression sur 48 semaines {disciplinesInDay.length > 0 && `— ${disciplinesInDay.map((d) => DISCIPLINE_META[d].label).join(' / ')}`}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={progressionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#20233a" />
              <XAxis dataKey="week" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'Semaine', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'km', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0c0c15', border: '1px solid #20233a', borderRadius: 8, color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={currentWeekNumber} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Aujourd\'hui', fill: '#fbbf24', fontSize: 10, position: 'top' }} />
              <Line type="monotone" dataKey="Natation" stroke="#22d3ee" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Vélo" stroke="#34ff9d" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Course" stroke="#ff2fd6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
