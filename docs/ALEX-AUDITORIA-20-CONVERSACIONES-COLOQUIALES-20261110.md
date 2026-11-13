# ALEX — Auditoría de 20 conversaciones coloquiales, 10 de noviembre de 2026

## Propósito

Simular a un comprador peruano real, que escribe mensajes cortos, con errores y modismos, molesto o apurado cuando corresponde, y evaluar atención comercial, contexto, memoria, compatibilidad, posventa, reclamos y respeto a solicitudes humanas. Esta auditoría prueba conversaciones **sintéticas** contra GPT-5.4-mini, sin enviar WhatsApp a clientes ni generar operaciones de CRM.

Comando reproducible en PC020:

```cmd
cd /d C:\DESAROLLO\ARM-CRM
set ALEX_QA_PROFILE=colloquial20&& node server\audit-real-dialogues.mjs
```

Corpus fuente: `server/qa-colloquial-scenarios.mjs` (20 conversaciones distintas, 49 turnos de comprador). Hay respuestas consecutivas del modelo real, filtradas por `protectSalesResponse`. Las métricas de `BLOCKS` indican respuestas saneadas por una regla, **no** éxitos, satisfacción del cliente ni ventas.

## Resultados de 20 conversaciones

| # | Caso | Primer defecto real y evolución |
|---|---|---|
| 01 | «oe q tal el armor 22 pa chamba» | Reconoce trabajo de campo y certificaciones; debía reducir advertencias y fórmulas repetidas; precio vigente no confirmado |
| 02 | «buenas la epson l1250 cuanto sale» | Precio/stock no verificados; se eliminaron promesas de aviso posterior, ahora devuelve estado por confirmar |
| 03 | «noo era 2 mano me equivoque» | Inicialmente interpretó *mano* como segunda mano y conservó 3 laptops; luego reconoció y persistió **2 unidades** |
| 04 | «armor 22 precio x 5», «asu sta caro pe» | Inicialmente no conservó 5 ni reconoció objeción; ahora recuerda **5** y declara descuento no autorizado sin prometer gestión |
| 05 | Laptop para Excel, «no me florees» | Recomienda T14 16/32 GB según trabajo y explica sin presión |
| 06 | Office Home 2024 una vez, dos PC | Explica compra única y necesidad de revisar términos de activación por equipo; hay que respaldar licencias concretas |
| 07 | Epson L1250 dejó de imprimir, pide cambio | En primera ronda solicitó nombre y teléfono y fingió derivar; después prioriza **asesor posventa**, sin registrar ticket inexistente |
| 08 | Armor 22 mojado y sin encender | Prioriza posventa y no promete cobertura automática ni asignación; un caso físico requiere inspección |
| 09 | Producto llegó roto, pide devolución inmediata | Derivación de problema real a humano; no afirma reembolso aprobado |
| 10 | Caja sin abrir, «7 días sí o sí» | No inventa política universal de arrepentimiento; diferencia defecto de cambio de opinión |
| 11 | Impresora falló a los dos días; ¿ya me abriste reclamo? | No confirma ticket inexistente; triage humano |
| 12 | Libro de Reclamaciones y plazo | Inicialmente contestó erróneamente 30 días calendario; ahora **15 días hábiles de respuesta** y sin inventar enlace STECH |
| 13 | «quiero hablar con persona no con robot» | Detecta solicitud humana, detiene IA de WhatsApp; no afirma que asesor real haya recibido |
| 14 | Pedido sin llegar | Se trata como posventa y prioriza atención humana; no inventa estado ni tracking |
| 15 | Visa/Yape y factura con RUC | No confirma políticas de empresa sin fuente; falta base verificable de medios/comprobantes |
| 16 | Rechaza foto del DNI | ALEX informa sin exigir datos personales |
| 17 | Cargador Lenovo USB-C 65W | Explica necesidad de compatibilidad USB-C Power Delivery, potencia y modelo; evita confirmar ajuste sin evidencia |
| 18 | Cambia de cargador a tablet Samsung | Respetó el cambio de categoría y no revive SKU anterior |
| 19 | Pregunta de fútbol entre consultas Lenovo | No inventa resultado actual y retoma T14 al volver |
| 20 | Cliente molesto por cobro sin entrega | Deja de vender y prioriza humano; no pide nuevos datos sin procedimiento ni finge gestionar reclamo |

