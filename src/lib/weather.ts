/**
 * Météo de Québec via Open-Meteo — gratuit, sans clé d'API, CORS ouvert.
 *
 * Volontairement sans import React : la fonction Netlify `coach` réutilise
 * `forecastUrl` et `normalizeForecast` côté serveur, et ne doit pas tirer React
 * dans son bundle. Le hook vit dans ./useWeather — même séparation que
 * planOverrides (pur) / scheduleOverrides (client).
 *
 * C'est la seule API externe appelée directement depuis le client : la règle du
 * projet (« tout passe par une fonction Netlify ») existe pour protéger les
 * secrets, et il n'y en a aucun ici. La fonction `coach` appelle la même URL de
 * son côté pour injecter la prévision dans le contexte de l'IA.
 *
 * Aucune persistance Firestore : une prévision est périmée en quelques heures,
 * la stocker n'apporterait rien.
 */

/** Québec — le plan est entièrement local. */
export const QUEBEC = { latitude: 46.8139, longitude: -71.208, timezone: 'America/Montreal' };

/** Open-Meteo ne va pas plus loin que 16 jours ; 7 couvre la semaine du calendrier. */
export const FORECAST_DAYS = 7;

const CACHE_TTL_MS = 30 * 60 * 1000;

export interface WeatherHour {
  time: Date;
  tempC: number;
  feelsLikeC: number;
  precipMm: number;
  precipProb: number;
  windKmh: number;
  gustKmh: number;
  code: number;
}

export interface WeatherDay {
  /** Minuit local du jour concerné — comparer avec `toDateString()`. */
  date: Date;
  code: number;
  tempMinC: number;
  tempMaxC: number;
  feelsLikeMinC: number;
  feelsLikeMaxC: number;
  precipSumMm: number;
  precipProbMax: number;
  windMaxKmh: number;
  sunrise: Date;
  sunset: Date;
  hours: WeatherHour[];
}

export interface WeatherForecast {
  fetchedAt: number;
  current: WeatherHour | null;
  days: WeatherDay[];
}

/** Libellés WMO en français, avec l'emoji utilisé dans l'interface. */
export const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Ciel dégagé', icon: '☀️' },
  1: { label: 'Généralement dégagé', icon: '🌤️' },
  2: { label: 'Partiellement nuageux', icon: '⛅' },
  3: { label: 'Couvert', icon: '☁️' },
  45: { label: 'Brouillard', icon: '🌫️' },
  48: { label: 'Brouillard givrant', icon: '🌫️' },
  51: { label: 'Bruine faible', icon: '🌦️' },
  53: { label: 'Bruine', icon: '🌦️' },
  55: { label: 'Bruine forte', icon: '🌧️' },
  56: { label: 'Bruine verglaçante', icon: '🧊' },
  57: { label: 'Bruine verglaçante forte', icon: '🧊' },
  61: { label: 'Pluie faible', icon: '🌦️' },
  63: { label: 'Pluie', icon: '🌧️' },
  65: { label: 'Pluie forte', icon: '🌧️' },
  66: { label: 'Pluie verglaçante', icon: '🧊' },
  67: { label: 'Pluie verglaçante forte', icon: '🧊' },
  71: { label: 'Neige faible', icon: '🌨️' },
  73: { label: 'Neige', icon: '❄️' },
  75: { label: 'Neige forte', icon: '❄️' },
  77: { label: 'Grains de neige', icon: '❄️' },
  80: { label: 'Averses faibles', icon: '🌦️' },
  81: { label: 'Averses', icon: '🌧️' },
  82: { label: 'Averses violentes', icon: '⛈️' },
  85: { label: 'Averses de neige', icon: '🌨️' },
  86: { label: 'Averses de neige fortes', icon: '❄️' },
  95: { label: 'Orage', icon: '⛈️' },
  96: { label: 'Orage avec grêle', icon: '⛈️' },
  99: { label: 'Orage avec grêle forte', icon: '⛈️' },
};

export function describeCode(code: number): { label: string; icon: string } {
  return WMO_CODES[code] ?? { label: 'Conditions inconnues', icon: '🌡️' };
}

/** Neige, verglas ou orage : disqualifiant pour toute sortie extérieure. */
export function isSevereCode(code: number): boolean {
  return (
    (code >= 56 && code <= 57) ||
    (code >= 66 && code <= 67) ||
    (code >= 71 && code <= 77) ||
    (code >= 85 && code <= 86) ||
    code >= 95
  );
}

const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'precipitation_probability',
  'wind_speed_10m',
  'wind_gusts_10m',
  'weather_code',
].join(',');

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'sunrise',
  'sunset',
].join(',');

