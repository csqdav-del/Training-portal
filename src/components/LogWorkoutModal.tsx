import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Discipline, PlannedSession, StrengthExercise, Workout } from '../types';
import {
  COMMON_EXERCISES,
  addManualWorkout,
  deleteManualWorkout,
  isManualWorkout,
  updateManualWorkout,
} from '../lib/manualWorkout';
import { setSessionReplaced } from '../lib/scheduleOverrides';

interface LogWorkoutModalProps {
  uid: string;
  /** Activité manuelle existante à modifier. Absent = nouvelle saisie. */
  workout?: Workout | null;
  /** Séance du plan qu'on valide ou remplace — pré-remplit le formulaire. */
  plannedSession?: PlannedSession | null;
  plannedWeekNumber?: number;
  /** Date de la séance planifiée (le plan ne porte la date que sur le jour). */
  plannedDate?: Date;
  onClose: () => void;
}

const DISCIPLINES: { value: Discipline; label: string; icon: string }[] = [
  { value: 'swim', label: 'Natation', icon: '🏊' },
  { value: 'bike', label: 'Vélo', icon: '🚴' },
  { value: 'run', label: 'Course', icon: '🏃' },
  { value: 'strength', label: 'Muscu', icon: '💪' },
  { value: 'walk', label: 'Marche', icon: '🚶' },
  { value: 'other', label: 'Autre', icon: '⚡' },
];

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  swim: 'Natation',
  bike: 'Vélo',
  run: 'Course',
  strength: 'Musculation',
  walk: 'Marche',
  other: 'Autre',
};

const inputClass =
  'w-full bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-primary-400 focus:outline-none';
const labelClass = 'block text-[11px] text-slate-500 uppercase tracking-wide mb-1 font-mono';

/** Les disciplines sans distance mesurable : on masque le champ pour ne pas encombrer. */
const DISTANCE_LESS: Discipline[] = ['strength', 'other'];

function emptyExercise(): StrengthExercise {
  return { name: '', sets: undefined, reps: undefined, weightLbs: undefined };
}

