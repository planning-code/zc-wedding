/* ============================================================
   POST /api/spotify-add-track   body: { trackId: string }
   Agrega un track a la playlist de la boda usando el
   refresh token del dueño de la playlist.
   Requiere: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET,
             SPOTIFY_REFRESH_TOKEN en Cloudflare.
   ============================================================ */

import { readEnv, json } from './_utils.js';

const PLAYLIST_ID = '4FzoQmrCXMBEkqJAOfl19h';

async function getUserToken(env) {
  const clientId = readEnv(env, 'SPOTIFY_CLIENT_ID');
  const clientSecret = readEnv(env, 'SPOTIFY_CLIENT_SECRET');
  const refreshToken = readEnv(env, 'SPOTIFY_REFRESH_TOKEN');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`token refresh ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function onRequestPost({ request, env }) {
  const refreshToken = readEnv(env, 'SPOTIFY_REFRESH_TOKEN');
  if (!refreshToken) {
    return json({ error: 'SPOTIFY_REFRESH_TOKEN no configurado. Visita /api/spotify-authorize para obtenerlo.' }, 503);
  }

  let trackId;
  try {
    const body = await request.json();
    trackId = body?.trackId;
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }
  if (!trackId) return json({ error: 'trackId requerido' }, 400);

  try {
    const token = await getUserToken(env);
    const res = await fetch(`https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `spotify ${res.status}`, detail }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
