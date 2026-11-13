# ALEX — Motor universal de ventas (05/11/2026)

## Objetivo: vender bien antes de agregar más filtros o canales
ALEX no está especializado en Ulefone ni en B2B. Debe ayudar a cualquier comprador B2C o B2B, con cualquier producto o servicio efectivamente presente en el catálogo del CRM, sin asumir que hay cotización, compra o stock confirmados.

### Lógica de venta consultiva
1. **Comprender:** contestar la duda concreta y detectar necesidad/uso sin exigir formulario.
2. **Aconsejar:** si hay productos con datos verificables, explicar el ajuste práctico, compatibilidad y límites; si no, reconocer incertidumbre.
3. **Comparar:** solo opciones relevantes, sin inventar fichas ni afirmar superioridad absoluta.
4. **Objeciones:** reconocer preocupación y explicar la relación costo-beneficio; jamás improvisar rebajas.
5. **Decisión:** cuando cliente ya decidió, no reiniciar la comparación. Explicar qué puede hacer realmente el backend, sin solicitar información personal antes de una acción autorizada.
6. **No compra/despedida:** respetar la decisión, sin presionar ni reactivar venta.
7. **Atención humana:** si se solicita asesor o hay reclamo, la lógica del webhook suspende automáticamente a ALEX; no prometer un traspaso o asignación inexistente.

No son pasos rígidos que deban cumplirse en orden: ALEX entra directamente en la etapa que el cliente necesita.

### Implementación desplegada
- `server/catalog-matching.mjs`: identifica producto, marca y cantidades usando **las filas actuales del catálogo**, no cuatro modelos codificados. Coincidencias ambiguas = sin producto verificado. Probado con impresoras Epson, licencias Microsoft Office, sillas, SmallRig y Ulefone.
- `server/sales-playbook.mjs`: determina movimiento comercial a partir de intención del turno, contexto y evidencias. Sin funnel B2B por defecto.
- `server/buyer-reasoning.mjs`: conserva hechos del comprador y correcciones de cantidad/presupuesto; incorpora producto del catálogo y guía universal a ALEX.
- `server/sales-policy.mjs`: política consultiva transversal para teléfonos, software, impresoras, accesorios y futuras categorías.
- `server/whatsapp-test-responder.mjs` y `server/agent-server.mjs`: **ambos** utilizan el mismo razonamiento y reciben el catálogo de su workspace.
- `server/sales-response-guard.mjs`: el precio debe corresponder al **producto exacto identificado**. Bloquea cifras de otros productos, existencias internas, descuentos, entregas, promesas de acciones, solicitud anticipada de identidad para pedido y ofrecimientos de “dejar listo” o derivar sin herramienta real.
- `server/eval-sales-playbook.mjs`: pruebas con OpenAI real, sin enviar WhatsApp ni escribir en CRM; registrar únicamente muestras sintéticas.

### Pruebas y salud
- 121/121 tests automáticos, typecheck y build completados correctamente (rama `feat/stech-arm-crm-foundation-20261102`).
- 6 escenarios sintéticos ejecutados con OpenAI real: compra doméstica, necesidad detallada, objeción, comprador decidido, cancelación y compatibilidad técnica. 6/6 respuestas con formato estructurado y aplicación de reglas (modelo no garantiza comportamiento perfecto futuro).
- Servicios PC020 recargados tras tests: WhatsApp firmado READY, dos celulares sandbox autorizados, ALEX configurado y panel CRM HTTP 200. Último commit desplegado de esta lógica: `d5ae84f`.
- No se enviaron mensajes WhatsApp desde la evaluación, no se crearon oportunidades ni seguimientos.

### Limitaciones reales (no afirmar completado)
- Aunque **la lógica** admite cualquier catálogo, el CRM de prueba tiene hoy **cuatro modelos Ulefone**; otros productos no pueden recibir precio, disponibilidad o especificaciones verificadas hasta que se incorporen y actualicen.
- Sin herramientas transaccionales de cotización/pedido/pago, ALEX puede orientar, pero **no** emitir, registrar o cobrar.
- Matching por catálogo heurístico y sistema de reglas; no demuestra precisión perfecta ante nombres ambiguos. No inventar equivalencias de partnumber.
- La memoria estructurada de largo plazo, integración completa ERP/ATP, durable outbox, aprobación de descuentos, seguimientos permitidos, evaluación humana y E2E con mensajes reales posteriores al despliegue siguen pendientes.
- Sin clientes reales: solo dos números sandbox aprobados, sin mensajes proactivos.

### Próximo bloque de ventas — no confundir con filtros B2B
1. Añadir al catálogo comercial **más categorías** con fichas verificadas, variantes, compatibilidad y fuentes, desde ERP read-only y proveedores cuando proceda.
2. Crear **tools de venta** de solo lectura para búsqueda, compatibilidad, precio vigente/stock vendible, más propuesta de cotización y aprobación con auditoría.
3. Añadir **memoria corregible por cliente y oportunidad** y evaluaciones con casos reales de objeciones, comparación y cierre.
4. Completar cotización/checkout responsable: el backend confirma, luego ALEX lo comunica.
