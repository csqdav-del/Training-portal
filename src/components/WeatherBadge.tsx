import { SuitabilityVerdict, SUITABILITY_STYLES, formatWindow } from '../lib/weatherSuitability';

interface WeatherBadgeProps {
  verdict: SuitabilityVerdict;
  /** `dot` : pastille seule pour les cases denses du calendrier (détail au survol). */
  variant?: 'full' | 'dot';
}

/**
 * Verdict météo d'une séance extérieure. Purement informatif — aucun bouton,
 * aucune écriture : David lit et décide avec les outils d'édition existants.
 */
export default function WeatherBadge({ verdict, variant = 'full' }: WeatherBadgeProps) {
  const style = SUITABILITY_STYLES[verdict.level];
  const window = formatWindow(verdict.window);
  /**
   * On ne montre le créneau que s'il est vraiment meilleur que le reste de la
   * journée. Sur une journée uniformément mauvaise, annoncer une « meilleure
   * fenêtre » laisserait croire qu'il existe un moment convenable.
   */
  const showWindow = Boolean(window) && Boolean(verdict.limitedWindow);
  const title = [verdict.label, verdict.reasons.join(' · '), showWindow ? 'Meilleur créneau : ' + window : null]
    .filter(Boolean)
    .join(' — ');

  if (variant === 'dot') {
    return <span title={title} className={`inline-block w-2 h-2 rounded-full shrink-0 ${style.dot}`} />;
  }

  return (
    <div
      title={title}
      className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${style.bg} ${style.border} ${style.text}`}
    >
      <span>{style.icon}</span>
      <span className="font-semibold">{verdict.label}</span>
      <span className="text-slate-500">·</span>
      <span className="text-slate-400">{verdict.reasons.slice(0, 2).join(' · ')}</span>
      {showWindow && <span className="text-slate-500">· seulement {window}</span>}
    </div>
  );
}
