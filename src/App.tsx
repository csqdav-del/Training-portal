import { useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Settings, LogOut, Menu, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Calendar from './components/Calendar';
import WeightTracker from './components/WeightTracker';
import VapingCounter from './components/VapingCounter';
import PuffTracker from './components/PuffTracker';
import NutritionTracker from './components/NutritionTracker';
import { Workout, WeightEntry, WeeklyStats, DailyMetric, Discipline } from './types';
import { HR_ZONES } from './data/trainingPlan';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import { subscribeToWorkouts } from './lib/firestoreWorkouts';
import { subscribeToWeights, addWeightEntry, deleteWeightEntry } from './lib/firestoreWeights';
import { subscribeToDailyMetrics, findMetricForDate } from './lib/firestoreDailyMetrics';
// Aliasé : `setVapingStart` est déjà le nom du setter d'état local plus bas.
import { subscribeToVaping, setVapingStart as saveVapingStart, resetVapingStreak } from './lib/vaping';
import { connectStrava, syncStrava, subscribeToStravaStatus } from './lib/strava';
import {
  connectHealthConnect,
  isHealthConnectSupported,
  subscribeToHealthStatus,
  syncHealthConnect,
} from './lib/healthConnect';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [vapingStart, setVapingStart] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'weight' | 'nutrition' | 'vaping'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const [stravaBanner, setStravaBanner] = useState<'connected' | 'error' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  // Health Connect : disponible uniquement dans l'app Android (pas d'API web).
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [lastHealthSyncCount, setLastHealthSyncCount] = useState<number | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const healthSupported = isHealthConnectSupported();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setWorkouts([]);
      setWeights([]);
      setVapingStart(null);
      setStravaConnected(false);
      setDailyMetrics([]);
      setHealthConnected(false);
      return;
    }
    const unsubWorkouts = subscribeToWorkouts(user.uid, setWorkouts);
    const unsubWeights = subscribeToWeights(user.uid, setWeights);
    const unsubVaping = subscribeToVaping(user.uid, setVapingStart);
    const unsubStrava = subscribeToStravaStatus(user.uid, setStravaConnected);
    const unsubMetrics = subscribeToDailyMetrics(user.uid, setDailyMetrics);
    const unsubHealth = subscribeToHealthStatus(user.uid, setHealthConnected);
    return () => {
      unsubWorkouts();
      unsubWeights();
      unsubVaping();
      unsubStrava();
      unsubMetrics();
      unsubHealth();
    };
  }, [user]);

  useEffect(() => {
    if (!stravaConnected) return;
    syncStrava().then((result) => {
      if ('synced' in result) setLastSyncCount(result.synced);
    });
    const interval = setInterval(() => {
      syncStrava().then((result) => {
        if ('synced' in result) setLastSyncCount(result.synced);
      });
    }, 10 * 60 * 1000); // re-sync toutes les 10 minutes tant que l'app est ouverte
    return () => clearInterval(interval);
  }, [stravaConnected]);

  // Health Connect : une seule synchro par ouverture de l'app. Lire le magasin
  // local est bien plus coûteux qu'un appel Strava, et les données de la montre
  // n'arrivent de toute façon qu'une poignée de fois par jour.
  useEffect(() => {
    if (!healthSupported || !healthConnected) return;
    let cancelled = false;
    syncHealthConnect().then((result) => {
      if (cancelled) return;
      if ('error' in result) setHealthError(result.error);
      else setLastHealthSyncCount(result.synced);
    });
    return () => {
      cancelled = true;
    };
  }, [healthSupported, healthConnected]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const strava = params.get('strava');
    if (strava === 'connected' || strava === 'error') {
      setStravaBanner(strava);
      window.history.replaceState({}, '', window.location.pathname);
      const timer = setTimeout(() => setStravaBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'unknown';
      const message = err instanceof Error ? err.message : String(err);
      console.error('signInWithGoogle failed', err);
      setAuthError(`${code}: ${message}`);
    }
  };

  const handleConnectStrava = () => {
    if (user) connectStrava(user.uid);
  };

  const handleSyncStrava = async () => {
    setSyncing(true);
    const result = await syncStrava();
    setSyncing(false);
    if ('synced' in result) setLastSyncCount(result.synced);
  };

  // Équivalent de « Connecter Strava » : Health Connect n'a pas d'OAuth, c'est
  // l'écran de permissions Android qui joue ce rôle. Une synchro suit tout de
  // suite pour que David voie le résultat sans avoir à retaper sur un bouton.
  const handleConnectHealth = async () => {
    setHealthError(null);
    try {
      const granted = await connectHealthConnect();
      if (!granted) {
        setHealthError('permissions_refusees');
        return;
      }
      await handleSyncHealth();
    } catch (err) {
      console.error('connectHealthConnect failed', err);
      setHealthError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSyncHealth = async () => {
    setHealthError(null);
    setHealthSyncing(true);
    const result = await syncHealthConnect();
    setHealthSyncing(false);
    if ('error' in result) setHealthError(result.error);
    else setLastHealthSyncCount(result.synced);
  };

  // Métriques de récup du jour, affichées au tableau de bord.
  const todayMetric = findMetricForDate(dailyMetrics, new Date());

  // Stats de la semaine en cours (lundi-dimanche)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekWorkouts = workouts.filter((w) => {
    const d = new Date(w.date);
    return d >= weekStart && d <= weekEnd;
  });

  // Un seul calcul pour la semaine et pour le cumul : le tableau de bord bascule
  // entre les deux, et toutes les disciplines comptent (marche comprise) — sinon
  // une sortie à pied n'apparaît nulle part dans les totaux.
  const buildStats = (list: Workout[]): WeeklyStats => {
    const sum = (type: Discipline, field: 'distance' | 'duration') =>
      list
        .filter((w) => w.type === type)
        .reduce((acc, w) => acc + (field === 'distance' ? w.distance || 0 : w.duration || 0), 0);

    return {
      swimDistance: sum('swim', 'distance'),
      swimDuration: sum('swim', 'duration'),
      bikeDistance: sum('bike', 'distance'),
      bikeDuration: sum('bike', 'duration'),
      runDistance: sum('run', 'distance'),
      runDuration: sum('run', 'duration'),
      strengthSessions: list.filter((w) => w.type === 'strength').length,
      strengthDuration: sum('strength', 'duration'),
      walkDistance: sum('walk', 'distance'),
      walkDuration: sum('walk', 'duration'),
      otherDistance: sum('other', 'distance'),
      otherDuration: sum('other', 'duration'),
      totalCalories: list.reduce((acc, w) => acc + (w.calories || 0), 0),
      totalWorkouts: list.length,
      totalDuration: list.reduce((acc, w) => acc + (w.duration || 0), 0),
      totalDistance: list.reduce((acc, w) => acc + (w.distance || 0), 0),
    };
  };

  const weeklyStats = buildStats(thisWeekWorkouts);
  const allTimeStats = buildStats(workouts);

  // Weight data for chart
  const weightData = weights
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(w => ({
      date: new Date(w.date).toLocaleDateString('fr-FR'),
      weight: w.weight,
    }));

  const handleAddWeight = (weight: number, date: Date, notes?: string) => {
    if (!user) return;
    addWeightEntry(user.uid, weight, date, notes).catch((err) => console.error('addWeightEntry failed', err));
  };

  const handleDeleteWeight = (entryId: string) => {
    if (!user) return;
    deleteWeightEntry(user.uid, entryId).catch((err) => console.error('deleteWeightEntry failed', err));
  };

  const tabs = [
    { id: 'dashboard', label: '📊 Tableau de bord' },
    { id: 'calendar', label: '📅 Calendrier' },
    { id: 'weight', label: '⚖️ Poids' },
    { id: 'nutrition', label: '🍎 Nutrition' },
    { id: 'vaping', label: '🎯 Arrêt Vape' },
  ] as const;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-cyber-bg flex items-center justify-center">
        <p className="text-primary-300 font-mono animate-pulse">Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cyber-bg flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-cyber-grid bg-grid opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/30 via-transparent to-sport-strength/10" />
        <div className="glass-panel p-8 shadow-neon-cyan max-w-md w-full relative z-10 mx-4">
          <h1 className="text-3xl font-display font-bold text-primary-300 text-glow-cyan mb-2 text-center uppercase tracking-widest">
            Training Portal
          </h1>
          <p className="text-center text-slate-500 text-sm font-mono mb-8">Challenge Sail Québec 2027</p>
          <button
            onClick={handleSignIn}
            className="w-full bg-primary-600/20 border border-primary-400/50 text-primary-300 py-3 rounded-lg hover:bg-primary-600/30 hover:shadow-neon-cyan font-semibold transition-all"
          >
            Se connecter avec Google
          </button>
          {authError && (
            <p className="mt-4 text-xs text-sport-run font-mono text-center break-words">{authError}</p>
          )}
          <div className="mt-6 pt-4 border-t border-cyber-line text-[10px] text-slate-600 font-mono break-all space-y-0.5">
            <p>debug projectId: {import.meta.env.VITE_FIREBASE_PROJECT_ID || '(vide)'}</p>
            <p>debug authDomain: {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '(vide)'}</p>
            <p>debug apiKey: {import.meta.env.VITE_FIREBASE_API_KEY || '(vide)'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Strava banner */}
      {stravaBanner && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg font-mono text-sm ${
            stravaBanner === 'connected'
              ? 'bg-cyber-panel border-sport-bike/50 text-sport-bike'
              : 'bg-cyber-panel border-sport-run/50 text-sport-run'
          }`}
        >
          {stravaBanner === 'connected' ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> Strava connecté avec succès
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" /> Échec de la connexion Strava
            </>
          )}
        </div>
      )}

      {/* Header */}
      <header className="bg-cyber-panel/90 backdrop-blur border-b border-cyber-line sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-sport-strength rounded-lg flex items-center justify-center shadow-neon-cyan">
                <span className="text-white text-xl">🏊</span>
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-slate-100 uppercase tracking-wide">Training Portal</h1>
                <p className="text-xs text-primary-400 font-mono">Triathlon Olympique 2027</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
              {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName ?? 'Profil'} className="w-8 h-8 rounded-full border border-primary-400/50" />
              )}
              <button className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300">
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => signOutUser()}
                className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-sport-run"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-cyber-panel2 rounded-lg text-slate-300"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-cyber-panel/80 backdrop-blur border-b border-cyber-line sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex gap-1 overflow-x-auto ${mobileMenuOpen ? 'flex-col' : ''}`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-400 text-primary-300 text-glow-cyan'
                    : 'border-transparent text-slate-500 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            uid={user.uid}
            weeklyStats={weeklyStats}
            allTimeStats={allTimeStats}
            zones={HR_ZONES}
            weightData={weightData}
            workouts={workouts}
            stravaConnected={stravaConnected}
            syncing={syncing}
            lastSyncCount={lastSyncCount}
            onConnectStrava={handleConnectStrava}
            onSyncStrava={handleSyncStrava}
            healthSupported={healthSupported}
            healthConnected={healthConnected}
            healthSyncing={healthSyncing}
            lastHealthSyncCount={lastHealthSyncCount}
            healthError={healthError}
            todayMetric={todayMetric}
            onConnectHealth={handleConnectHealth}
            onSyncHealth={handleSyncHealth}
          />
        )}

        {activeTab === 'calendar' && (
          <Calendar workouts={workouts} uid={user.uid} />
        )}

        {activeTab === 'weight' && (
          <WeightTracker entries={weights} onAddEntry={handleAddWeight} onDeleteEntry={handleDeleteWeight} />
        )}

        {activeTab === 'nutrition' && (
          <NutritionTracker uid={user.uid} />
        )}

        {activeTab === 'vaping' && (
          <div className="space-y-10">
            {/* Le suivi quotidien est l'outil du jour : il passe avant le compteur
                d'abstinence, qui n'a de sens qu'une fois l'arrêt complet enclenché. */}
            <PuffTracker uid={user.uid} />

            <div className="flex items-center gap-3">
              <div className="h-px bg-cyber-line flex-1" />
              <span className="text-[11px] text-slate-600 font-mono uppercase tracking-wide">Arrêt complet</span>
              <div className="h-px bg-cyber-line flex-1" />
            </div>

            <VapingCounter
              startDate={vapingStart}
              onSetStartDate={(date) =>
                saveVapingStart(user.uid, date).catch((err) => console.error('setVapingStart failed', err))
              }
              onReset={() => resetVapingStreak(user.uid).catch((err) => console.error('resetVapingStreak failed', err))}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-line mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-slate-600 font-mono">
            <p>Training Portal • Sync: Strava + Samsung Health • Challenge Sail Quebec 2027</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
