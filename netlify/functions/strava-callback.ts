import { adminDb } from './_firebaseAdmin';

export default async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const uid = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const siteUrl = process.env.URL || `${url.protocol}//${url.host}`;

  if (oauthError || !code || !uid) {
    return Response.redirect(`${siteUrl}/?strava=error`, 302);
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.VITE_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Strava token exchange failed', tokenRes.status, await tokenRes.text());
      return Response.redirect(`${siteUrl}/?strava=error`, 302);
    }

    const tokenData = await tokenRes.json();
    const db = adminDb();

    await db.doc(`users/${uid}/private/strava`).set({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      athleteId: tokenData.athlete?.id ?? null,
      connectedAt: Date.now(),
    });

    await db.doc(`users/${uid}`).set(
      {
        stravaConnected: true,
        stravaAthleteId: tokenData.athlete?.id ?? null,
        stravaConnectedAt: Date.now(),
      },
      { merge: true },
    );

    return Response.redirect(`${siteUrl}/?strava=connected`, 302);
  } catch (err) {
    console.error('strava-callback error', err);
    return Response.redirect(`${siteUrl}/?strava=error`, 302);
  }
};