export function forecastUrl(days = FORECAST_DAYS): string {
  const params = new URLSearchParams({
    latitude: String(QUEBEC.latitude),
    longitude: String(QUEBEC.longitude),
    timezone: QUEBEC.timezone,
    forecast_days: String(days),
    hourly: HOURLY,
    daily: DAILY,
    current: 'temperature_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,weather_code',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + params.toString();
}

/**
 * Open-Meteo renvoie des heures locales sans fuseau (« 2026-08-26T14:00 ») :
 * `new Date` les interprète comme locales, ce qui est exactement voulu.
 */
function parseLocal(value: string): Date {
  return new Date(value);
}

function num(list: unknown, i: number): number {
  const v = Array.isArray(list) ? list[i] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Transforme les tableaux parallèles d'Open-Meteo en objets par heure et par jour. */
export function normalizeForecast(raw: any): WeatherForecast {
  const h = raw?.hourly ?? {};
  const times: string[] = Array.isArray(h.time) ? h.time : [];
  const hours: WeatherHour[] = times.map((t, i) => ({
    time: parseLocal(t),
    tempC: num(h.temperature_2m, i),
    feelsLikeC: num(h.apparent_temperature, i),
    precipMm: num(h.precipitation, i),
    precipProb: num(h.precipitation_probability, i),
    windKmh: num(h.wind_speed_10m, i),
    gustKmh: num(h.wind_gusts_10m, i),
    code: num(h.weather_code, i),
  }));

  const d = raw?.daily ?? {};
  const dayTimes: string[] = Array.isArray(d.time) ? d.time : [];
  const days: WeatherDay[] = dayTimes.map((t, i) => {
    const date = parseLocal(t + 'T00:00');
    const key = date.toDateString();
    return {
      date,
      code: num(d.weather_code, i),
      tempMinC: num(d.temperature_2m_min, i),
      tempMaxC: num(d.temperature_2m_max, i),
      feelsLikeMinC: num(d.apparent_temperature_min, i),
      feelsLikeMaxC: num(d.apparent_temperature_max, i),
      precipSumMm: num(d.precipitation_sum, i),
      precipProbMax: num(d.precipitation_probability_max, i),
      windMaxKmh: num(d.wind_speed_10m_max, i),
      sunrise: parseLocal(Array.isArray(d.sunrise) ? d.sunrise[i] : t + 'T06:00'),
      sunset: parseLocal(Array.isArray(d.sunset) ? d.sunset[i] : t + 'T20:00'),
      hours: hours.filter((x) => x.time.toDateString() === key),
    };
  });

  const c = raw?.current;
  const current: WeatherHour | null = c
    ? {
        time: parseLocal(c.time),
        tempC: typeof c.temperature_2m === 'number' ? c.temperature_2m : 0,
        feelsLikeC: typeof c.apparent_temperature === 'number' ? c.apparent_temperature : 0,
        precipMm: typeof c.precipitation === 'number' ? c.precipitation : 0,
        precipProb: 0,
        windKmh: typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : 0,
        gustKmh: typeof c.wind_gusts_10m === 'number' ? c.wind_gusts_10m : 0,
        code: typeof c.weather_code === 'number' ? c.weather_code : 0,
      }
    : null;

  return { fetchedAt: Date.now(), current, days };
}

/** Retrouve le jour de prévision correspondant à une date, ou `undefined` hors fenêtre. */
export function findDay(forecast: WeatherForecast | null, date: Date): WeatherDay | undefined {
  if (!forecast) return undefined;
  const key = date.toDateString();
  return forecast.days.find((d) => d.date.toDateString() === key);
}

// --- Cache partagé ---------------------------------------------------------

/**
 * Dashboard et Calendar s'abonnent chacun de leur côté (comme ils le font déjà
 * pour les overrides). Le cache module-level + la déduplication de la promesse
 * en vol garantissent un seul appel réseau pour les deux.
 */
let cache: WeatherForecast | null = null;
let inFlight: Promise<WeatherForecast> | null = null;
const listeners = new Set<(f: WeatherForecast) => void>();

export const CACHE_TTL = CACHE_TTL_MS;

/** Prévision déjà en cache, pour initialiser un composant sans clignotement. */
export function cachedForecast(): WeatherForecast | null {
  return cache;
}

export function subscribeToForecast(fn: (f: WeatherForecast) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function fetchForecast(force = false): Promise<WeatherForecast> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch(forecastUrl());
    if (!res.ok) throw new Error('Open-Meteo ' + res.status);
    const forecast = normalizeForecast(await res.json());
    cache = forecast;
    listeners.forEach((fn) => fn(forecast));
    return forecast;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

