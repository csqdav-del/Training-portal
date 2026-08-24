import { useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Settings, LogOut, Menu, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Calendar from './components/Calendar';
import WeightTracker from './components/WeightTracker';
import VapingCounter from './components/VapingCounter';
import { Workout, WeightEntry, WeeklyStats } from './types';
import { HR_ZONES, WEIGHT_START_LBS } from './data/trainingPlan';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import { subscribeToWorkouts } from './lib/firestoreWorkouts';
import { connectStrava, syncStrava, subscribeToStravaStatus } from './lib/strava';

const MOCK_WEIGHTS: WeightEntry[] = [
  {
    id: '1',
    userId: 'user1',
    date: new Date(),
    weight: 289.5,
    notes: 'Matin',
  },
  {
    id: '2',
    userId: 'user1',
    date: new Date(new Date().setDate(new Date().getDate() - 3)),
    weight: WEIGHT_START_LBS,
    notes: 'Matin',
  },
  {
    id: '3',
    userId: 'user1',
    date: new Date(new Date().setDate(new Date().getDate() - 7)),
    weight: 291,
    notes: 'Matin',
  },
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>(MOCK_WEIGHTS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'weight' | 'vaping'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const [stravaBanner, setStravaBanner] = useState<'connected' | 'error' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

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
      setStravaConnected(false);
      return;
    }
    const unsubWorkouts = subscribeToWorkouts(user.uid, setWorkouts);
    const unsubStrava = subscribeToStravaStatus(user.uid, setStravaConnected);
    return () => {
      unsubWorkouts();
      unsubStrava();
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

  // Stats de la semaine en cours (lundi-dimanche)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekWorkouts = workouts.filter((w) => {
    const d = new Date(w.date);
    return d >= weekStart && d <= weekEnd;
  });

  const weeklyStats: WeeklyStats = {
    swimDistance: thisWeekWorkouts.filter((w) => w.type === 'swim').reduce((sum, w) => sum + (w.distance || 0), 0),
    swimDuration: thisWeekWorkouts.filter((w) => w.type === 'swim').reduce((sum, w) => sum + w.duration, 0),
    bikeDistance: thisWeekWorkouts.filter((w) => w.type === 'bike').reduce((sum, w) => sum + (w.distance || 0), 0),
    bikeDuration: thisWeekWorkouts.filter((w) => w.type === 'bike').reduce((sum, w) => sum + w.duration, 0),
    runDistance: thisWeekWorkouts.filter((w) => w.type === 'run').reduce((sum, w) => sum + (w.distance || 0), 0),
    runDuration: thisWeekWorkouts.filter((w) => w.type === 'run').reduce((sum, w) => sum + w.duration, 0),
    strengthSessions: thisWeekWorkouts.filter((w) => w.type === 'strength').length,
    totalCalories: thisWeekWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0),
    totalWorkouts: thisWeekWorkouts.length,
  };

  // Weight data for chart
  const weightData = weights
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(w => ({
      date: new Date(w.date).toLocaleDateString('fr-FR'),
      weight: w.weight,
    }));

  const handleAddWeight = (weight: number, date: Date, notes?: string) => {
    const newEntry: WeightEntry = {
      id: Math.random().toString(),
      userId: 'user1',
      date,
      weight,
      notes,
    };
    setWeights([...weights, newEntry]);
  };

  const tabs = [
    { id: 'dashboard', label: '📊 Tableau de bord' },
    { id: 'calendar', label: '📅 Calendrier' },
    { id: 'weight', label: '⚖️ Poids' },
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
            weeklyStats={weeklyStats}
            zones={HR_ZONES}
            weightData={weightData}
            workouts={workouts}
            stravaConnected={stravaConnected}
            syncing={syncing}
            lastSyncCount={lastSyncCount}
            onConnectStrava={handleConnectStrava}
            onSyncStrava={handleSyncStrava}
          />
        )}

        {activeTab === 'calendar' && (
          <Calendar workouts={workouts} uid={user.uid} />
        )}

        {activeTab === 'weight' && (
          <WeightTracker entries={weights} onAddEntry={handleAddWeight} />
        )}

        {activeTab === 'vaping' && (
          <VapingCounter
            startDate={new Date(new Date().setDate(new Date().getDate() - 15))}
            onReset={() => {}}
          />
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
