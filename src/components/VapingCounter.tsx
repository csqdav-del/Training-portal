import { useState, useEffect } from 'react';
import { Flame, Heart, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';

interface VapingCounterProps {
  /** null tant qu'aucune date d'arrêt n'a été enregistrée. */
  startDate: Date | null;
  onSetStartDate: (date: Date) => void;
  onReset?: () => void;
}

const COST_PER_DAY = 5; // $/jour, estimation

export default function VapingCounter({ startDate, onSetStartDate, onReset }: VapingCounterProps) {
  const [daysCount, setDaysCount] = useState(0);
  const [hours, setHours] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState(format(startDate ?? new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (startDate) setDateInput(format(startDate, 'yyyy-MM-dd'));
  }, [startDate]);

  useEffect(() => {
    if (!startDate) {
      setDaysCount(0);
      setHours(0);
      return;
    }

    const calculateTime = () => {
      const diffMs = Date.now() - new Date(startDate).getTime();
      const safeMs = Math.max(0, diffMs); // une date future ne doit pas donner de compteur négatif
      setDaysCount(Math.floor(safeMs / (1000 * 60 * 60 * 24)));
      setHours(Math.floor((safeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000);
    return () => clearInterval(interval);
  }, [startDate]);

  const handleSaveDate = () => {
    if (!dateInput) return;
    // On garde midi local pour éviter les décalages de fuseau au passage en ISO.
    const [y, m, d] = dateInput.split('-').map(Number);
    onSetStartDate(new Date(y, m - 1, d, 12, 0, 0));
    setEditing(false);
  };

  const moneySaved = (daysCount * COST_PER_DAY).toFixed(2);
  const lungImprovement = Math.min(100, Math.floor((daysCount / 30) * 5));

  // Première visite : on demande la date au lieu d'inventer « aujourd'hui ».
  if (!startDate) {
    return (
      <div className="glass-panel p-8 shadow-neon-purple border-sport-strength/30 max-w-md mx-auto">
        <h2 className="text-2xl font-display font-bold text-sport-strength mb-2 uppercase tracking-wide text-center">
          Arrêt de la Vapoteuse 🎯
        </h2>
        <p className="text-slate-400 font-mono text-sm text-center mb-6">Quand as-tu arrêté ?</p>
        <input
          type="date"
          value={dateInput}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={(e) => setDateInput(e.target.value)}
          className="w-full bg-cyber-bg border border-cyber-line rounded-lg px-3 py-2 text-slate-100 font-mono mb-4 focus:border-primary-400 focus:outline-none"
        />
        <button
          onClick={handleSaveDate}
          className="w-full bg-sport-strength/20 border border-sport-strength/50 text-sport-strength py-2.5 rounded-lg font-semibold hover:bg-sport-strength/30"
        >
          Démarrer le compteur
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel p-8 shadow-neon-purple border-sport-strength/30">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-sport-strength mb-2 uppercase tracking-wide">Arrêt de la Vapoteuse 🎯</h2>
        {editing ? (
          <div className="flex items-center justify-center gap-2">
            <input
              type="date"
              value={dateInput}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setDateInput(e.target.value)}
              className="bg-cyber-bg border border-cyber-line rounded-lg px-3 py-1.5 text-sm text-slate-100 font-mono focus:border-primary-400 focus:outline-none"
            />
            <button
              onClick={handleSaveDate}
              className="p-2 rounded-lg border border-sport-strength/50 text-sport-strength hover:bg-sport-strength/20"
              title="Enregistrer"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-slate-400 font-mono hover:text-primary-300 inline-flex items-center gap-1.5"
            title="Corriger la date d'arrêt"
          >
            Tu as arrêté le {new Date(startDate).toLocaleDateString('fr-FR')}
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Counter */}
      <div className="bg-cyber-panel2 border border-sport-strength/30 rounded-xl p-8 mb-8">
        <div className="text-center">
          <div className="flex justify-center items-baseline gap-4 mb-4">
            <div>
              <div className="text-6xl font-bold text-sport-strength text-glow-cyan font-mono">{daysCount}</div>
              <div className="text-slate-400 text-sm mt-2">Jours</div>
            </div>
            <div className="text-4xl text-slate-600">•</div>
            <div>
              <div className="text-4xl font-bold text-primary-300 font-mono">{hours}</div>
              <div className="text-slate-400 text-sm mt-2">Heures</div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-slate-400">Économies estimées</span>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">${moneySaved}</div>
        </div>

        <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-sport-run" />
            <span className="text-sm text-slate-400">Santé pulmonaire</span>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">{lungImprovement}%</div>
        </div>

        <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏃</span>
            <span className="text-sm text-slate-400">Entraînement boost</span>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">+{Math.min(50, daysCount * 2)}%</div>
        </div>
      </div>

      {/* Reset Button */}
      {onReset && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              if (window.confirm('Repartir de zéro à partir de maintenant ?')) onReset();
            }}
            className="bg-sport-run/20 border border-sport-run/50 text-sport-run hover:bg-sport-run/30 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Réinitialiser le compteur
          </button>
        </div>
      )}

      {/* Motivational message */}
      <div className="mt-8 p-4 bg-cyber-panel2 rounded-lg border border-sport-strength/30">
        <p className="text-center text-slate-300 text-sm">
          {daysCount === 0
            ? "C'est le premier jour ! Tu vas le faire 💪"
            : daysCount < 7
            ? 'Les premiers jours sont les plus durs. Continue !'
            : daysCount < 30
            ? 'Un mois ? Presque là ! Ton cardio te remerciera 🫁'
            : "Wow ! Plus d'un mois ! Tu es une machine 🔥"}
        </p>
      </div>
    </div>
  );
}
