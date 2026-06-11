/* ============================================================
   GET /api/spotify-auth-callback
   Recibe el code de Spotify, lo intercambia por tokens y
   muestra el refresh_token para que el admin lo guarde
   como SPOTIFY_REFRESH_TOKEN en Cloudflare.
   ============================================================ */

import { readEnv } from './_utils.js';

const REDIRECT_URI = 'https://zcwedding.com/api/spotify-auth-callback';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return html(`<h2>Error de Spotify</h2><p>${error}</p>`);
  }
  if (!code) {
    return html('<h2>Código no recibido</h2><p>Intenta de nuevo desde /api/spotify-authorize.</p>');
  }

  const clientId = readEnv(env, 'SPOTIFY_CLIENT_ID');
  const clientSecret = readEnv(env, 'SPOTIFY_CLIENT_SECRET');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return html(`<h2>Error al obtener token</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
  }

  return html(`
    <style>
      body { font-family: system-ui; max-width: 600px; margin: 4rem auto; padding: 1rem; }
      code { display: block; background: #f0f0f0; padding: 1rem; word-break: break-all; border-radius: 6px; font-size: .875rem; margin: 1rem 0; }
      p { color: #555; }
    </style>
    <h2>Autorización exitosa</h2>
    <p>Copia este valor y agrégalo como secret en Cloudflare Dashboard:<br>
    <strong>Settings → Variables and Secrets → + Add → Secret → Nombre: <code style="display:inline;background:none;padding:0">SPOTIFY_REFRESH_TOKEN</code></strong></p>
    <code>${data.refresh_token}</code>
    <p>Luego guarda y el sistema quedará activo. Este link de autorización solo se necesita una vez.</p>
  `);
}

function html(body) {
  return new Response(`<!DOCTYPE html><html lang="es"><body>${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