function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default function LogWorkoutModal({
  uid,
  workout,
  plannedSession,
  plannedWeekNumber,
  plannedDate,
  onClose,
}: LogWorkoutModalProps) {
  const isEditing = Boolean(workout);
  const canDelete = Boolean(workout && isManualWorkout(workout.id));

  // Le jour vient de l'activité modifiée ou de la séance planifiée ; l'heure,
  // elle, part de maintenant — le plan ne porte que des dates à minuit.
  const initialDate = workout ? new Date(workout.date) : plannedDate ?? new Date();

  const [type, setType] = useState<Discipline>(workout?.type ?? plannedSession?.discipline ?? 'strength');
  const [title, setTitle] = useState(workout?.title ?? plannedSession?.title ?? '');
  const [date, setDate] = useState(format(initialDate, 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(workout ? initialDate : new Date(), 'HH:mm'));
  const [duration, setDuration] = useState(
    workout ? String(workout.duration) : plannedSession ? String(plannedSession.targetDurationMin) : '',
  );
  const [distance, setDistance] = useState(
    workout?.distance != null
      ? String(workout.distance)
      : plannedSession && plannedSession.targetDistanceKm > 0
        ? String(plannedSession.targetDistanceKm)
        : '',
  );
  const [calories, setCalories] = useState(workout?.calories != null ? String(workout.calories) : '');
  const [hr, setHr] = useState(workout?.heartRate ? String(workout.heartRate.avg) : '');
  const [rpe, setRpe] = useState(workout?.rpe != null ? String(workout.rpe) : '');
  const [notes, setNotes] = useState(workout?.notes ?? '');
  const [exercises, setExercises] = useState<StrengthExercise[]>(
    workout?.exercises?.length ? workout.exercises : [emptyExercise()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quand la discipline saisie diffère de celle du plan, c'est un remplacement
  // (la piscine est fermée → muscu). On propose de le noter sur le calendrier.
  const isSubstitution = Boolean(plannedSession && type !== plannedSession.discipline);
  const [markReplaced, setMarkReplaced] = useState(true);

  const showDistance = !DISTANCE_LESS.includes(type);
  const showExercises = type === 'strength';

  const totalVolume = exercises.reduce(
    (sum, e) => sum + (e.sets ?? 0) * (e.reps ?? 0) * (e.weightLbs ?? 0),
    0,
  );

  const updateExercise = (index: number, patch: Partial<StrengthExercise>) =>
    setExercises((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const handleSave = async () => {
    const minutes = toNumber(duration);
    if (!minutes || minutes <= 0) {
      setError('Indique au moins une durée.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutesOfDay] = time.split(':').map(Number);
      const when = new Date(year, month - 1, day, hours || 0, minutesOfDay || 0);

      const input = {
        type,
        date: when,
        duration: minutes,
        title: title.trim() || undefined,
        distance: showDistance ? toNumber(distance) : undefined,
        calories: toNumber(calories),
        heartRateAvg: toNumber(hr),
        rpe: toNumber(rpe),
        exercises: showExercises ? exercises.filter((e) => e.name.trim() !== '') : undefined,
        notes: notes.trim() || undefined,
        // En modification, on conserve le lien d'origine vers le plan plutôt que
        // de le réécrire avec la semaine courante.
        plannedSessionId: workout ? workout.plannedSessionId : plannedSession?.id,
        plannedWeekNumber: workout ? workout.plannedWeekNumber : plannedWeekNumber,
      };

      if (workout && isManualWorkout(workout.id)) {
        await updateManualWorkout(uid, workout.id, input);
      } else {
        await addManualWorkout(uid, input);
      }

      // On marque la séance du plan comme troquée pour qu'elle apparaisse
      // clairement au calendrier plutôt que de rester « à faire ».
      if (plannedSession && plannedWeekNumber && isSubstitution && markReplaced) {
        await setSessionReplaced(uid, plannedWeekNumber, plannedSession.id, type);
      }

      onClose();
    } catch (err) {
      console.error('Enregistrement de l’entraînement impossible', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workout) return;
    if (!window.confirm('Supprimer cette activité ?')) return;
    setSaving(true);
    try {
      await deleteManualWorkout(uid, workout.id);
      onClose();
    } catch (err) {
      console.error('Suppression impossible', err);
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-lg max-h-[90vh] flex flex-col shadow-neon-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3 border-b border-cyber-line shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide">
              {isEditing ? 'Modifier l’entraînement' : 'Logger un entraînement'}
            </h2>
            {plannedSession ? (
              <p className="text-xs text-slate-500 font-mono truncate">
                Prévu : {plannedSession.title}
                {plannedDate ? ` · ${format(plannedDate, 'EEEE d MMM', { locale: fr })}` : ''}
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-mono">Reste dans le portail — rien n’est envoyé à Strava</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 pt-4 min-h-0 space-y-4">
          <div>
            <label className={labelClass}>Discipline</label>
            <div className="grid grid-cols-6 gap-1.5">
              {DISCIPLINES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setType(d.value)}
                  title={d.label}
                  className={`py-2 rounded-lg border text-lg transition-colors ${
                    type === d.value
                      ? 'bg-primary-600/20 border-primary-400/60 text-primary-300'
                      : 'bg-cyber-bg border-cyber-line hover:border-primary-400/40'
                  }`}
                >
                  {d.icon}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 font-mono mt-1">{DISCIPLINE_LABEL[type]}</p>
          </div>

          {isSubstitution && plannedSession && plannedWeekNumber && (
            <label className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/40 rounded-lg p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={markReplaced}
                onChange={(e) => setMarkReplaced(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <span className="text-xs text-amber-200 font-mono leading-relaxed">
                Remplace la séance prévue ({DISCIPLINE_LABEL[plannedSession.discipline]}) — elle sera barrée au
                calendrier avec la mention {DISCIPLINE_LABEL[type]}.
              </span>
            </label>
          )}

          <div>
            <label className={labelClass}>Nom de la séance</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'strength' ? 'Ex. Push day — haut du corps' : 'Ex. Sortie facile'}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Heure</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className={`grid gap-3 ${showDistance ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className={labelClass}>Durée (min) *</label>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={inputClass}
              />
            </div>
            {showDistance && (
              <div>
                <label className={labelClass}>Distance (km)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Calories</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>BPM moy</label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Effort /10</label>
              <input
                type="number"
                min="1"
                max="10"
                inputMode="numeric"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {showExercises && (
            <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] text-slate-400 uppercase tracking-wide font-mono flex items-center gap-1.5">
                  <Dumbbell className="w-3.5 h-3.5" /> Exercices
                </h3>
                {totalVolume > 0 && (
                  <span className="text-[11px] text-primary-300 font-mono">
                    Volume : {totalVolume.toLocaleString('fr-CA')} lbs
                  </span>
                )}
              </div>

              <datalist id="exercise-suggestions">
                {COMMON_EXERCISES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <div className="space-y-2">
                <div className="hidden sm:grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem_1.75rem] gap-1.5 text-[10px] text-slate-600 uppercase font-mono px-1">
                  <span>Exercice</span>
                  <span>Séries</span>
                  <span>Reps</span>
                  <span>Lbs</span>
                  <span />
                </div>
                {exercises.map((ex, i) => (
                  <div key={i} className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem_1.75rem] gap-1.5">
                    <input
                      list="exercise-suggestions"
                      value={ex.name}
                      onChange={(e) => updateExercise(i, { name: e.target.value })}
                      placeholder="Exercice"
                      className="bg-cyber-bg border border-cyber-line rounded px-2 py-1.5 text-sm text-slate-100 min-w-0 focus:border-primary-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={ex.sets ?? ''}
                      onChange={(e) => updateExercise(i, { sets: toNumber(e.target.value) })}
                      className="bg-cyber-bg border border-cyber-line rounded px-1.5 py-1.5 text-sm text-slate-100 font-mono min-w-0 focus:border-primary-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={ex.reps ?? ''}
                      onChange={(e) => updateExercise(i, { reps: toNumber(e.target.value) })}
                      className="bg-cyber-bg border border-cyber-line rounded px-1.5 py-1.5 text-sm text-slate-100 font-mono min-w-0 focus:border-primary-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={ex.weightLbs ?? ''}
                      onChange={(e) => updateExercise(i, { weightLbs: toNumber(e.target.value) })}
                      className="bg-cyber-bg border border-cyber-line rounded px-1.5 py-1.5 text-sm text-slate-100 font-mono min-w-0 focus:border-primary-400 focus:outline-none"
                    />
                    <button
                      onClick={() => setExercises((rows) => rows.filter((_, idx) => idx !== i))}
                      title="Retirer l’exercice"
                      className="text-slate-600 hover:text-sport-run flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setExercises((rows) => [...rows, emptyExercise()])}
                className="w-full mt-2 flex items-center justify-center gap-1 text-[11px] font-mono text-slate-500 hover:text-primary-300 border border-dashed border-cyber-line hover:border-primary-400/50 rounded py-1.5"
              >
                <Plus className="w-3 h-3" /> Exercice
              </button>
            </div>
          )}

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex. piscines fermées cette semaine, remplacé par du gym"
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-sport-run font-mono">{error}</p>}
        </div>

        <div className="p-5 pt-3 border-t border-cyber-line shrink-0 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary-600/20 border border-primary-400/50 text-primary-300 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600/30 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Enregistrer l’entraînement'}
          </button>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={saving}
              title="Supprimer"
              className="px-3 py-2.5 border border-cyber-line rounded-lg text-slate-500 hover:text-sport-run hover:border-sport-run/50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
