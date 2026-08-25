import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WeightEntry } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { WEIGHT_GOAL_LBS, WEIGHT_START_LBS } from '../data/trainingPlan';

interface WeightTrackerProps {
  entries: WeightEntry[];
  onAddEntry: (weight: number, date: Date, notes?: string) => void;
  onDeleteEntry?: (entryId: string) => void;
}

export default function WeightTracker({ entries, onAddEntry, onDeleteEntry }: WeightTrackerProps) {
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) return;

    // `new Date('2026-08-22')` serait interprété en UTC : à Montréal la pesée
    // basculerait la veille. On construit donc la date en heure locale.
    const [y, m, d] = date.split('-').map(Number);
    onAddEntry(parseFloat(weight), new Date(y, m - 1, d, 12, 0, 0), notes);
    setWeight('');
    setNotes('');
    setShowForm(false);
  };

  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestWeight = sortedEntries[0]?.weight;
  const startWeight = sortedEntries[sortedEntries.length - 1]?.weight ?? WEIGHT_START_LBS;
  const weightChange = latestWeight ? (latestWeight - startWeight).toFixed(1) : '0';
  const toLose = latestWeight ? Math.max(0, latestWeight - WEIGHT_GOAL_LBS) : 0;
  const progressPercent = latestWeight
    ? Math.min(100, Math.max(0, ((WEIGHT_START_LBS - latestWeight) / (WEIGHT_START_LBS - WEIGHT_GOAL_LBS)) * 100))
    : 0;

  // Le graphique se lit de la plus ancienne à la plus récente pesée.
  const chartData = [...sortedEntries]
    .reverse()
    .map((entry) => ({
      label: format(new Date(entry.date), 'd MMM', { locale: fr }),
      poids: entry.weight,
    }));

  return (
    <div className="glass-panel p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">Suivi du Poids</h2>
          {latestWeight && (
            <div className="mt-2">
              <div className="text-4xl font-bold text-primary-300 text-glow-cyan font-mono">
                {latestWeight} <span className="text-lg text-slate-400">lbs</span>
              </div>
              <div className={`text-sm font-mono ${parseFloat(weightChange) < 0 ? 'text-sport-bike' : 'text-sport-run'}`}>
                {parseFloat(weightChange) > 0 ? '+' : ''}
                {weightChange} lbs depuis le début
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600/20 border border-primary-400/50 text-primary-300 px-4 py-2 rounded-lg hover:bg-primary-600/30 hover:shadow-neon-cyan flex items-center gap-2 font-medium self-start"
        >
          <Plus className="w-5 h-5" />
          Ajouter
        </button>
      </div>

      {/* Courbe de poids — une barre de progression seule ne montre ni la tendance
          ni les paliers ; le graphique garde les deux lisibles. */}
      <div className="mb-6 bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Courbe de poids</h3>
          <span className="text-xs text-slate-600 font-mono">
            {sortedEntries.length} pesée{sortedEntries.length > 1 ? 's' : ''}
          </span>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500 font-mono py-8 text-center">
            Aucune pesée enregistrée — ajoute la première pour lancer la courbe
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 5, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#20233a" />
              <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis
                domain={[
                  (min: number) => Math.floor(Math.min(min, WEIGHT_GOAL_LBS) - 2),
                  (max: number) => Math.ceil(max + 2),
                ]}
                stroke="#64748b"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#0c0c15',
                  border: '1px solid #20233a',
                  borderRadius: 8,
                  color: '#e2e8f0',
                }}
                formatter={(value: number) => [`${value} lbs`, 'Poids']}
              />
              <ReferenceLine
                y={WEIGHT_GOAL_LBS}
                stroke="#34ff9d"
                strokeDasharray="4 4"
                label={{ value: `Objectif ${WEIGHT_GOAL_LBS}`, fill: '#34ff9d', fontSize: 10, position: 'insideBottomRight' }}
              />
              <Line
                type="monotone"
                dataKey="poids"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ r: 3, fill: '#22d3ee' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Goal progress */}
      <div className="mb-6 bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
        <div className="flex justify-between text-sm mb-2 font-mono">
          <span className="text-slate-400">Objectif race: {WEIGHT_GOAL_LBS} lbs</span>
          <span className="text-primary-300">{toLose > 0 ? `${toLose.toFixed(1)} lbs restants` : 'Objectif atteint 🎯'}</span>
        </div>
        <div className="w-full bg-cyber-bg rounded-full h-2.5 border border-cyber-line overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-sport-bike shadow-neon-cyan transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
          <span>{WEIGHT_START_LBS} lbs</span>
          <span>{progressPercent.toFixed(0)}%</span>
          <span>{WEIGHT_GOAL_LBS} lbs</span>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-cyber-panel2 p-4 rounded-lg mb-6 border border-cyber-line">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Poids (lbs)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 border border-cyber-line rounded-lg"
                placeholder="288.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-cyber-line rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Notes (opt.)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-cyber-line rounded-lg"
                placeholder="Matin, après gym..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-primary-600/20 border border-primary-400/50 text-primary-300 px-4 py-2 rounded-lg hover:bg-primary-600/30 text-sm font-medium"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-cyber-panel2 border border-cyber-line text-slate-300 px-4 py-2 rounded-lg hover:bg-cyber-line text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Historique complet — on ne tronque plus à 5 : une pesée saisie doit
          rester visible, sinon on croit l'avoir perdue. */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
          Historique complet ({sortedEntries.length})
        </h3>
        {sortedEntries.length === 0 ? (
          <p className="text-sm text-slate-500 font-mono">Aucune pesée pour l'instant</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {sortedEntries.map((entry, i) => {
              // Écart avec la pesée précédente (la suivante dans l'ordre décroissant).
              const previous = sortedEntries[i + 1];
              const diff = previous ? entry.weight - previous.weight : null;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 p-2 bg-cyber-panel2 border border-cyber-line rounded"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100 font-mono flex items-baseline gap-2">
                      {entry.weight} lbs
                      {diff !== null && diff !== 0 && (
                        <span className={`text-xs ${diff < 0 ? 'text-sport-bike' : 'text-sport-run'}`}>
                          {diff > 0 ? '+' : ''}
                          {diff.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(new Date(entry.date), 'dd MMMM yyyy', { locale: fr })}
                      {entry.source === 'health_connect' && ' • balance connectée'}
                      {entry.notes && ` • ${entry.notes}`}
                    </div>
                  </div>
                  {onDeleteEntry && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Supprimer la pesée de ${entry.weight} lbs ?`)) onDeleteEntry(entry.id);
                      }}
                      title="Supprimer cette pesée"
                      className="text-slate-600 hover:text-sport-run shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
