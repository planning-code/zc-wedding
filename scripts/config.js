/* ============================================================
   Configuración pública del cliente.
   La anon key de Supabase es pública por diseño (la seguridad
   real vive en las políticas RLS). No pongas aquí la service-role
   key ni secretos de Spotify — esos van en Cloudflare como env vars.
   ============================================================ */

window.APP_CONFIG = {
  SUPABASE_URL: 'https://qrzqucebxmlxnpowmnrs.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyenF1Y2VieG1seG5wb3dtbnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTM5OTAsImV4cCI6MjA5NjI2OTk5MH0.-GD5dcwdGstMS9nqTyMm41bqSIrE66hNuSNhR4xSjwA',
};
