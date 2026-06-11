/* ============================================================
   Karlita & Edgardo · Worker de entrada (Cloudflare Workers)
   - Sirve los archivos estáticos vía el binding ASSETS.
   - Enruta /api/* a los handlers que viven en functions/api/.
   ============================================================ */

import { onRequestGet as spotifySearch } from './functions/api/spotify-search.js';
import { onRequestGet as spotifyAuthorize } from './functions/api/spotify-authorize.js';
import { onRequestGet as spotifyAuthCallback } from './functions/api/spotify-auth-callback.js';
import { onRequestPost as spotifyAddTrack } from './functions/api/spotify-add-track.js';

const ROUTES = {
  'GET /api/spotify-search': spotifySearch,
  'GET /api/spotify-authorize': spotifyAuthorize,
  'GET /api/spotify-auth-callback': spotifyAuthCallback,
  'POST /api/spotify-add-track': spotifyAddTrack,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const handler = ROUTES[`${request.method} ${url.pathname}`];
    if (handler) return handler({ request, env, ctx });
    return env.ASSETS.fetch(request);
  },
};
