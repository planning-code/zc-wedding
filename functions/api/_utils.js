/* Utilidades compartidas entre los endpoints de Spotify */

// Lee una env var tolerando espacios en el nombre o el valor (bug de Cloudflare Dashboard).
export function readEnv(env, name) {
  let val = env[name];
  if (val == null) {
    for (const key of Object.keys(env)) {
      if (key.trim() === name) { val = env[key]; break; }
    }
  }
  return typeof val === 'string' ? val.trim() : val;
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
