import { createPortal } from 'react-dom';
import { X, ExternalLink, Trophy, ThumbsUp, Pencil, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Discipline, Workout } from '../types';

interface ActivityDetailProps {
  workout: Workout;
  /** Fourni uniquement pour les activités saisies à la main (les seules modifiables). */
  onEdit?: () => void;
  onClose: () => void;
}

const DISCIPLINE_META: Record<Discipline, { label: string; icon: string; color: string }> = {
  swim: { label: 'Natation', icon: '🏊', color: 'text-sport-swim' },
  bike: { label: 'Vélo', icon: '🚴', color: 'text-sport-bike' },
  run: { label: 'Course', icon: '🏃', color: 'text-sport-run' },
  strength: { label: 'Force', icon: '💪', color: 'text-sport-strength' },
  walk: { label: 'Marche', icon: '🚶', color: 'text-slate-300' },
  other: { label: 'Autre', icon: '🏅', color: 'text-slate-300' },
};

/** Décode un polyline encodé Google (précision 5) en couples [lat, lng]. */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** Projette le tracé dans une viewBox 300x160 (mercator simplifié, ratio conservé). */
function buildTrackPath(polyline: string): string | null {
  const pts = decodePolyline(polyline);
  if (pts.length < 2) return null;

  const W = 300;
  const H = 160;
  const PAD = 8;
  const latMid = (pts.reduce((s, p) => s + p[0], 0) / pts.length) * (Math.PI / 180);
  const xy = pts.map(([la, ln]) => [ln * Math.cos(latMid), la] as [number, number]);

  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;

  return xy
    .map(([x, y], i) => {
      const px = offX + (x - minX) * scale;
      const py = H - (offY + (y - minY) * scale); // y inversé : nord en haut
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');
}

function formatDuration(minutes?: number): string {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

function Stat({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent?: boolean }) {
  return (
    <div className="bg-cyber-bg border border-cyber-line rounded-lg p-3">
      <div className={`text-xl font-bold font-mono ${accent ? 'text-primary-300' : 'text-slate-100'}`}>
        {value}
        {unit && <span className="text-xs text-slate-500 ml-1">{unit}</span>}
      </div>
      <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

export default function ActivityDetail({ workout: w, onEdit, onClose }: ActivityDetailProps) {
  const meta = DISCIPLINE_META[w.type] ?? DISCIPLINE_META.other;
  const trackPath = w.polyline ? buildTrackPath(w.polyline) : null;
  const place = [w.locationCity, w.locationState].filter(Boolean).join(', ');

  const secondary: { label: string; value: string }[] = [];
  if (w.avgSpeed) secondary.push({ label: 'Vitesse moy', value: `${w.avgSpeed} km/h` });
  if (w.maxSpeed) secondary.push({ label: 'Vitesse max', value: `${w.maxSpeed} km/h` });
  if (w.elapsedTime) secondary.push({ label: 'Temps total', value: formatDuration(w.elapsedTime) });
  if (w.heartRate) secondary.push({ label: 'FC moy / max', value: `${w.heartRate.avg} / ${w.heartRate.max} bpm` });
  if (w.avgCadence) secondary.push({ label: 'Cadence moy', value: `${w.avgCadence}` });
  if (w.maxWatts) secondary.push({ label: 'Puissance max', value: `${w.maxWatts} W` });
  if (w.weightedWatts) secondary.push({ label: 'Puissance pondérée', value: `${w.weightedWatts} W` });
  if (w.elevationMax) secondary.push({ label: 'Altitude max', value: `${w.elevationMax} m` });
  if (w.calories) secondary.push({ label: 'Calories', value: `${w.calories} kcal` });
  if (w.sufferScore) secondary.push({ label: 'Effort relatif', value: `${w.sufferScore}` });
  if (w.rpe) secondary.push({ label: 'Effort ressenti', value: `${w.rpe}/10` });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-3xl max-h-[90vh] flex flex-col shadow-neon-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-cyber-line shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-mono">
              {format(new Date(w.date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              {place && ` · ${place}`}
            </p>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mt-1">
              <span className="text-2xl shrink-0">{meta.icon}</span>
              <span className="truncate">{w.title || w.notes || meta.label}</span>
            </h2>
            <p className={`text-xs font-mono mt-1 ${meta.color}`}>
              {w.sportType || meta.label}
              {w.source === 'strava' ? ' · Strava' : w.source === 'manual' ? ' · Manuel' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                title="Modifier cette activité"
                className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300"
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 pt-4 min-h-0 space-y-4">
          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat value={w.distance ? String(w.distance) : '—'} unit="km" label="Distance" accent />
            <Stat value={formatDuration(w.duration)} label="Temps en mouvement" accent />
            <Stat value={w.elevationGain != null ? String(w.elevationGain) : '—'} unit="m" label="Dénivelé" />
            <Stat
              value={w.avgWatts != null ? String(w.avgWatts) : '—'}
              unit="W"
              label={w.deviceWatts ? 'Puissance moy' : 'Puissance estimée'}
            />
          </div>

          {/* Tracé */}
          {trackPath && (
            <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2 font-mono">Tracé</h3>
              <svg viewBox="0 0 300 160" className="w-full h-40" role="img" aria-label="Tracé de l'activité">
                <path d={trackPath} fill="none" stroke="#fc5200" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {/* Détail des exercices (musculation saisie à la main) */}
          {w.exercises && w.exercises.length > 0 && (
            <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-slate-500 uppercase tracking-wide font-mono flex items-center gap-1.5">
                  <Dumbbell className="w-3.5 h-3.5" /> Exercices
                </h3>
                {(() => {
                  const volume = w.exercises.reduce(
                    (sum, e) => sum + (e.sets ?? 0) * (e.reps ?? 0) * (e.weightLbs ?? 0),
                    0,
                  );
                  return volume > 0 ? (
                    <span className="text-xs text-primary-300 font-mono">
                      Volume total : {volume.toLocaleString('fr-CA')} lbs
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="space-y-1">
                {w.exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="flex justify-between gap-3 text-sm font-mono border-b border-cyber-line/50 py-1.5"
                  >
                    <span className="text-slate-200 min-w-0 truncate">{ex.name}</span>
                    <span className="text-slate-400 shrink-0">
                      {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.sets ? `${ex.sets} séries` : '—'}
                      {ex.weightLbs ? ` @ ${ex.weightLbs} lbs` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats secondaires */}
          {secondary.length > 0 && (
            <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
              <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-mono">Détails</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {secondary.map((s) => (
                  <div key={s.label} className="flex justify-between text-sm font-mono border-b border-cyber-line/50 py-1">
                    <span className="text-slate-500">{s.label}</span>
                    <span className="text-slate-200">{s.value}</span>
                  </div>
                ))}
                {w.kilojoules != null && (
                  <div className="flex justify-between text-sm font-mono border-b border-cyber-line/50 py-1">
                    <span className="text-slate-500">Énergie</span>
                    <span className="text-slate-200">{w.kilojoules} kJ</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Records + social */}
          {(w.prCount || w.achievementCount || w.kudosCount) && (
            <div className="flex flex-wrap items-center gap-4 text-sm font-mono text-slate-300">
              {!!w.prCount && (
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" /> {w.prCount} record{w.prCount > 1 ? 's' : ''} perso
                </span>
              )}
              {!!w.achievementCount && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  🏅 {w.achievementCount} trophée{w.achievementCount > 1 ? 's' : ''}
                </span>
              )}
              {!!w.kudosCount && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <ThumbsUp className="w-4 h-4" /> {w.kudosCount}
                </span>
              )}
            </div>
          )}

          {/* Notes personnelles (le titre les remplaçait avant) */}
          {w.notes && w.notes !== w.title && (
            <p className="text-sm text-slate-400 italic border-l-2 border-cyber-line pl-3">{w.notes}</p>
          )}

          {/* Matériel */}
          {(w.gearName || w.deviceName) && (
            <div className="text-xs text-slate-500 font-mono space-x-3">
              {w.gearName && <span>Équipement : {w.gearName}</span>}
              {w.deviceName && <span>Appareil : {w.deviceName}</span>}
            </div>
          )}

          {w.stravaUrl && (
            <a
              href={w.stravaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 font-mono"
            >
              Voir sur Strava <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
