/* ============================================================
   GET /api/spotify-search?q=...
   Búsqueda en Spotify usando Client Credentials (sin login del
   usuario). Requiere env vars en Cloudflare Pages:
     SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
   Devuelve un arreglo simplificado de tracks.
   ============================================================ */

let cachedToken = null; // { access_token, expires_at }

async function getAppToken(env) {
  if (cachedToken && cachedToken.expires_at > Date.now()) return cachedToken.access_token;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
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

  try {
    const token = await getAppToken(env);
    const sp = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=8&market=SV&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!sp.ok) return json({ error: `spotify ${sp.status}` }, 502);

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

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
