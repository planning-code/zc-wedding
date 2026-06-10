-- ============================================================
-- Boda Zamora-Cárcamo · Asignar super administradores
-- Ejecutar DESPUÉS de que Karlita y Edgardo entren por primera vez
-- con el enlace mágico (así ya existe su fila en profiles).
-- Reemplazar los correos por los reales.
-- ============================================================

update profiles set role = 'super_admin'
where email in (
  'karla.carcamo0309@gmail.com',
  'ezamorah.90@gmail.com',
  'planning@zcwedding.com'
);
