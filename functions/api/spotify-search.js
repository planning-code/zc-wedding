/* ============================================================
   GET /api/spotify-search?q=...
   Búsqueda en Spotify usando Client Credentials (sin login del
   usuario). Requiere: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
   ============================================================ */

import { readEnv, json } from './_utils.js';

let cachedToken = null; // { access_token, expires_at }

async function getAppToken(env) {
  if (cachedToken && cachedToken.expires_at > Date.now()) return cachedToken.access_token;

  const clientId = readEnv(env, 'SPOTIFY_CLIENT_ID');
  const clientSecret = readEnv(env, 'SPOTIFY_CLIENT_SECRET');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json([], 200);

  if (!readEnv(env, 'SPOTIFY_CLIENT_ID') || !readEnv(env, 'SPOTIFY_CLIENT_SECRET')) {
    return json({ error: 'Spotify credentials not configured in environment' }, 503);
  }

  try {
    const token = await getAppToken(env);
    const sp = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=8&market=SV&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!sp.ok) {
      const body = await sp.text().catch(() => '');
      return json({ error: `spotify ${sp.status}`, detail: body }, 502);
    }

    const data = await sp.json();
    const tracks = (data.tracks?.items || []).map((t) => ({
      id: t.id,
      name: t.name,
      artist: (t.artists || []).map((a) => a.name).join(', '),
      albumArt: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || null,
      previewUrl: t.preview_url || null,
    }));
    return json(tracks, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

