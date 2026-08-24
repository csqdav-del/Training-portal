import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Droplets, Pencil } from 'lucide-react';
import { FoodSearchResult, MealEntry, MealType } from '../types';
import { NUTRITION_TARGETS } from '../data/trainingPlan';
import { addMealEntry, removeMealEntry, searchFood, subscribeToNutritionLog } from '../lib/nutrition';

interface NutritionTrackerProps {
  uid: string;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Déjeuner',
  lunch: 'Dîner',
  dinner: 'Souper',
  snack: 'Collation',
};

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function NutritionTracker({ uid }: NutritionTrackerProps) {
  const today = new Date();
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mode, setMode] = useState<'search' | 'manual'>('search');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null);
  const [grams, setGrams] = useState('100');

  const [manualLabel, setManualLabel] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');

  useEffect(() => {
    const unsub = subscribeToNutritionLog(uid, today, setEntries);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      const res = await searchFood(query);
      setSearching(false);
      if (Array.isArray(res)) {
        setResults(res);
      } else {
        setSearchError(res.error === 'nutrition_api_not_configured' ? 'Recherche non configurée — utilise la saisie manuelle' : 'Recherche indisponible');
        setResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, mode]);

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const resetForm = () => {
    setQuery('');
    setResults([]);
    setSelectedFood(null);
    setGrams('100');
    setManualLabel('');
    setManualKcal('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setShowForm(false);
  };

  const handleAddFromSearch = () => {
    if (!selectedFood) return;
    const g = parseFloat(grams) || 0;
    const factor = g / 100;
    const entry: MealEntry = {
      id: Math.random().toString(36).slice(2),
      mealType,
      label: selectedFood.label,
      grams: g,
      kcal: Math.round(selectedFood.kcal100 * factor),
      proteinG: Math.round(selectedFood.protein100 * factor * 10) / 10,
      carbsG: Math.round(selectedFood.carbs100 * factor * 10) / 10,
      fatG: Math.round(selectedFood.fat100 * factor * 10) / 10,
      loggedAt: new Date().toISOString(),
    };
    addMealEntry(uid, today, entries, entry);
    resetForm();
  };

  const handleAddManual = () => {
    if (!manualLabel.trim()) return;
    const entry: MealEntry = {
      id: Math.random().toString(36).slice(2),
      mealType,
      label: manualLabel.trim(),
      grams: 0,
      kcal: parseFloat(manualKcal) || 0,
      proteinG: parseFloat(manualProtein) || 0,
      carbsG: parseFloat(manualCarbs) || 0,
      fatG: parseFloat(manualFat) || 0,
      loggedAt: new Date().toISOString(),
    };
    addMealEntry(uid, today, entries, entry);
    resetForm();
  };

  const macroBar = (label: string, value: number, target: number, color: string) => (
    <div>
      <div className="flex justify-between text-sm mb-1 font-mono">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-500">
          {Math.round(value)} / {target}g
        </span>
      </div>
      <div className="w-full bg-cyber-bg rounded-full h-2.5 border border-cyber-line overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">Nutrition — Aujourd'hui</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary-600/20 border border-primary-400/50 text-primary-300 px-4 py-2 rounded-lg hover:bg-primary-600/30 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> Ajouter un repas
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4">
            <div className="text-sm text-slate-500 mb-1">Calories</div>
            <div className="text-3xl font-bold text-slate-100 font-mono">
              {Math.round(totals.kcal)} <span className="text-base text-slate-500">/ {NUTRITION_TARGETS.kcal} kcal</span>
            </div>
            <div className="w-full bg-cyber-bg rounded-full h-2.5 border border-cyber-line overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-sport-strength transition-all duration-500"
                style={{ width: `${Math.min(100, (totals.kcal / NUTRITION_TARGETS.kcal) * 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4 space-y-3">
            {macroBar('Protéines', totals.proteinG, NUTRITION_TARGETS.proteinG, 'bg-sport-run')}
            {macroBar('Glucides', totals.carbsG, NUTRITION_TARGETS.carbsG, 'bg-sport-bike')}
            {macroBar('Lipides', totals.fatG, NUTRITION_TARGETS.fatG, 'bg-sport-strength')}
          </div>
        </div>

        {showForm && (
          <div className="bg-cyber-panel2 border border-cyber-line rounded-lg p-4 mb-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="px-3 py-2 border border-cyber-line rounded-lg text-sm"
              >
                {MEAL_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </option>
                ))}
              </select>
              <div className="flex gap-1 bg-cyber-bg border border-cyber-line rounded-lg p-1">
                <button
                  onClick={() => setMode('search')}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${mode === 'search' ? 'bg-primary-600/30 text-primary-300' : 'text-slate-500'}`}
                >
                  <Search className="w-3.5 h-3.5" /> Rechercher
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${mode === 'manual' ? 'bg-primary-600/30 text-primary-300' : 'text-slate-500'}`}
                >
                  <Pencil className="w-3.5 h-3.5" /> Manuel
                </button>
              </div>
            </div>

            {mode === 'search' ? (
              <div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedFood(null);
                  }}
                  placeholder="Chercher un aliment (ex: banane, poulet grillé...)"
                  className="w-full px-3 py-2 border border-cyber-line rounded-lg text-sm"
                />
                {searching && <div className="text-xs text-slate-500 mt-2 font-mono">Recherche...</div>}
                {searchError && <div className="text-xs text-amber-400 mt-2 font-mono">{searchError}</div>}
                {results.length > 0 && !selectedFood && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {results.map((r) => (
                      <button
                        key={r.foodId}
                        onClick={() => setSelectedFood(r)}
                        className="w-full text-left px-3 py-2 bg-cyber-bg border border-cyber-line rounded-lg hover:border-primary-400/50 text-sm flex justify-between"
                      >
                        <span className="text-slate-200">{r.label}</span>
                        <span className="text-slate-500 font-mono text-xs">{r.kcal100} kcal/100g</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedFood && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-sm text-primary-300 flex-1">{selectedFood.label}</span>
                    <input
                      type="number"
                      value={grams}
                      onChange={(e) => setGrams(e.target.value)}
                      className="w-24 px-3 py-2 border border-cyber-line rounded-lg text-sm"
                    />
                    <span className="text-sm text-slate-500">g</span>
                    <button
                      onClick={handleAddFromSearch}
                      className="bg-primary-600/20 border border-primary-400/50 text-primary-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600/30"
                    >
                      Ajouter
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  placeholder="Nom du repas"
                  className="col-span-2 md:col-span-1 px-3 py-2 border border-cyber-line rounded-lg text-sm"
                />
                <input type="number" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} placeholder="kcal" className="px-3 py-2 border border-cyber-line rounded-lg text-sm" />
                <input type="number" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} placeholder="Protéines g" className="px-3 py-2 border border-cyber-line rounded-lg text-sm" />
                <input type="number" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} placeholder="Glucides g" className="px-3 py-2 border border-cyber-line rounded-lg text-sm" />
                <input type="number" value={manualFat} onChange={(e) => setManualFat(e.target.value)} placeholder="Lipides g" className="px-3 py-2 border border-cyber-line rounded-lg text-sm" />
                <button
                  onClick={handleAddManual}
                  className="col-span-2 md:col-span-5 bg-primary-600/20 border border-primary-400/50 text-primary-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600/30"
                >
                  Ajouter
                </button>
              </div>
            )}
          </div>
        )}

        {/* Repas du jour */}
        <div className="space-y-4">
          {MEAL_ORDER.map((m) => {
            const mealEntries = entries.filter((e) => e.mealType === m);
            if (mealEntries.length === 0) return null;
            return (
              <div key={m}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">{MEAL_LABELS[m]}</h3>
                <div className="space-y-1.5">
                  {mealEntries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between bg-cyber-panel2 border border-cyber-line rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm text-slate-200">{e.label}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {e.kcal} kcal · P{e.proteinG}g · G{e.carbsG}g · L{e.fatG}g
                        </div>
                      </div>
                      <button onClick={() => removeMealEntry(uid, today, entries, e.id)} className="p-1.5 hover:bg-cyber-bg rounded text-slate-500 hover:text-sport-run">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {entries.length === 0 && <div className="text-slate-500 text-sm font-mono text-center py-8">Aucun repas enregistré aujourd'hui</div>}
        </div>
      </div>

      <div className="glass-panel p-4 flex items-center gap-3">
        <Droplets className="w-5 h-5 text-primary-400" />
        <span className="text-sm text-slate-400">Objectif hydratation : <span className="text-primary-300 font-mono">{NUTRITION_TARGETS.hydrationL} L / jour</span></span>
      </div>
    </div>
  );
}
