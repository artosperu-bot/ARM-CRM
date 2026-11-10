# ALEX / ARM-CRM — cierre de flujos conversacionales y arquitectura de crecimiento

**Fecha:** 10 de noviembre de 2026 · **Ambiente:** PC020, CRM privado + WhatsApp de dos números autorizados · **Estado:** rama de PR #1 en borrador. No implica producción abierta al público ni ventas reales automatizadas.

## 1. Recorrido de compra que ya tiene pruebas

1. **Descubrimiento y orientación:** el comprador escribe de modo informal, con errores y poca información. La IA responde a la necesidad actual, con contexto comercial reciente y memoria estructurada, sin menús obligatorios ni pedir DNI.
2. **Producto y variantes:** resolución de SKUs mediante búsqueda indexada por `workspace_id`, no por una lista fija de los primeros productos. Cambios explícitos de artículo invalidan SKU y precio anteriores. Un producto nuevo sin fuente queda por verificar. Los datos técnicos requieren ficha verificada.
3. **Fotos a petición:** vínculo `arm_product_facts.product_image` con `verified_sku`, origen revisado y URL pública HTTPS JPEG/PNG del mismo host de la fuente. Funciona por SKU para fabricantes futuros, no solo Ulefone. El CRM muestra imágenes persistidas; WhatsApp sandbox prepara `type=image` con leyenda; la bandeja muestra las imágenes salientes registradas. Las URLs de foto se filtran del contexto posterior del LLM.
4. **Correcciones del cliente:** cantidades 3→2, referencias como «Armor X13» sin convertir el número de modelo en unidades, cambios de X13→Armor 22 y negaciones «no del X13» sin reutilizar foto o precio anterior. Correcciones persistidas en `sales_memory`.
5. **Información comercial:** precio solo si se solicita y está vigente; disponibilidad solo si se consulta y tiene evidencia. El presupuesto del cliente no se convierte en precio ni se asegura que alcance para la compra. Sin comprobación no se inventan descuentos, entrega, garantía o compatibilidad.
6. **Decisión de compra:** «lo compro, ¿dónde pago?» **no** crea pedido, factura, cotización ni link. La respuesta explica que faltan validación de precio, stock vendible y condiciones, sin pedir datos personales prematuramente ni prometer operaciones inexistentes.
7. **Atención humana y postventa:** una petición de persona o una incidencia posventa grave detiene las respuestas automáticas. En el chat privado no se afirma derivación inexistente. En WhatsApp solo se anuncia «quedó en cola para atención humana» tras transición persistida `pending→human`; esto **no** equivale a asignación concreta `assigned_to`. «¿Ya le avisaste?» recibe una respuesta directa sin inventar notificación.
8. **Desistimiento, despedida, privacidad:** se respeta «ya no quiero comprar» o «no me escriban más». El opt-out mantiene bloqueadas respuestas automáticas; el perfil no se marca como comprador comprometido cuando aclara «solo estoy averiguando». No hay seguimiento saliente sin autorización y backend.
9. **Memoria, bandeja y trazabilidad:** las fotos permanecen visibles sin inyectar enlaces arbitrarios al prompt futuro. Revisión posterior del CRM registra estados, mensajes y análisis comercial, no una venta ficticia.

## 2. Evidencia probada

- **Automatización:** 31 archivos de pruebas; incluye recorrido multi-turno integral en `server/customer-journey-e2e.test.mjs`, pruebas de WhatsApp Graph API con mocks, ventanas temporales, opt-out, reasignación humana, imagen y búsqueda por SKU. Revisión final: **362/362 pruebas**, TypeScript y build de producción correctos (actualizar si cambia código posteriormente).
- **Modelo real OpenAI:** ronda general anterior de 20 conversaciones y 49 turnos sin mensajes salientes ni operaciones; nueva ronda focal de cinco conversaciones y 13 turnos; y repetición final de tres conversaciones y siete turnos (asesor, compra, posventa). El flujo de «¿ya le avisaste?» pasó de respuesta genérica a «No. Desde este chat no se ha registrado una derivación...», y «lo compro» quedó bloqueado antes de checkout.
- **Chrome real:** solicitudes de foto Ulefone X13 y cambio de modelo negado «Armor 22, no del X13» resultaron en imagen oficial correcta al repetir la prueba, consultada también desde historial Supabase. Cantidad modelo X13 dejó de aparecer como 13 unidades.
- **WhatsApp:** código de envío de fotos y confirmación de cola probado con Graph simulado; **no existe evidencia de fotografía entregada a un teléfono real**. El gateway queda limitado a dos números de laboratorio.

