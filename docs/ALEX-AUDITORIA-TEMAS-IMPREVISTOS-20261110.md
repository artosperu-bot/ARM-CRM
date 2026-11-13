# ALEX — Auditoría de preguntas imprevistas y cambios de tema (10/11/2026)

## Objetivo

Comprobar si el agente comercial ALEX atiende clientes que cambian entre ventas, consultas técnicas, garantía, facturación, privacidad, devoluciones, seguimiento de pedidos, temas ajenos a la tienda y productos distintos, sin inventar políticas, precios, pedidos ni acciones. Mantener el tono de vendedor peruano natural, sin textos de manual ni advertencias innecesarias.

## Auditorías con modelo real

Se utilizó `server/audit-real-dialogues.mjs` con GPT-5.4-mini y seis conversaciones sintéticas (17 intervenciones de comprador, 0 envíos Meta y 0 escrituras CRM). Casos:
- `SALTO_TEMAS_FACTURA`: 2 Ulefone Armor 22 → consulta de factura electrónica y tarjeta → vuelve al precio. Conserva SKU y cantidad; sin documentación de políticas de STECH, no confirma métodos de pago.
- `POSTVENTA_IMPRESORA`: Epson L1250 que no imprime negro → devolución/cambio → «¿ya me abriste un reclamo?». Responde con orientación prudente; no afirma cambios, reembolsos ni tickets creados.
- `TEMA_AJENO_Y_REGRESO`: laptop Lenovo → resultados de fútbol de ayer → regresa a laptops. No inventa marcador en tiempo real, retoma la recomendación técnica.
- `CAMBIO_CATEGORIA_ACCESORIO`: cargador para laptop Lenovo → tablet Samsung → vuelve a cargador Lenovo 65 W. Descubrió contaminación del catálogo y resurrección del SKU anterior, luego corregidas y reprobadas con el modelo real.
- `PRIVACIDAD_DOCUMENTOS`: impresora → preguntas sobre DNI/RUC → garantía. No exige documentos para informar y no inventa política de garantía.
- `EXPLICACION_TERMINOS`: SSD/RAM → recomendación Lenovo. Explica términos sin convertirse en folleto.

### Hallazgos de alto impacto

1. **No distinguir tema de intención**: la pregunta «¿ya me abriste un reclamo?» se etiquetaba como solicitud de asesor; la facturación obtenía un texto genérico. Ahora `current_topic` y `current_intent` son ejes separados.
2. **Promesas no ejecutadas**: el modelo a veces proponía dejar seguimiento o abrir caso sin acción. Se ampliaron guardas sobre facturas/pagos, aprobación de devolución, garantía en meses, apertura de tickets y promesas de contacto no confirmado.
3. **Cambio de producto sin catálogo**: el snapshot de memoria restauraba un SKU de cargador porque el resultado nuevo era vacío. Ahora `product_switched` impide resucitar el SKU y conserva el cambio de marca.
4. **Contexto de modelo contaminado**: aun con SKU limpio, el historial hacía que ALEX respondiera «cargador para tablet» a «¿cuál tablet Samsung recomiendas?». Al haber selección explícita de otro producto, el modelo recibe el turno nuevo como contexto conversacional y los hechos comerciales se transfieren únicamente mediante `buyerGuidance`; para preguntas de factura, garantía o temas ajenos se preserva el historial.
5. **Compatibilidad cruzada**: preguntar modelo de laptop cuando se conoce el SKU del cargador es razonable. Se corrigió el falso bloqueo de la guarda contra preguntas repetidas.
6. **Precios plurales**: «¿cuánto salen los dos?» ahora se clasifica como pregunta de precio, sin autorizar cifras sin evidencia.

### Evidencia específica de la corrección

La última repetición con GPT real de `CAMBIO_CATEGORIA_ACCESORIO`, 3 turnos, mostró:

- Cargador Lenovo: preguntó por potencia/modelo para no asegurar compatibilidad.
- Tablet Samsung: respondió sobre elegir una **tablet Samsung** según el uso (estudio, videos, trabajo, dibujo), y NO sobre comprar un cargador. SKU recordado: **null**.
- Regreso al cargador Lenovo 65 W: volvió a hablar de compatibilidad de potencia/conector; no aseguró un ajuste sin comprobar datos de carga. SKU recordado: **null**, sin reutilizar identificaciones antiguas.

Al final: `AUDIT_CASES=1`, `AUDIT_TURNS_VALID=3`, `BLOCKS=0`, `META_SENT=0`, `CRM_WRITES=0`.

## Cambios

- `server/customer-topic.mjs`: clasificación de temas de atención, detección de cambio explícito de producto y selección de historial de entrada al modelo.
- `server/buyer-reasoning.mjs`: intención de posventa/garantía/facturación/consulta general, marcas adicionales y anulación de referencia previa cuando se cambia de artículo.
- `server/sales-playbook.mjs`: acciones distintas para soporte, devolución, garantía, facturación y consultas ajenas sin presión comercial.
- `server/sales-memory.mjs`: no resucitar SKU anterior cuando el comprador cambia explícitamente de producto.
- `server/sales-response-guard.mjs`: evitar afirmaciones no verificadas de facturas/pagos, reembolsos, plazos de garantía y tickets; bloquear compromisos futuros ficticios y permitir preguntas reales de compatibilidad con el equipo anfitrión.
- `server/agent-server.mjs` y `server/whatsapp-test-responder.mjs`: enfocan búsqueda y contexto de conversación en la nueva categoría al cambiar producto. El código de WhatsApp se actualizó pero su servicio no se reinició.
- `server/audit-real-dialogues.mjs` y `server/customer-topic.test.mjs`: auditoría multi-turno y pruebas de regresión de nuevos temas, cambios, solicitudes de datos, respuestas sin respaldo y preservación de memoria.

## Verificaciones finales

- PC020, rama borrador `feat/stech-arm-crm-foundation-20261102`: **250/250 pruebas**, 26 archivos, TypeScript y build correctos, commit `fc07a55` durante la prueba completa; corrección posterior de reconocimiento de cambios sin SKU (`783b51a`) también pasó 248 pruebas y las últimas modificaciones llevaron a 250.
- Última auditoría con modelo: cambio Lenovo → Samsung → Lenovo satisfactoriamente dirigido.
- No modificó PC005, DB_ST ni ERP. No creó cotizaciones, pedidos ni tickets de soporte. No envió mensajes WhatsApp.
- No hay datos normativos oficiales de garantía/medios de pago/portales de servicio vinculados como evidencia del negocio. Eso requiere fuentes verificadas antes de dar respuestas categóricas.

## Límites

No equivale a estar preparado para **absolutamente cualquier pregunta**: los temas nuevos no cubiertos por rutas deterministas siguen usando la comprensión general del modelo, con límites de actualidad, evidencia, datos operativos, accesos y permisos. No existe sistema real de registro de reclamos o de confirmación de pagos y cotizaciones para estas preguntas; cualquier derivación debe implementarse y probarse antes de afirmar que ocurrió. Se requieren más auditorías humanas cualitativas y casos de usuarios reales autorizados antes de abrir el canal WhatsApp al público.
