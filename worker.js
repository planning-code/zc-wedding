/* ============================================================
   Karlita & Edgardo · Worker de entrada (Cloudflare Workers)
   - Sirve los archivos estáticos vía el binding ASSETS.
   - Enruta /api/* a los handlers que viven en functions/api/.
   Nota: el sitio se despliega como Worker (no Pages), así que la
   convención de carpeta functions/ no se autoenruta; este router
   lo hace explícito reutilizando esos mismos handlers.
   ============================================================ */

import { onRequestGet as spotifySearch } from './functions/api/spotify-search.js';

const ROUTES = {
  'GET /api/spotify-search': spotifySearch,
  'GET /api/debug-env': ({ env }) => new Response(
    JSON.stringify({ keys: Object.keys(env), hasId: !!env.SPOTIFY_CLIENT_ID, hasSecret: !!env.SPOTIFY_CLIENT_SECRET }),
    { headers: { 'Content-Type': 'application/json' } }
  ),
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = ROUTES[`${request.method} ${url.pathname}`];
    if (handler) return handler({ request, env, ctx });
    // Cualquier otra ruta: servir archivos estáticos.
    return env.ASSETS.fetch(request);
  },
};
