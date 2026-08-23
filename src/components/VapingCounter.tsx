import React, { useState, useEffect } from 'react';
import { Flame, Heart } from 'lucide-react';

interface VapingCounterProps {
  startDate: Date;
  onReset?: () => void;
}

export default function VapingCounter({ startDate, onReset }: VapingCounterProps) {
  const [daysCount, setDaysCount] = useState(0);
  const [hours, setHours] = useState(0);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const start = new Date(startDate);
      const diffMs = now.getTime() - start.getTime();

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const remainingMs = diffMs % (1000 * 60 * 60 * 24);
      const hoursValue = Math.floor(remainingMs / (1000 * 60 * 60));

      setDaysCount(days);
      setHours(hoursValue);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [startDate]);

  // Estimated savings (average $5/day)
  const moneySaved = (daysCount * 5).toFixed(2);
  // Estimated lung recovery (very rough estimate)
  const lungImprovement = Math.min(100, Math.floor((daysCount / 30) * 5));

  return (
    <div className="bg-gradient-to-br from-purple-600 to-purple-900 text-white rounded-lg p-8 shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Arrêt de la Vapoteuse 🎯</h2>
        <p className="text-purple-100">Tu as commencé {new Date(startDate).toLocaleDateString('fr-FR')}</p>
      </div>

      {/* Main Counter */}
      <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-8 mb-8">
        <div className="text-center">
          <div className="flex justify-center items-baseline gap-4 mb-4">
            <div>
              <div className="text-6xl font-bold text-white">{daysCount}</div>
              <div className="text-purple-200 text-sm mt-2">Jours</div>
            </div>
            <div className="text-4xl text-purple-200">•</div>
            <div>
              <div className="text-4xl font-bold text-purple-200">{hours}</div>
              <div className="text-purple-200 text-sm mt-2">Heures</div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white bg-opacity-10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-yellow-300" />
            <span className="text-sm text-purple-200">Économies estimées</span>
          </div>
          <div className="text-2xl font-bold text-white">${moneySaved}</div>
        </div>

        <div className="bg-white bg-opacity-10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-red-300" />
            <span className="text-sm text-purple-200">Santé pulmonaire</span>
          </div>
          <div className="text-2xl font-bold text-white">{lungImprovement}%</div>
        </div>

        <div className="bg-white bg-opacity-10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏃</span>
            <span className="text-sm text-purple-200">Entraînement boost</span>
          </div>
          <div className="text-2xl font-bold text-white">+{Math.min(50, daysCount * 2)}%</div>
        </div>
      </div>

      {/* Reset Button */}
      {onReset && (
        <div className="flex justify-center">
          <button
            onClick={onReset}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Réinitialiser le compteur
          </button>
        </div>
      )}

      {/* Motivational message */}
      <div className="mt-8 p-4 bg-white bg-opacity-10 rounded-lg border border-purple-400 border-opacity-30">
        <p className="text-center text-purple-100 text-sm">
          {daysCount === 0
            ? "C'est le premier jour ! Tu vas le faire 💪"
            : daysCount < 7
            ? "Les premiers jours sont les plus durs. Continue !"
            : daysCount < 30
            ? "Un mois ? Presque là ! Ton cardio te remerciera 🫁"
            : "Wow ! Plus d'un mois ! Tu es une machine 🔥"}
        </p>
      </div>
    </div>
  );
}
