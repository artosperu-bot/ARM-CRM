# ARM-CRM — Plan maestro de producto y arquitectura comercial
**Versión:** 2026-11-05 · **Ámbito:** STECH PERU / ARTOS · **Documento de planificación; no implica funciones ya entregadas**

## Visión
Un sistema comercial para captar, asesorar, calificar, cotizar, cerrar y fidelizar clientes B2C, B2B y B2G. ALEX es el asistente conversacional que propone respuestas y acciones; el backend aplica permisos, inventario, reglas comerciales, consentimiento y aprobaciones. CRM es la fuente de verdad de conversaciones y oportunidades, ERP la fuente de verdad de inventario y precios.

No confundir un mensaje respondido con una venta; no confundir una puntuación comercial con una probabilidad certificada; no confundir el consentimiento para atención con autorización para campañas.

## Estado de partida (verificar cada despliegue)
- PC020 `C:\DESAROLLO\ARM-CRM`, frontend React/Vite, backend Node y webhook Meta, Supabase con tablas `arm_*`.
- ALEX con OpenAI Responses API y pruebas WhatsApp sandbox en dos números aprobados.
- Memoria de conversación limitada, formato WhatsApp, detección heurística de intención, prioridades y filtros de Inbox, escalamiento humano y opt-out inicial.
- Cuatro Ulefone de prueba; `arm_offer_simulations` exclusivamente sandbox.
- Falta ERP read-only real, cotizaciones transaccionales, orquestación de seguimientos consentidos, incorporación de canales comerciales, captación continua y endurecimiento de producción.
- Riesgo P0 detectado: políticas RLS en `arm_contacts` y `arm_threads` incluyen `m.workspace_id=m.workspace_id`. Revisar/corregir enlazándolas al `workspace_id` externo y demostrar aislamiento mediante pruebas de acceso cruzado. No declarar compromiso de datos sin evidencia.

## Principios no negociables
1. Un cliente, una identidad comercial deduplicada, múltiples conversaciones y oportunidades si corresponde.
2. Separar estrictamente sandbox de producción, y STECH de ARTOS por workspace/cuenta.
3. ALEX responde la pregunta, recuerda datos disponibles y pregunta solo si falta algo decisivo; sin árbol rígido ni interrogatorio.
4. Características, certificaciones y ventajas solo con evidencia. Precios solo cuando se preguntan, y si están validados; disponibilidad por estado, sin cantidades exactas de stock.
5. Las acciones se ejecutan por herramientas del servidor con autorización y auditoría, nunca por simple afirmación del modelo.
6. Humano, baja/opt-out, cierre, fraude, reclamo y falta de fuente confiable prevalecen sobre la automatización.
7. Un único despachador de mensajes por cuenta y canal, idempotencia en base de datos y registro del resultado. No habilitar motor antiguo simultáneamente.
8. Mensajes proactivos sujetos a consentimiento explícito, política actual de Meta, ventanas, plantillas, límites, preferencias de horario y bajas.
9. Crecer usando OpenAI API existente y software propio; no incorporar APIs pagadas accesorias sin beneficio medible.
10. Protección de datos: Ley 29733 y D.S. 016-2024-JUS; minimización, retención, acceso, rectificación, eliminación y auditoría.

## Modelo objetivo de datos
**Identidad/relación:** workspaces, usuarios, roles, personas, empresas, RUC validado cuando aplique, canales de contacto, preferencias, consentimientos e identidad cruzada por canal.
**Conversación:** cuentas conectadas, hilos, mensajes, eventos webhook, archivos, estado de envío, asignaciones, resumen de hechos y evidencia.
**Comercial:** necesidades/solicitudes, oportunidades, participantes, productos requeridos, prioridad explicable, etapas, tareas, cotizaciones/versiones, partidas, descuentos aprobados, pedidos y pérdidas/razones.
**Catálogo/ERP:** producto maestro, fabricante/PN, equivalencias, publicaciones por canal, costos, precios, stock físico/disponible/comprometido, fuente, fecha de validación, garantías y reglas tributarias.
**Automatización:** reglas, planes, consentimientos, eventos disparadores, trabajos programados, intentos y cancelaciones, límites por remitente/canal.
**Control:** acciones ejecutadas, aprobaciones, auditoría, evaluaciones IA, fallos, uso/costo, KPIs y atribución de captación.

## Entregas y puertas de salida

### Fase 0 — Seguridad, estabilidad y control del gasto
- Revisar RLS en todas las tablas: lectura, escritura, cuentas de asesores, aislamiento STECH/ARTOS, restricciones sobre service_role.
- PC020 autostart de frontend, agente, gateway y worker; healthchecks, recovery ante reinicio, alertas, backup/restauración, rollback.
- Ingreso firmado, `inbox_events` duraderos, cola/outbox por hilo y clave de idempotencia para que el mismo evento nunca genere doble envío.
- Registrar fallos y tasas de recuperación sin teléfonos completos, secretos ni textos en logs.
- **Gate:** pruebas de aislamiento, arranque tras reinicio, duplicado controlado y envío sin autorización bloqueado.

### Fase 1 — Cliente 360 + ERP confiable
- Dedupe de contacto/persona/empresa y asociación de varios canales. No duplicar oportunidades por cada mensaje.
- Conector ERP SQL Server de solo lectura, sin exponer SQL a Internet. Resolver PN y tabla de equivalencias y disponibilidad real con fecha y fuente.
- Precio por cliente/canal, margen mínimo, comisiones, IGV, logística y vigencia de oferta. Políticas de permisos para cotizar, reservar y aprobar descuentos.
- **Gate:** consultas de productos verificadas, equivalencias corregidas, ningún precio simulado fuera de sandbox.

