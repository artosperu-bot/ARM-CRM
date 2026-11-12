# ALEX — plan de integración comercial verificada, 12/11/2026

## Objetivo
Que ALEX asesore y venda con datos de STECH comprobables, sin confundir una
conversación, una proforma interna, un pedido, una reserva y un pago.

## Investigación realizada
- Supabase ARM-CRM contiene 4 SKUs piloto Ulefone; los 4 tenían `price_pen`
  y `verified_at` nulos en el catálogo operativo al inicio de la ronda.
- Existen 3 observaciones ERP recientes con PN exacto y 1 equivalencia candidata
  (`ARMOR-22-256G` frente a `ARMOR-22-256GB`). No promover equivalencias
  automáticamente sin aprobación.
- En PC020, **solo con SELECT** en `DB_DISTRIBUIDORES`: 8 901 observaciones
  `INV_STOCK_ACTUAL`, 87 registros `INV_STOCK_COMERCIAL_ACTUAL`, 203
  configuraciones de precio activas en `CFG_PRECIO_PRODUCTO_CANAL`.
  Esas configuraciones son modos por canal; no constituyen precios finales
  vigentes ni garantía de disponibilidad para venta propia.
- `INV_STOCK_COMERCIAL_ACTUAL` es una regla comercial sobre fuentes de
  distribuidores. No equivale por sí sola a inventario físico libre ni incluye
  necesariamente compromisos y reservas de todos los marketplaces.
- Referencias de arquitectura:
  https://shopify.dev/docs/api/admin-graphql/2026-10/objects/InventoryLevel
  y https://shopify.dev/docs/api/admin-graphql/2026-10/objects/InventoryQuantity
  distinguen estados disponibles, comprometidos, reservados y físicos.
  https://supabase.com/docs/guides/database/postgres/row-level-security
  distingue permisos SQL GRANT y Row Level Security.

## Implementado ahora (fase 1)
1. `arm_commercial_reviews`: evidencia independiente para precio directo,
   inventario vendible y sus caducidades. Estado inicial vacío: cero aprobaciones.
2. El precio real de ALEX solo puede provenir de revisión comercial
   aprobada, atribuible, documentada y no expirada (máximo 6 horas).
   `arm_products.price_pen`/ `verified_at` aislados ya no autorizan precios.
3. El stock exige PN exacto, fuente ERP idéntica y reciente, conciliación
   multicanal posterior al snapshot, y cantidad solicitada no mayor que
   disponibilidad revisada. ADICIONALMENTE, la autorización de stock de ALEX
   sigue bloqueada por `reservationLayerReady=false` hasta crear el backend
   transaccional de reservas; no basta una revisión manual.
4. API privada de precio: `arm_record_direct_price` solo para propietario
   del workspace con ADMIN activo; aprobar/revocar con fuente, motivo,
   usuario y auditoría. La API pública es SECURITY INVOKER; la función
   con privilegios está aislada en `arm_private`.
5. Pantalla Catálogo: alerta de precio aprobado/vencido, PN candidato,
   evidencia ERP; el propietario ADMIN puede revisar/revocar precio directo
   sin crear ofertas multicanal, pedidos ni enviar mensajes.
6. Se preserva el sandbox: los precios de prueba `arm_offer_simulations`
   jamás pasan a `arm_commercial_reviews`.

## Próximas fases con criterios de habilitación
### 2. Identidad del producto y precios
- Importar candidatos desde PC020 `DB_DISTRIBUIDORES` a una tabla staging ARM
  que incluya PN, marca, descripción, variante, origen y fecha.
- Aprobación humana de coincidencias exactas y equivalencias (sin similitud
  de nombre como prueba suficiente). Separar costo proveedor de precio propio
  por canal, IGV, flete, comisiones y margen mínimo.
- Obtener un feed de precio propio desde canal directo o lista aprobada; no
  asumir que `modo_precio` en distribuidor es un importe ofertable.

### 3. Inventario disponible para promesa (ATP)
- Definir autoridad de inventario propio, fecha de corte y ubicación.
- Importar de solo lectura pedidos/compromisos desde Falabella, Claro/VTEX,
  Intercorp, Ripley, Mercado Libre, Juntoz, web y reservas internas.
- Deducción por SKU canónico, no por título. Evitar descontar dos veces el
  mismo pedido entre canal, OC, ERP y sistema de distribuidores.
- Crear reserva atómica e idempotente con vencimiento, bloqueo de fila,
  consumo por pedido y liberación auditada. Sin esa operación, ALEX
  conserva "por confirmar" aunque la fuente declare unidades positivas.
- Detectar desfases, exceso de reservas, pedidos tardíos y canales no
  conciliados. Negar disponibilidad ante cualquiera de esas condiciones.

### 4. Cotización y pedido
- Estado cotización: solicitada → borrador interno → verificada → emitida
  → aceptada/vencida/cancelada, con ID, líneas, PN, cantidad, fuente, moneda,
  base IGV, descuento aprobado, flete y plazo de vigencia.
- Validación atómica de cantidades y precios al emitir. No equivaler
  intención de compra a aceptación ni proforma a pedido.
- Pedido: borrador → reservado → confirmado → pagado → despachado/cancelado.
  Identidad idempotente por workspace/canal/evento y mapeo a ERP después de
  verificar transacciones y autorizaciones.
- ALEX solo afirma "cotización emitida", "pedido creado" o "pago recibido"
  después del registro confirmado por el backend. La cola humana sigue
  permitida aunque falten productos verificables.

### 5. Medición y calidad
- E2E con conversaciones informales, errores ortográficos, 2+ productos,
  cambios de PN/cantidad, stock cero, fotos verificadas, descuentos,
  reclamos, desistimiento, oposición al seguimiento y transferencia humana.
- Métricas: respuestas útiles, handoffs tomados, leads atendidos, cotizaciones
  verificadas/emitidas/aceptadas, fallos por fuente desactualizada y costes IA.
- Mensajería pública continúa cerrada hasta verificar los dos teléfonos de
  prueba, entrega Meta y políticas de ventana/consentimiento.

## Condiciones que NO cambiaron
- No se aprobó ningún importe del catálogo real ni se reservó inventario.
- No se enviaron mensajes a clientes, no se creó ningún pedido ni pago.
- No se alteró PC005 ni DB_ST. Los datos de PC020 `DB_DISTRIBUIDORES`
  fueron consultados solo con SELECT.
- PR #1 permanece en borrador hasta superar pruebas end-to-end de operación.
