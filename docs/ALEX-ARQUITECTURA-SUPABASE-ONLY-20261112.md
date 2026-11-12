# ALEX / ARM-CRM — Arquitectura operativa Supabase Only (12/11/2026)

## Regla vigente
Supabase es la única base de datos comercial de ALEX: catálogo, precios,
inventario del piloto, reservas internas, clientes, conversaciones, asesores,
seguimientos y futuras cotizaciones/pedidos. PC020 aloja la aplicación,
no actúa como fuente de SQL Server para ALEX.

No consultar, escribir ni sincronizar PC005, DB_ST o DB_DISTRIBUIDORES.
Si STECH desea asociarlos en el futuro, será una integración nueva y
optativa con su autorización expresa, sin modificar esta regla.

## Cambios aplicados
1. Desactivada la tarea programada `STECH_ARM_CRM_ERP_SNAPSHOT_PC020`,
   verificada en Windows como **Disabled**.
2. Eliminados de la rama activa: `server/erp-stock-sync.mjs`,
   `server/erp-stock-adapter.mjs`, sus pruebas y
   `scripts/ARM-ERP-READONLY-PC020.ps1`. Se conservan en el historial Git.
3. El catálogo ya no consulta `arm_erp_product_map` ni
   `arm_erp_stock_observations`; se retiraron sus referencias visuales.
   Las tablas históricas de Supabase se preservan **sin acceso** para
   `anon` y `authenticated`, para no borrar datos sin necesidad.
4. `server/commercial-evidence.mjs` lee exclusivamente
   `arm_commercial_reviews` y el RPC `arm_stock_snapshot`.
5. Se agregaron `arm_stock_levels`, `arm_stock_reservations` y
   `arm_stock_events`, con RLS, lectura por workspace y
   operaciones privilegiadas validadas para propietarios ADMIN activos.
6. Los RPC `arm_manage_stock`, `arm_hold_stock` y
   `arm_release_stock` tienen un wrapper público SECURITY INVOKER;
   la lógica privilegiada vive en `arm_private`, no expuesta al Data API.
7. La vista Catálogo permite revisión de precio (6 h), conteo de stock
   manual con caducidad (60 min), reserva provisional (15 min), liberación
   y lectura de cantidades retenidas. **No hay aprobación automática.**

## Flujos y garantías
**Precio:** un precio de `arm_products` o de una oferta de prueba
no es válido comercialmente por sí mismo. La tabla
`arm_commercial_reviews` exige aprobación y fuente documentada.

**Stock:** el conteo de Supabase es manual y específico del piloto.
Un administrador debe confirmar que las unidades están libres de
compromisos externos antes de introducirlas. Si no se aprueba, caduca,
o las reservas consumen la disponibilidad, ALEX responde
**por confirmar**, sin ofrecer cifras exactas.

**Reserva:** `arm_hold_stock` bloquea la fila del SKU en la
misma transacción que verifica stock libre e inserta la reserva;
rechaza dos reservas que excedan la disponibilidad.
`idempotency_key` impide duplicación. Una reserva expira sin
mantener unidades comprometidas: los cálculos ignoran reservas
vencidas, aunque su fila histórica siga etiquetada `held`.
`arm_release_stock` libera en una sola transacción.

**Limitación importante:** una reserva no es pago, pedido ni
cotización emitida. Tampoco sincroniza otros marketplaces;
no se pueden asumir compromisos fuera del piloto.

**Atención humana y WhatsApp:** los controles anteriores siguen
activos, incluido el permiso de dos números de laboratorio y la
prohibición de enviar mensajes a clientes reales.

## Evidencia de pruebas
- Migraciones de Supabase aplicadas sin eliminar datos existentes.
- Ensayo SQL con ROLLBACK: aprobación de 3 unidades, retención de 2,
  mismo idempotency_key recupera la misma reserva, intento de
  sobreventa rechazado, reducción debajo de reservas rechazada,
  liberación dos veces y suspensión. Sin salidas.
- Auditoría de permisos: usuario `authenticated` solo puede leer
  inventario; no puede hacer UPDATE directo. El rol `anon` no puede
  reservar ni leer datos comerciales.
- UI Catálogo comprobada en Chrome del MCP: muestra exclusivamente
  Supabase y formularios ADMIN; no se aprobaron precios ni stock reales.
- `node server/qa-commercial-live.mjs`: 4 productos, 0 precios
  aprobados, 0 unidades disponibles, 0 escrituras comerciales.
- Suite `npm test` y compilación TypeScript/Vite verificadas.
- Tarea de sincronización anterior sigue deshabilitada.

## Lo que falta
1. Confirmar catálogo real amplio con variantes, fichas, familias y fotos
   verificadas desde fuentes autorizadas, cargadas a Supabase.
2. Crear cotizaciones internas con precio fijado, moneda/IGV/flete,
   cantidad y estado; emisión solo después de aprobación transaccional.
3. Vincular la reserva a un pedido y completar consumo/liberación
   con idempotencia, rechazo de duplicados y auditoría.
4. Confirmar entrega de fotos/texto con los dos teléfonos de prueba
   sin activar clientes reales.
5. Habilitar reportes comerciales y alertas de reservas vencidas.
