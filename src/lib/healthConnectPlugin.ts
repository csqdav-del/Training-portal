import { registerPlugin, Capacitor } from '@capacitor/core';
import type {
  AuthorizationStatus,
  HealthDataType,
  HealthPlugin,
  HealthSample,
  Workout as HcWorkout,
} from '@capgo/capacitor-health';

/**
 * Adaptateur autour du plugin natif Health Connect (@capgo/capacitor-health).
 *
 * Tout ce qui dépend du plugin est confiné ici : si on en change un jour, seul
 * ce fichier bouge — healthConnect.ts et l'UI restent intacts.
 *
 * On passe par registerPlugin() plutôt que par l'export du paquet pour que le
 * bundle web n'embarque pas l'implémentation : sur le web, isNative() est faux
 * et aucune de ces fonctions n'est appelée.
 */

const Health = registerPlugin<HealthPlugin>('Health');

/**
 * Types sans lesquels la synchro n'a plus d'objet. Si l'un manque, on considère
 * que Health Connect n'est pas connecté et on repropose l'autorisation.
 */
const ESSENTIAL_TYPES: HealthDataType[] = ['workouts', 'sleep', 'steps', 'weight'];

/**
 * Types d'enrichissement : leur absence dégrade la donnée sans la casser.
 * `distance` et `calories` sont requis pour que Health Connect accepte de
 * renvoyer totalDistance / totalEnergyBurned sur les séances.
 */
const OPTIONAL_TYPES: HealthDataType[] = [
  'bodyFat',
  'restingHeartRate',
  'heartRate',
  'distance',
  'calories',
];

/** Tout ce qu'on demande à l'écran de permissions. */
export const READ_TYPES: HealthDataType[] = [...ESSENTIAL_TYPES, ...OPTIONAL_TYPES];

export type { HealthSample, HcWorkout };

/** Health Connect n'existe que dans l'app Android — jamais dans le navigateur. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function isAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { available } = await Health.isAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * On n'exige que les types essentiels : refuser `bodyFat` ne doit pas bloquer
 * toute la synchronisation.
 */
function essentialsGranted(status: AuthorizationStatus): boolean {
  return ESSENTIAL_TYPES.every((t) => status.readAuthorized.includes(t));
}

export async function hasPermissions(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return essentialsGranted(await Health.checkAuthorization({ read: READ_TYPES, write: [] }));
  } catch {
    return false;
  }
}

/**
 * Health Connect révoque l'accès après ~30 jours sans ouverture de l'app :
 * cette demande doit pouvoir être rejouée proprement à tout moment.
 *
 * requestHistoryAccess demande en plus READ_HEALTH_DATA_HISTORY — sans elle,
 * Health Connect plafonne la lecture aux ~30 derniers jours, alors que la
 * synchro remonte sur 60 jours comme celle de Strava.
 */
export async function requestPermissions(): Promise<boolean> {
  if (!isNative()) return false;
  const status = await Health.requestAuthorization({
    read: READ_TYPES,
    write: [],
    requestHistoryAccess: true,
  });
  return essentialsGranted(status);
}

/**
 * Les séances, avec distance et calories déjà incluses. Pagination via `anchor`
 * jusqu'à épuisement : sans ça, seules les 100 premières remonteraient.
 */
export async function readWorkouts(startDate: Date, endDate: Date): Promise<HcWorkout[]> {
  if (!isNative()) return [];
  const all: HcWorkout[] = [];
  let anchor: string | undefined;
  try {
    do {
      const res = await Health.queryWorkouts({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 200,
        ascending: true,
        anchor,
      });
      all.push(...(res.workouts ?? []));
      anchor = res.anchor ?? undefined;
      // Garde-fou : un plugin qui renverrait toujours le même anchor bouclerait.
    } while (anchor && all.length < 2000);
  } catch (err) {
    console.warn('Health Connect: lecture des séances impossible', err);
  }
  return all;
}

/** Échantillons bruts d'un type donné. `limit` vaut 100 par défaut côté plugin. */
export async function readSamples(
  dataType: HealthDataType,
  startDate: Date,
  endDate: Date,
  limit = 2000,
): Promise<HealthSample[]> {
  if (!isNative()) return [];
  try {
    const { samples } = await Health.readSamples({
      dataType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit,
      ascending: true,
    });
    return samples ?? [];
  } catch (err) {
    // Un type sans donnée (p. ex. aucune mesure de FC au repos) ne doit pas
    // faire échouer toute la synchronisation.
    console.warn(`Health Connect: lecture de ${dataType} impossible`, err);
    return [];
  }
}

/** Somme par journée — bien plus efficace que de cumuler les échantillons. */
export async function readDailyTotals(
  dataType: HealthDataType,
  startDate: Date,
  endDate: Date,
): Promise<{ startDate: string; value: number }[]> {
  if (!isNative()) return [];
  try {
    const { samples } = await Health.queryAggregated({
      dataType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    });
    return (samples ?? []).map((s) => ({ startDate: s.startDate, value: s.value }));
  } catch (err) {
    console.warn(`Health Connect: agrégation de ${dataType} impossible`, err);
    return [];
  }
}

export function openSettings(): Promise<void> {
  return Health.openHealthConnectSettings();
}