## Dos ejecuciones completas con GPT real

Primera: **20/20 escenarios, 49 turnos válidos, 5 respuestas protegidas**, sin escrituras CRM ni envíos Meta. Descubrió fallas relevantes de memoria, lenguaje coloquial, derecho del consumidor, respuesta a quejas y compromisos falsos.

Segunda: **20/20 escenarios, 49 turnos válidos, 18 respuestas protegidas**, sin escrituras CRM ni envíos Meta. La mayor cantidad de respuestas protegidas refleja una política más conservadora y derivación humana; no se interpreta como incremento de calidad por sí solo.

Rondas focalizadas adicionales sobre precio, stock, descuento, libro y reclamos: después de las correcciones, el modelo devolvió directamente «precio por confirmar», «disponibilidad por confirmar», «no hay descuento confirmado» y el plazo de 15 días hábiles, sin prometer un aviso futuro.

## Correcciones implementadas

- `server/buyer-reasoning.mjs`: frases informales, cantidades «x 5», corrección «noo era 2», objeciones «sta caro pe», «rebaja», petición humana «quiero q un asesor vea esto», derechos del consumidor por consulta y continuidad de memoria.
- `server/customer-topic.mjs`: reclamos por falla reciente, producto roto, mojado y sin encender, pedido no entregado, solicitud de devolución, Libro de Reclamaciones, estado de derivación. Distingue un caso real de «¿qué pasa si se malogra?».
- `server/lead-intelligence.mjs`: triage de WhatsApp detiene respuesta automática en problemas serios y solicitudes humanas. `lead-intelligence-processor` puede marcar `arm_threads.status = human` para atención posterior sin inventar personal asignado.
- `server/peru-consumer-knowledge.mjs`: respuesta legal verificable para los 15 días hábiles, separada de los plazos de devolución y garantía. Fuentes Indecopi: https://consumidor.gob.pe/libro-de-reclamaciones/ y https://www.gob.pe/institucion/indecopi/normas-legales/3462038-ley-29571.
- `server/sales-response-guard.mjs`: respuesta breve ante posventa, bloqueo de promesas sin acción (reembolso, cotización, seguimiento o llamada), plazo legal, Libro, preguntas sobre stock y precio sin datos verificados. Preservación de motivos específicos de controles anteriores, incluidos descuentos y entregas no autorizadas.
- `server/commercial-service-standard.mjs`: instrucción general de lenguaje natural peruano sin imitar errores ni interpretar «mano» como equipo usado.
- `server/qa-colloquial-scenarios.mjs`, `server/colloquial20-regressions.test.mjs`, `server/lead-intelligence-processor.test.mjs`: escenarios repetibles y pruebas de regresión para conductas de venta y posventa.

## Verificación técnica

Última ejecución **283/283 pruebas aprobadas** en 27 archivos; `npm run typecheck` y `npm run build` correctos en PC020. Conserva la autorización de precios simulados solo en sandbox y no permite un importe ficticio de catálogo real.

No se tocó PC005 ni DB_ST, ni ERP; no se enviaron mensajes Meta, no se creó un reclamo ni se asignó un asesor real.

## Pendiente antes de habilitar casos reales

**Derivación operativa:** cambiar el estado del hilo a `human` no significa que alguien haya aceptado el caso o que el cliente recibió un mensaje de confirmación. Falta una bandeja de asignación efectiva, notificación/acuse verificable y resolución por humano. No activar la promesa «ya te pasé con un asesor» hasta que la operación exista.

**Políticas reales STECH:** validar y cargar fuente oficial y vigente de devoluciones, garantías, canales de soporte, Libro de Reclamaciones (URL propia) y medios de pago. Normas generales de consumo no sustituyen las condiciones de cada venta.

**Calidad conversacional:** no dar por finalizado al agente porque aprueba tests. Repetir conversaciones con variantes nuevas, revisar brevedad y evitar recitar el mismo «todavía no está asignado» en cada turno; el WhatsApp real correctamente suprime respuestas después del handoff. También se requieren fuentes de inventario, precio y cotización para cerrar ventas en vez de solo orientar.
