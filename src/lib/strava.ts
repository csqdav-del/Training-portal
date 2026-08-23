import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;

export function connectStrava(uid: string) {
  const redirectUri = `${window.location.origin}/.netlify/functions/strava-callback`;
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', 'activity:read_all');
  url.searchParams.set('state', uid);
  window.location.href = url.toString();
}

export async function syncStrava(): Promise<{ synced: number } | { error: string }> {
  const user = auth.currentUser;
  if (!user) return { error: 'not_logged_in' };
  const idToken = await user.getIdToken();
  const res = await fetch('/.netlify/functions/strava-sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return { error: `http_${res.status}` };
  return res.json();
}

export function subscribeToStravaStatus(uid: string, callback: (connected: boolean) => void): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(Boolean(snap.data()?.stravaConnected));
  });
}
