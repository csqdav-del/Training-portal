import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { PlanDiscipline, PlannedSession, ZoneKey } from '../types';
import { HR_ZONES } from '../data/trainingPlan';
import {
  SessionEdit,
  addExtraSession,
  removeExtraSession,
  resetSession,
  setSessionSkipped,
  updateSession,
} from '../lib/scheduleOverrides';

interface SessionEditorProps {
  uid: string;
  weekNumber: number;
  dayIndex: number;
  dayLabel: string;
  /** Séance existante à modifier, ou null pour en créer une nouvelle. */
  session: PlannedSession | null;
  /** true si la séance vient de `extras` (donc supprimable). */
  isExtra: boolean;
  currentEdit?: SessionEdit;
  onClose: () => void;
}

const DISCIPLINES: { value: PlanDiscipline; label: string; icon: string }[] = [
  { value: 'swim', label: 'Natation', icon: '🏊' },
  { value: 'bike', label: 'Vélo', icon: '🚴' },
  { value: 'run', label: 'Course', icon: '🏃' },
  { value: 'strength', label: 'Force', icon: '💪' },
];

const ZONES: ZoneKey[] = ['z1', 'z2', 'z3', 'z4', 'z5'];

const inputClass =
  'w-full bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-primary-400 focus:outline-none';
const labelClass = 'block text-[11px] text-slate-500 uppercase tracking-wide mb-1 font-mono';

export default function SessionEditor({
  uid,
  weekNumber,
  dayIndex,
  dayLabel,
  session,
  isExtra,
  currentEdit,
  onClose,
}: SessionEditorProps) {
  const isNew = session === null;
  const [discipline, setDiscipline] = useState<PlanDiscipline>(session?.discipline ?? 'bike');
  const [title, setTitle] = useState(session?.title ?? '');
  const [zone, setZone] = useState<ZoneKey>(session?.targetZone ?? 'z2');
  const [distance, setDistance] = useState(session ? String(session.targetDistanceKm) : '');
  const [duration, setDuration] = useState(session ? String(session.targetDurationMin) : '');
  const [notes, setNotes] = useState(currentEdit?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const skipped = Boolean(currentEdit?.skipped);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await addExtraSession(uid, weekNumber, {
          dayIndex,
          discipline,
          title: title.trim() || `${DISCIPLINES.find((d) => d.value === discipline)?.label} — séance libre`,
          targetZone: zone,
          targetDistanceKm: parseFloat(distance) || 0,
          targetDurationMin: parseInt(duration, 10) || 0,
          notes: notes.trim() || undefined,
        });
      } else {
        await updateSession(uid, weekNumber, session.id, {
          title: title.trim() || undefined,
          targetZone: zone,
          targetDistanceKm: distance === '' ? undefined : parseFloat(distance),
          targetDurationMin: duration === '' ? undefined : parseInt(duration, 10),
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSkipToggle = async () => {
    if (!session) return;
    await setSessionSkipped(uid, weekNumber, session.id, !skipped);
    onClose();
  };

  const handleReset = async () => {
    if (!session) return;
    await resetSession(uid, weekNumber, session.id);
    onClose();
  };

  const handleDelete = async () => {
    if (!session) return;
    await removeExtraSession(uid, weekNumber, session.id);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-panel w-full max-w-md shadow-neon-cyan" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3 border-b border-cyber-line">
          <div>
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wide">
              {isNew ? 'Ajouter une séance' : 'Modifier la séance'}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Semaine {weekNumber} · {dayLabel}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isNew && (
            <div>
              <label className={labelClass}>Discipline</label>
              <div className="grid grid-cols-4 gap-2">
                {DISCIPLINES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDiscipline(d.value)}
                    className={`py-2 rounded-lg border text-sm transition-colors ${
                      discipline === d.value
                        ? 'bg-primary-600/20 border-primary-400/60 text-primary-300'
                        : 'bg-cyber-bg border-cyber-line text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Titre</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={session?.title ?? 'Ex. Vélo — sortie longue'}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Distance (km)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Durée (min)</label>
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Zone cible</label>
            <div className="grid grid-cols-5 gap-2">
              {ZONES.map((z) => (
                <button
                  key={z}
                  onClick={() => setZone(z)}
                  title={HR_ZONES[z].label}
                  className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                    zone === z
                      ? 'bg-primary-600/20 border-primary-400/60 text-primary-300'
                      : 'bg-cyber-bg border-cyber-line text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {z.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 font-mono mt-1">
              {HR_ZONES[zone].label} · {HR_ZONES[zone].min}-{HR_ZONES[zone].max} bpm
            </p>
          </div>

          <div>
            <label className={labelClass}>Note</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. remplacer par du vélo, genou sensible"
              className={inputClass}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary-600/20 border border-primary-400/50 text-primary-300 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600/30 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>

          {!isNew && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-cyber-line">
              <button
                onClick={handleSkipToggle}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono border border-cyber-line rounded-lg text-slate-400 hover:text-amber-300"
              >
                {skipped ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {skipped ? 'Réactiver' : 'Sauter cette séance'}
              </button>
              {isExtra ? (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono border border-cyber-line rounded-lg text-slate-400 hover:text-sport-run"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono border border-cyber-line rounded-lg text-slate-400 hover:text-primary-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Revenir au plan
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
