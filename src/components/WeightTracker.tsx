import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { WeightEntry } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WeightTrackerProps {
  entries: WeightEntry[];
  onAddEntry: (weight: number, date: Date, notes?: string) => void;
}

export default function WeightTracker({ entries, onAddEntry }: WeightTrackerProps) {
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) return;

    onAddEntry(parseFloat(weight), new Date(date), notes);
    setWeight('');
    setNotes('');
    setShowForm(false);
  };

  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestWeight = sortedEntries[0]?.weight;
  const startWeight = sortedEntries[sortedEntries.length - 1]?.weight;
  const weightChange = startWeight && latestWeight ? (latestWeight - startWeight).toFixed(1) : '0';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Suivi du Poids</h2>
          {latestWeight && (
            <div className="mt-2">
              <div className="text-3xl font-bold text-gray-900">{latestWeight} kg</div>
              <div className={`text-sm ${parseFloat(weightChange) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} kg
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poids (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="85.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (opt.)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Matin, après gym..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-300 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-400 text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Recent Entries */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Historique récent</h3>
        {sortedEntries.slice(0, 5).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div>
              <div className="font-medium text-gray-900">{entry.weight} kg</div>
              <div className="text-xs text-gray-500">
                {format(new Date(entry.date), 'dd MMMM yyyy', { locale: fr })}
                {entry.notes && ` • ${entry.notes}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
