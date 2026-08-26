import { useCallback, useEffect, useState } from 'react';
import { CACHE_TTL, WeatherForecast, cachedForecast, fetchForecast, subscribeToForecast } from './weather';

/**
 * Abonnement React à la prévision de Québec.
 *
 * Dashboard et Calendar appellent ce hook chacun de leur côté, comme ils le font
 * déjà avec subscribeToWeekOverrides. Le cache partagé de ./weather garantit un
 * seul appel réseau pour les deux.
 */
export function useWeather() {
  const [forecast, setForecast] = useState<WeatherForecast | null>(cachedForecast);
  const [loading, setLoading] = useState(!cachedForecast());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((force: boolean) => {
    setLoading(true);
    fetchForecast(force)
      .then((f) => {
        setForecast(f);
        setError(null);
      })
      // Une API tierce en panne ne doit jamais casser le tableau de bord.
      .catch(() => setError('Météo indisponible'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeToForecast((f) => {
      if (alive) setForecast(f);
    });
    load(false);
    // Rafraîchissement passif tant que l'onglet reste ouvert.
    const id = window.setInterval(() => load(false), CACHE_TTL);
    return () => {
      alive = false;
      unsubscribe();
      window.clearInterval(id);
    };
  }, [load]);

  return { forecast, loading, error, refresh: () => load(true) };
}
