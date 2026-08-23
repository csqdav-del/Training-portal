import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Workout } from '../types';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CalendarProps {
  workouts: Workout[];
  onDateClick?: (date: Date) => void;
}

export default function Calendar({ workouts, onDateClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getWorkoutsForDate = (date: Date) => {
    return workouts.filter(w =>
      new Date(w.date).toDateString() === date.toDateString()
    );
  };

  const typeColors: Record<string, string> = {
    swim: 'bg-blue-100 text-blue-900 border-blue-300',
    bike: 'bg-green-100 text-green-900 border-green-300',
    run: 'bg-red-100 text-red-900 border-red-300',
    strength: 'bg-purple-100 text-purple-900 border-purple-300',
  };

  const typeLabels: Record<string, string> = {
    swim: '🏊 Natation',
    bike: '🚴 Vélo',
    run: '🏃 Course',
    strength: '💪 Muscu',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          Semaine du {format(weekStart, 'd MMM', { locale: fr })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 text-sm font-medium hover:bg-gray-100 rounded-lg"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((day, idx) => {
          const dayWorkouts = getWorkoutsForDate(day);
          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <div
              key={idx}
              onClick={() => onDateClick?.(day)}
              className={`border rounded-lg p-3 min-h-24 cursor-pointer transition-all ${
                isToday
                  ? 'bg-primary-50 border-primary-300 shadow-md'
                  : 'bg-gray-50 border-gray-200 hover:border-primary-300'
              }`}
            >
              <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-primary-700' : 'text-gray-700'}`}>
                {format(day, 'EEE', { locale: fr })}.
                <br />
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayWorkouts.length === 0 ? (
                  <div className="text-xs text-gray-400">Repos</div>
                ) : (
                  dayWorkouts.map((workout, wIdx) => (
                    <div
                      key={wIdx}
                      className={`text-xs px-2 py-1 rounded border ${typeColors[workout.type]}`}
                      title={`${workout.distance ? workout.distance + 'km' : ''} - ${workout.duration}min`}
                    >
                      {typeLabels[workout.type]}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-300 rounded"></div>
          <span>Natation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-300 rounded"></div>
          <span>Vélo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-300 rounded"></div>
          <span>Course</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-300 rounded"></div>
          <span>Muscu</span>
        </div>
      </div>
    </div>
  );
}
