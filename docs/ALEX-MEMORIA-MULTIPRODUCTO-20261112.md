# ALEX — Memoria comercial multiproducto (12/11/2026)

## Objetivo
Permitir que un comprador cambie, añada, quite y consulte **varios
productos de manera independiente**, sin repetir preguntas ni interpretar
comparaciones o preguntas sobre stock como pedidos.

## Arquitectura
- **Supabase exclusivamente.** Se reutiliza el campo JSONB `sales_memory`
  de `arm_agent_conversations` y `arm_lead_insights`: no se crea una
  base SQL Server ni se consulta el ERP.
- El formato de memoria pasa de versión 1 a 2 en escrituras nuevas; el lector
  acepta ambos y migra el anterior de forma gradual sin fabricar líneas.
- `draft_items` incluye exclusivamente `partnumber` y `quantity` (máximo
  12 SKU, 1–999 unidades por línea). Se conserva `draft_focus` solamente
  cuando puede identificarse sin ambigüedad. No se almacenan precios,
  teléfonos, nombres, documentos, enlaces de pago o stock en esa memoria.
- Las referencias guardadas son **pistas**: antes de ofrecer datos se
  revalidan contra `arm_products` del mismo workspace y las fuentes de
  precio y stock existentes en Supabase.
- La búsqueda del catálogo usa consultas independientes cuando el cliente
  menciona dos modelos, y rescata los SKU del borrador para que «¿cuánto
  sale todo?» no pierda los productos al acortarse el contexto.
- `enrichCatalog` comprueba la disponibilidad para **cada cantidad por SKU**;
  un X13 agotado no vuelve «agotado» un Armor 22.
- `assessCommercialReadiness` expone `draftLines` y `demoBasket` para
  el laboratorio. Nunca cambia `quoteCreated`, `orderCreated`,
  `paymentRegistered` ni `advisorAssigned` a true.
- El panel de ALEX muestra las líneas y, cuando el comprador solicita
  importes, el cálculo por modelo y el total **simulados**. No se genera
  PDF comercial, comprobante, pedido ni reserva real.
- `protectSalesResponse` recalcula determinísticamente los totales del
  piloto y comprueba las correspondencias SKU/precio cuando se comparan
  varios productos. Rechaza cifras equivocadas o descuentos no aprobados.

## Escenarios verificados
1. «oe quiero 3 Armor X13 y 2 Armor 22».
2. «mejor 4 del Armor X13» sin alterar las dos unidades del otro.
3. «¿y el total?, ¿aceptan Yape?» → total S/ 5,194.00 de laboratorio,
   medio de pago por confirmar. GPT-5.4-mini había respondido
   **S/ 5,196**: el guard devolvió el total matemáticamente correcto.
4. «mejor 6 del X13» → X13 no disponible para esa cantidad, Armor 22
   todavía disponible; cálculo matemático total S/ 6,792, no venta.
5. «noo mejor 4» después de nombrar dos SKU → no se altera ningún
   artículo; se pregunta cuál debe corregirse.
6. «quiero comparar X13 y Armor 22, ¿cuánto cuesta cada uno?» → no
   genera un borrador de compra; permite los precios simulados distintos
   y bloquea su intercambio accidental.
7. «quita el X13», «agrega 2 Armor 22», «mejor quiero otro modelo»
   en un borrador de un solo artículo; cambios explícitos y acotados.
8. No añadir productos por «quiero ver fotos», «quiero saber precio»,
   «¿cuál es mejor?», ni por una incidencia posventa.
9. Se leen memorias v1 y se normalizan sin duplicar cantidades.
10. Recuperación de catálogo con datos reales del piloto de Supabase:
    4 candidatos, cantidades por SKU, total correcto, sin escrituras.

## Calidad y limitaciones
- La prueba privada del modelo fue reproducible con
  `node server/qa-conversation-diversity.mjs` y los cuatro casos nuevos.
  Los cálculos de importes se tratan como matemáticas determinísticas,
  no como un resultado «autorizado» del modelo.
- La memoria multiproducto es **interés provisional**, no un carrito de
  checkout, proforma emitida ni pedido.
- Las variantes muy parecidas sin SKU exacto siguen pendientes de
  aclaración; no se inventan coincidencias.
- Las referencias de fotografías, comparación de imágenes, compatibilidad
  y posventa se rigen por sus guardas existentes.
- No se validaron envíos reales de WhatsApp ni se ampliaron los destinatarios
  de prueba. El sistema sigue en PR borrador.

## Pendiente para siguientes rondas
- Reemplazos parciales explícitos en carritos con 3+ productos y referencias
  anafóricas «el segundo», «de esos dos» sin inventar identidad.
- Retorno después de días: vigencia de catálogo, caducidad de precio,
  estado del asesor y permiso de contacto antes de reanudar.
- Cotizador real transaccional y reservas/pedidos únicamente cuando los
  precios y existencias de Supabase estén aprobados.
- Evaluación sobre 20+ diálogos completos, no solo un turno, incluyendo
  reclamaciones simultáneas con consultas comerciales.