### Fase 2 — ALEX 2.0 y acciones supervisadas
- Extraer estructura del diálogo: intención, comprador, producto, PN, cantidad, presupuesto, urgencia, uso, comuna/distrito solo si entrega, siguiente acción, incertidumbre y consentimiento.
- Memoria por contacto/oportunidad con hechos y fuente; resúmenes revisables, no memorias inventadas.
- Herramientas autorizadas: buscar producto, consultar existencia, comparar, crear/actualizar lead, proponer cotización, solicitar aprobación, transferir humano, agendar tarea.
- Diseño `proponer → verificar reglas → autorizar → ejecutar → auditar → confirmar al cliente`.
- Evaluaciones de diálogos peruanos B2C/B2B/Estado, precios/stock sin verificar, objeciones, compras, reclamos, baja, presupuesto, emergencia y mensajes adversarios.
- **Gate:** cada acción comunicada corresponde a una operación confirmada; el modelo no ejecuta acciones prohibidas.

### Fase 3 — Ciclo comercial completo
- Etapas editables: nuevo, calificado, propuesta, negociación, ganado, perdido, postventa; responsable, siguiente paso y motivo de pérdida.
- Cotizador por partidas con precios, vigencia, datos de empresa, IGV, margen, costos de entrega, descuentos/autoridad, PDF/versiones, envío autorizado y trazabilidad.
- Seguimientos por consentimiento y evento: inicialmente intervalo configurable, nunca envío ciego; cancelación ante respuesta, asesor, opt-out, cierre, error, ventana Meta vencida; plantillas aprobadas cuando corresponda.
- **Gate:** oportunidades y cotizaciones sin duplicados, tareas vinculadas, cero seguimientos tras cancelación.

### Fase 4 — Captación y experiencia omnicanal
- B2C: búsquedas orgánicas, landing pages, anuncios con medición, clics WhatsApp, formularios del sitio y fichas actualizadas.
- B2B: identificar compradores de 2+ laptops/impresoras/tablets/celulares; empresas/pymes con necesidades comprobables, validación legítima de contactos, seguimiento permitido y propuesta por volumen.
- B2G: integrar oportunidades pertinentes del proyecto de convocatorias como pipeline distinto, sin confundir postulaciones con contactos comerciales.
- Facebook, Instagram, WhatsApp empresarial, web; bandeja única, identidad compartida, asignación humana y etiquetas de canal.
- **Gate:** captación de fuentes atribuibles y posibilidad de medir visitas→leads→cotización→venta, con protección de datos.

### Fase 5 — Posventa, analítica y expansión
- Tickets, garantías, casos de cambio/devolución, satisfacción, historial de compras y recompra consentida.
- Panel directivo: leads calificados, tiempos de respuesta, tasa de pérdida, cotizaciones enviadas, conversión a venta, margen neto por canal, costos API, fallos, rendimiento por asesor, opt-out.
- Arquitectura multiworkspace preparada, pero no comercializar como SaaS antes de validar STECH/ARTOS y permisos de producción.

## Arquitectura incremental propuesta
Mantener **monolito modular** mientras volumen y equipo sean pequeños; no añadir microservicios por moda.
**Meta/Web → Gateway seguro → Bandeja duradera/cola → Motor de reglas e identidad → ALEX (OpenAI API) → Herramientas autorizadas (CRM/ERP/cotizaciones) → Outbox de respuestas → Meta/Web**.
Worker separado para trabajos programados. Un único motor de envíos. Catálogo y ERP accesibles por adaptador read-only. Staging y producción separados, sin replicar información personal a pruebas.

## Métricas que deben existir desde el inicio
- Fiabilidad: entregas recibidas, procesamiento exitoso, duplicados bloqueados, fallos y recuperación.
- Calidad IA: precisión factual de catálogo, respuestas sin precio/stock inventado, handoff y satisfacción.
- Ventas: lead→calificado→cotización→pedido→venta, ciclos de venta, ticket/margen bruto y neto, causa de pérdida.
- Captación: costo por lead *calificado*, tasa de conversión por canal/campaña/fuente, empresas con demanda de >=2 equipos.
- Automatización: tareas con consentimiento, seguimiento cancelado por respuesta/humano, cero envíos después de baja.
- Costos: tokens y costo por conversación, oportunidad y venta; límites configurables por workspace/canal.

## Prioridad inicial de implementación
**P0** aislamiento RLS, autostart y persistencia idempotente de mensajes, separar QA de producción.
**P1** conector ERP + tabla equivalencias; cliente 360; cotización y pipeline; herramientas y permisos de ALEX.
**P2** seguimiento condicionado y supervisor; omnicanal real; captación B2B/B2C/B2G.
**P3** mejoras analíticas, posventa avanzada, SaaS-ready.

## Riesgos que evitaremos
- No iniciar envío masivo de WhatsApp, campañas sin base legal o seguimiento automático sin permiso.
- No copiar bot/n8n antiguo completo ni tener dos receptores productivos por el mismo webhook.
- No convertir score 80/100 en promesa de 80 % de compra.
- No permitir que el LLM escriba stock o precios ERP sin un servicio transaccional autorizado.
- No crear múltiples agentes pagados que aumenten costos sin mejorar resultados medidos.
- No escalar a clientes reales mientras exista una brecha de RLS o no tengamos restauración comprobada.

## Fuentes oficiales verificadas
- Meta WhatsApp Business Messaging Policy: https://business.whatsapp.com/policy/preview?lang=es_LA (consentimiento, bajas, ventana de 24 h y plantillas).
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security (roles, grants, políticas y test).
- Autoridad Nacional de Protección de Datos Personales: https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus
