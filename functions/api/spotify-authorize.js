/* ============================================================
   GET /api/spotify-authorize
   Inicia el flujo OAuth de Spotify para obtener el refresh token
   que permite agregar canciones a la playlist.
   Solo se usa UNA VEZ para obtener el SPOTIFY_REFRESH_TOKEN.
   ============================================================ */

import { readEnv } from './_utils.js';

const REDIRECT_URI = 'https://zcwedding.com/api/spotify-auth-callback';
const SCOPE = 'playlist-modify-public playlist-modify-private';

export async function onRequestGet({ env }) {
  const clientId = readEnv(env, 'SPOTIFY_CLIENT_ID');
  if (!clientId) {
    return new Response('SPOTIFY_CLIENT_ID no configurado', { status: 503 });
  }
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPE);
  return Response.redirect(url.toString(), 302);
}
