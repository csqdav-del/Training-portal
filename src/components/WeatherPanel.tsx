import { CloudSun, RefreshCw, Wind, Droplets } from 'lucide-react';
import { DayPlan } from '../types';
import { WeatherForecast, describeCode } from '../lib/weather';
import {
  SuitabilityVerdict,
  SUITABILITY_STYLES,
  isOutdoorDiscipline,
  rateSession,
} from '../lib/weatherSuitability';

interface WeatherPanelProps {
  forecast: WeatherForecast | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Semaine effective (personnalisations comprises) — sert à colorer les jours qui portent une séance extérieure. */
  planDays?: DayPlan[];
}

const DAY_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

const SEVERITY = { good: 0, marginal: 1, bad: 2 } as const;

/** Le jour prend la couleur de sa séance extérieure la plus compromise. */
function worstVerdictOfDay(planDays: DayPlan[] | undefined, forecast: WeatherForecast, date: Date) {
  const day = forecast.days.find((d) => d.date.toDateString() === date.toDateString());
  const planDay = planDays?.find((d) => d.date.toDateString() === date.toDateString());
  if (!day || !planDay) return null;

  let worst: SuitabilityVerdict | null = null;
  for (const session of planDay.sessions) {
    if (!isOutdoorDiscipline(session.discipline)) continue;
    const verdict = rateSession(session.discipline, day, session.targetDurationMin);
    if (verdict && (!worst || SEVERITY[verdict.level] > SEVERITY[worst.level])) worst = verdict;
  }
  return worst;
}

/**
 * Météo de Québec (Open-Meteo), sur 7 jours. Purement informative : elle ne
 * modifie jamais le plan, elle sert à décider avant de sortir.
 */
export default function WeatherPanel({ forecast, loading, error, onRefresh, planDays }: WeatherPanelProps) {
  const current = forecast?.current;
  const currentDesc = current ? describeCode(current.code) : null;

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <CloudSun className="w-4 h-4" /> Météo — Québec
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-slate-500 hover:text-primary-300 disabled:opacity-40"
          title="Rafraîchir"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && !forecast ? (
        <div className="text-slate-500 font-mono text-sm">{error}</div>
      ) : !forecast ? (
        <div className="text-slate-600 font-mono text-sm">Chargement…</div>
      ) : (
        <>
          {current && currentDesc && (
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{currentDesc.icon}</span>
              <div>
                <div className="text-2xl font-display font-bold text-slate-200">{Math.round(current.tempC)} °C</div>
                <div className="text-xs text-slate-500 font-mono">
                  {currentDesc.label} · ressenti {Math.round(current.feelsLikeC)} °C
                </div>
              </div>
              <div className="ml-auto text-xs text-slate-500 font-mono space-y-1 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Wind className="w-3.5 h-3.5" /> {Math.round(current.windKmh)} km/h
                  {current.gustKmh > current.windKmh + 5 && (
                    <span className="text-slate-600">(raf. {Math.round(current.gustKmh)})</span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <Droplets className="w-3.5 h-3.5" /> {current.precipMm.toFixed(1)} mm
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {forecast.days.map((day) => {
              const desc = describeCode(day.code);
              const verdict = worstVerdictOfDay(planDays, forecast, day.date);
              const style = verdict ? SUITABILITY_STYLES[verdict.level] : null;
              return (
                <div
                  key={day.date.toISOString()}
                  title={
                    verdict
                      ? verdict.label + ' pour la séance extérieure — ' + verdict.reasons.join(' · ')
                      : desc.label
                  }
                  className={`rounded-lg border px-2 py-2 text-center ${
                    style ? `${style.bg} ${style.border}` : 'bg-cyber-panel2 border-cyber-line'
                  }`}
                >
                  <div className="text-[11px] text-slate-500 font-mono uppercase">{DAY_SHORT[day.date.getDay()]}</div>
                  <div className="text-xl leading-tight my-0.5">{desc.icon}</div>
                  <div className="text-[11px] font-mono text-slate-300">
                    {Math.round(day.tempMaxC)}° <span className="text-slate-600">{Math.round(day.tempMinC)}°</span>
                  </div>
                  {verdict && style && <div className={`text-[10px] font-mono mt-0.5 ${style.text}`}>{style.icon}</div>}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-600 font-mono mt-3">
            Prévision sur 7 jours (Open-Meteo). Indicative — le plan n'est jamais modifié automatiquement.
          </p>
        </>
      )}
    </div>
  );
}