## 3. Qué falta para vender de verdad (prioridades y criterios de aceptación)

| Priorización | Bloque | Lo que impide | Criterio de aceptación |
|---|---|---|---|
| P0 | **Outbox duradero/idempotencia de WhatsApp** | Tras persistir inbound, el envío se lanza por `queueMicrotask`; un cierre de proceso puede dejar un mensaje sin respuesta o duplicarlo ante reintentos | Tabla de intentos transaccionales por `event_id`, worker con estado, retry acotado/backoff, vencimiento de ventana y conciliación de estados Meta; pruebas de caída antes/después de Graph |
| P0 | **Precio, stock vendible y reserva por SKU** | Solo cuatro Ulefone en piloto; precio y disponibilidad reales no autorizan compra | Actualización con fecha y fuente; saldos menos reservas y pedidos comprometidos; canal y almacén; ausencia de dato = por confirmar; nunca revelar unidades exactas al cliente |
| P0 | **Cotización y pedido transaccional** | No existe backend completo que confirme acción de compra | Calcular cantidad×precio+IGV+envío; controlar vencimiento, folio idempotente, confirmación de reserva y creación de pedido; el LLM recibe resultado estructurado de operaciones, nunca decide solo |
| P0 | **Asignación humana real** | Cola `human` no equivale a asesor asignado | Reglas de propietario `assigned_to`, disponibilidad del equipo, notificación interna, aceptación/SLA y vista de sin asignar; IA se detiene mientras el humano tenga el hilo |
| P1 | **Catálogo multirrubro y media por variantes** | Falta cargar fichas, fotos y equivalencias de otros productos STECH | Importador incremental por PN/SKU ERP y marca; imágenes por variante, revisión, caducidad, no mezcla; pruebas de laptops Epson accesorios y software |
| P1 | **RAG y políticas oficiales verificadas** | Respuestas sobre pago, facturación, entrega y garantías siguen con «por confirmar» | Documentos por comercio y canal con vigencia y fuente; si no hay política confirmada no se afirma; tests sobre preguntas ambiguas |
| P1 | **Omnicanal y cliente 360** | WhatsApp es piloto, Facebook/Instagram no están listos para respuesta comercial general | Identidad de contacto verificada, aislamiento workspace, prioridad humana uniforme, deduplicación, consentimiento y auditoría por canal |
| P1 | **Evaluación continua de calidad** | Tests unitarios y diálogos sintéticos no equivalen a conversiones reales | Conjunto de chats desidentificados, regresiones de errores observados, métricas de intención mal clasificada, exactitud SKU, respuestas repetidas y escalaciones, revisión humana antes de cambios |
| P2 | **Ofertas y alternativas seguras** | Se requieren criterios verificables de similitud y disponibilidad | Sugerir alternativa solo cuando el cliente lo pide o el original no está disponible, respetando uso, compatibilidad, presupuesto y precio confirmado |
| P2 | **Escala y resiliencia** | Crecerá el volumen de mensajes, categorías, usuarios y canales | Colas por `workspace/channel/thread`, no doble respuesta por hilo, límites, trazas sin datos sensibles, observabilidad, alertas de latencia y tasa de fallos |

### Condiciones para salir del laboratorio

No habilitar masivamente el bot mientras no exista aprobación de seguridad y pruebas de extremo a extremo de **(a)** webhook Meta firmado con dos números autorizados, **(b)** entrega real de texto/foto y confirmación de estados, **(c)** colas/reintentos durables y recuperación ante caída, **(d)** precio/stock vendible y cotización calculada, **(e)** traspaso humano efectivo, **(f)** aislamiento de datos por empresa y consentimiento, y **(g)** rollback documentado.

**Regla permanente:** las decisiones conversacionales orientan al comprador; solo acciones backend confirmadas pueden cambiar CRM, crear cotización, reservar stock, cobrar, generar pedido o afirmar que una persona fue avisada.

**Entorno protegido:** no se modifica PC005, `DB_ST` ni inventarios del ERP. Cualquier futura conexión se hace con lectura controlada y adaptador independiente en PC020.

### Referencias internas
- `server/customer-journey-e2e.test.mjs`
- `server/lead-intelligence.mjs`
- `server/sales-response-guard.mjs`
- `server/product-photo.mjs`
- `server/whatsapp-test-responder.mjs`
- `server/whatsapp-handoff-ack.mjs`
- `docs/ALEX-FOTOS-PRODUCTOS-VERIFICADAS-20261110.md`
