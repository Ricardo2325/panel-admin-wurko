-- ============================================================
-- RLS + Políticas admin para Wurko Padel Panel
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Activar RLS en todas las tablas del panel
-- IMPORTANTE: n8n usa service_role key → bypasea RLS = no se rompe nada
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_agotados ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeros_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeros_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- También estas si existen en tu proyecto:
-- ALTER TABLE productos_pedido ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE extras_pedido ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. PRODUCTOS: el panel puede leer y actualizar (precio, activo)
--    No creamos ni borramos productos desde el panel
-- ============================================================
CREATE POLICY "panel_select_productos" ON productos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "panel_update_productos" ON productos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. MENU_DIA: lectura + insert + update (upsert del menú del día)
-- ============================================================
CREATE POLICY "panel_select_menu_dia" ON menu_dia
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "panel_insert_menu_dia" ON menu_dia
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "panel_update_menu_dia" ON menu_dia
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. PRODUCTOS_AGOTADOS: lectura + alta + baja
-- ============================================================
CREATE POLICY "panel_select_agotados" ON productos_agotados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "panel_insert_agotados" ON productos_agotados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "panel_delete_agotados" ON productos_agotados
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 5. NUMEROS_BLOQUEADOS: lectura + alta + baja
-- ============================================================
CREATE POLICY "panel_select_bloqueados" ON numeros_bloqueados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "panel_insert_bloqueados" ON numeros_bloqueados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "panel_delete_bloqueados" ON numeros_bloqueados
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 6. NUMEROS_ADMIN: lectura + alta + baja
-- ============================================================
CREATE POLICY "panel_select_admins" ON numeros_admin
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "panel_insert_admins" ON numeros_admin
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "panel_delete_admins" ON numeros_admin
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 7. PEDIDOS: lectura + actualización de estado desde el panel
--    (el chatbot escribe pedidos via service_role, bypasea RLS)
-- ============================================================
CREATE POLICY "panel_select_pedidos" ON pedidos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "panel_update_pedidos_estado" ON pedidos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. Desactivar email confirmation para el usuario admin
--    (evita que pida verificar email al hacer login)
-- ============================================================
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'ricardorodriguezdelgado6@gmail.com'
  AND email_confirmed_at IS NULL;

-- ============================================================
-- VERIFICACIÓN: comprobar que RLS quedó activo
-- ============================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'productos', 'menu_dia', 'productos_agotados',
    'numeros_bloqueados', 'numeros_admin', 'pedidos'
  );
