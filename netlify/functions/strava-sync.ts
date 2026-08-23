import { adminAuth, adminDb } from './_firebaseAdmin';

function mapDiscipline(sportType: string): string {
  if (['Run', 'TrailRun', 'VirtualRun'].includes(sportType)) return 'run';
  if (['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'Handcycle'].includes(sportType)) return 'bike';
  if (sportType === 'Swim') return 'swim';
  if (['WeightTraining', 'Workout', 'Crossfit', 'Elliptical', 'StairStepper', 'HighIntensityIntervalTraining'].includes(sportType)) {
    return 'strength';
  }
  if (['Walk', 'Hike'].includes(sportType)) return 'walk';
  return 'other';
}

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.replace('Bearer ', '');
  if (!idToken) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const db = adminDb();
  const stravaRef = db.doc(`users/${uid}/private/strava`);
  const stravaSnap = await stravaRef.get();

  if (!stravaSnap.exists) {
    return new Response(JSON.stringify({ error: 'not_connected' }), { status: 400 });
  }

  let { accessToken, refreshToken, expiresAt } = stravaSnap.data() as StravaTokens;

  if (expiresAt * 1000 < Date.now() + 60_000) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.VITE_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!refreshRes.ok) {
      return new Response(JSON.stringify({ error: 'refresh_failed' }), { status: 502 });
    }
    const refreshed = await refreshRes.json();
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token;
    expiresAt = refreshed.expires_at;
    await stravaRef.set({ accessToken, refreshToken, expiresAt }, { merge: true });
  }

  const after = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60; // 60 derniers jours
  const actRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!actRes.ok) {
    return new Response(JSON.stringify({ error: 'fetch_failed' }), { status: 502 });
  }

  const activities: any[] = await actRes.json();
  const batch = db.batch();
  let count = 0;

  for (const a of activities) {
    const discipline = mapDiscipline(a.sport_type || a.type);
    const ref = db.doc(`users/${uid}/workouts/strava_${a.id}`);
    batch.set(
      ref,
      {
        id: `strava_${a.id}`,
        userId: uid,
        date: new Date(a.start_date_local).toISOString(),
        type: discipline,
        duration: Math.round((a.moving_time || 0) / 60),
        distance: a.distance ? Math.round((a.distance / 1000) * 100) / 100 : null,
        calories: a.calories ?? null,
        heartRate: a.average_heartrate
          ? { avg: Math.round(a.average_heartrate), max: Math.round(a.max_heartrate || a.average_heartrate) }
          : null,
        notes: a.name ?? null,
        source: 'strava',
        externalId: String(a.id),
        syncedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    count++;
  }

  if (count > 0) await batch.commit();

  await db.doc(`users/${uid}`).set({ lastStravaSyncAt: Date.now(), lastStravaSyncCount: count }, { merge: true });

  return new Response(JSON.stringify({ synced: count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
