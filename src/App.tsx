import { useState } from 'react';
import { Settings, LogOut, Menu, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Calendar from './components/Calendar';
import WeightTracker from './components/WeightTracker';
import VapingCounter from './components/VapingCounter';
import { Workout, WeightEntry, WeeklyStats } from './types';
import { HR_ZONES, WEIGHT_START_LBS } from './data/trainingPlan';

// Mock data for development
const MOCK_WORKOUTS: Workout[] = [
  {
    id: '1',
    userId: 'user1',
    date: new Date(new Date().setDate(new Date().getDate() - 1)),
    type: 'swim',
    duration: 45,
    distance: 1.2,
    calories: 450,
    heartRate: { avg: 140, max: 160 },
    source: 'health_connect',
    syncedAt: new Date(),
  },
  {
    id: '2',
    userId: 'user1',
    date: new Date(new Date().setDate(new Date().getDate() - 2)),
    type: 'bike',
    duration: 90,
    distance: 35,
    calories: 800,
    heartRate: { avg: 145, max: 170 },
    source: 'strava',
    syncedAt: new Date(),
  },
  {
    id: '3',
    userId: 'user1',
    date: new Date(new Date().setDate(new Date().getDate() - 3)),
    type: 'run',
    duration: 35,
    distance: 5.2,
    calories: 520,
    heartRate: { avg: 155, max: 175 },
    source: 'health_connect',
    syncedAt: new Date(),
  },
  {
    id: '4',
    userId: 'user1',
    date: new Date(),
    type: 'strength',
    duration: 60,
    calories: 350,
    source: 'manual',
    syncedAt: new Date(),
  },
];

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
  const [workouts] = useState<Workout[]>(MOCK_WORKOUTS);
  const [weights, setWeights] = useState<WeightEntry[]>(MOCK_WEIGHTS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'weight' | 'vaping'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Calculate weekly stats
  const weeklyStats: WeeklyStats = {
    swimDistance: workouts
      .filter(w => w.type === 'swim')
      .reduce((sum, w) => sum + (w.distance || 0), 0),
    swimDuration: workouts
      .filter(w => w.type === 'swim')
      .reduce((sum, w) => sum + w.duration, 0),
    bikeDistance: workouts
      .filter(w => w.type === 'bike')
      .reduce((sum, w) => sum + (w.distance || 0), 0),
    bikeDuration: workouts
      .filter(w => w.type === 'bike')
      .reduce((sum, w) => sum + w.duration, 0),
    runDistance: workouts
      .filter(w => w.type === 'run')
      .reduce((sum, w) => sum + (w.distance || 0), 0),
    runDuration: workouts
      .filter(w => w.type === 'run')
      .reduce((sum, w) => sum + w.duration, 0),
    strengthSessions: workouts.filter(w => w.type === 'strength').length,
    totalCalories: workouts.reduce((sum, w) => sum + (w.calories || 0), 0),
    totalWorkouts: workouts.length,
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

  if (!isLoggedIn) {
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
            onClick={() => setIsLoggedIn(true)}
            className="w-full bg-primary-600/20 border border-primary-400/50 text-primary-300 py-3 rounded-lg hover:bg-primary-600/30 hover:shadow-neon-cyan font-semibold transition-all"
          >
            Se connecter avec Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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
              <button className="p-2 hover:bg-cyber-panel2 rounded-lg text-slate-400 hover:text-primary-300">
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsLoggedIn(false)}
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
          <Dashboard weeklyStats={weeklyStats} zones={HR_ZONES} weightData={weightData} />
        )}

        {activeTab === 'calendar' && (
          <Calendar workouts={workouts} />
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
