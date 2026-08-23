import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Droplet, Bike, Wind, Zap } from 'lucide-react';
import { WeeklyStats, TrainingZones } from '../types';

interface DashboardProps {
  weeklyStats: WeeklyStats;
  zones: TrainingZones;
  weightData: { date: string; weight: number }[];
}

export default function Dashboard({ weeklyStats, zones, weightData }: DashboardProps) {
  const stats = [
    {
      label: 'Natation',
      distance: weeklyStats.swimDistance.toFixed(2),
      duration: weeklyStats.swimDuration,
      icon: Droplet,
      color: 'text-sport-swim',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Vélo',
      distance: weeklyStats.bikeDistance.toFixed(2),
      duration: weeklyStats.bikeDuration,
      icon: Bike,
      color: 'text-sport-bike',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Course',
      distance: weeklyStats.runDistance.toFixed(2),
      duration: weeklyStats.runDuration,
      icon: Wind,
      color: 'text-sport-run',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Musculation',
      distance: `${weeklyStats.strengthSessions}`,
      duration: 0,
      icon: Zap,
      color: 'text-sport-strength',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={`${stat.bgColor} rounded-lg p-4 border border-gray-200`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">{stat.label}</h3>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.distance}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.duration} min</div>
            </div>
          );
        })}
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Entraînements</div>
          <div className="text-3xl font-bold text-gray-900">{weeklyStats.totalWorkouts}</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Calories (semaine)</div>
          <div className="text-3xl font-bold text-gray-900">{weeklyStats.totalCalories}</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Volume Total (km)</div>
          <div className="text-3xl font-bold text-gray-900">
            {(weeklyStats.swimDistance + weeklyStats.bikeDistance + weeklyStats.runDistance).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weight Trend */}
        {weightData.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Poids (tendance)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#0284c7" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* HR Zones Distribution (Mock) */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Zones d'Entraînement</h3>
          <div className="space-y-3">
            {Object.entries(zones).map(([key, zone]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{zone.label}</span>
                  <span className="text-gray-600">{zone.min}-{zone.max} bpm</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
