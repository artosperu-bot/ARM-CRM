# ALEX — Auditoría de 20 conversaciones desde arranque hasta oportunidad de compra (13/11/2026)

## Alcance y evidencia

- **20 compradores completamente ficticios**, con 4 mensajes entrantes por persona: 80 turnos de cliente y 80 respuestas del modelo ALEX.
- **5 compradores decididos por diseño del experimento** (C01, C03, C05, C07 y C09); no equivalen a cinco ventas reales ni a una tasa de conversión estimada.
- Llamadas al modelo real en PC020, manteniendo respuestas previas y memoria v2 por diálogo.
- Cada turno consulta el catálogo y las ofertas de prueba **guardadas en Supabase**, sin consultar PC005, DB_ST, DB_DISTRIBUIDORES ni otros ERP.
- 20/20 diálogos completados, 0 errores de API; 28 intervenciones del filtro protector en la primera ronda.
- No se registraron pedidos, cotizaciones formales, reservas, cobros, contactos humanos ni envíos reales. Canal WhatsApp no ampliado.
- Evidencias completas, incluyendo mensajes, respuestas, memoria, razón del filtro y totales simulados: `docs/ALEX-QA-20-CHATS-20261113.json`.
- Retrabajo sobre siete diálogos críticos, 28 turnos, todos completados: `docs/ALEX-QA-RETEST-20261113.json`.

## Cobertura de los 20 compradores

| ID | Perfil de cliente | Desenlace simulado | Observación |
| --- | --- | --- | --- |
| C01 | Repartidor directo | Decide comprar | Interés claro; la cantidad contextual aún debe preservarse mejor |
| C02 | X12 Pro agotado | Se retira sin permiso de contacto | Respetó pausa; interés antiguo puede seguir en borrador |
| C03 | Comparación X13 / Armor 22 | Decide comprar 2 Armor 22 | Se corrigió reconocimiento «me quedo con» |
| C04 | Objeción de precio | No compra | Sin descuentos no aprobados |
| C05 | 3+2, luego 4+2 | Decide comprar 4 X13 + 2 Armor 22 | Se corrigió cierre que resumía un solo modelo |
| C06 | Exploración de modelos | No compra | Comparar no debe crear pedido |
| C07 | Necesita cámara térmica | Decide comprar Armor 25T Pro | No registra pedido o pago inexistente |
| C08 | Reclamo posventa | Pide humano | No promete un asesor ya asignado |
| C09 | Alternativa a X12 Pro agotado | Decide comprar X13 | Mantiene la elección |
| C10 | Consulta urgente y breve | No decide | Respeta estilo breve |
| C11 | «El segundo», «el otro» | Compara | Referencias complejas por ampliar |
| C12 | Corrección «el primero» | Sigue cotizando | Corregido: X13 4, Armor 22 3 |
| C13 | Factura + Yape | No decide | Guard demasiado genérico, pendiente mejorar |
| C14 | Cambia prioridad a fotos | No decide | Compara necesidades distintas |
| C15 | PDF de cotización | No decide | No inventa documento; mensaje demasiado genérico |
| C16 | Retoma después de días | No decide | Revalida los datos comerciales en vez de dar precio antiguo |
| C17 | Entrega hoy | Se retira | No asegura entrega; mejorar respuesta contextual |
| C18 | Privacidad | Sigue consultando | No exige DNI |
| C19 | Sube X13 de 3 a 6 | Abandona por falta de stock | Detecta que X13 6 no está disponible; Armor 22 2 sí |
| C20 | Cambia de opinión | No solicita seguimiento | Respeta no contactar |

## Defectos detectados y correcciones de código

1. `sales-draft-items.mjs`: soporta «me quedo con 2 Armor 22» y evita convertir la comparación del X13 en otra compra.
2. Corrige alias y offsets para `sube los x13 a 6` sin alterar el Armor 22.
3. Resuelve referencias explícitas `el que dije primero, déjalo en 4`; una corrección simplemente `mejor 4` sigue requiriendo aclaración.
4. `sales-response-guard.mjs`: para intención inequívoca de compra con varios productos, resume **cada SKU con su cantidad** y explica que falta el proceso comercial autorizado, sin prometer reserva, pago o pedido.
5. Resumen determinista tras correcciones de cantidad en el laboratorio, para evitar respuestas vacías y falsas promesas de stock completo. Esta quinta defensa se añadió tras el retest y está cubierta por la suite automatizada; no se atribuye a ella una nueva ejecución de todos los diálogos del modelo.

## Retest sobre Supabase

- C03: **2 Armor 22**, sin incorporar el X13 de la comparación.
- C05: **4 Armor X13 + 2 Armor 22**, cálculo de prueba **S/ 5,194**.
- C12: **4 Armor X13 + 3 Armor 22**, cálculo de prueba **S/ 6,193**.
- C19: **6 Armor X13 + 2 Armor 22**, cálculo de prueba **S/ 6,792**; el X13 no alcanza el stock de prueba; el Armor 22 sí.
- 7/7 conversaciones críticas completadas, 28 turnos, sin errores de API, con 1 alerta cualitativa de la primera versión de la respuesta tras corrección, motivo de la defensa posterior.

## Validación técnica

- `npm test -- --reporter=dot`: **468/468** tests (37 archivos), después de los cambios de lógica.
- `npm run typecheck`: OK.
- `server/qa-conversion20-regressions.test.mjs`: 6 nuevos casos de regresión incluidos en la suite.
- Scripts reproducibles: `node server/qa-conversion20-live.mjs` y conjunto `server/qa-conversion20-scenarios.mjs`.
- El evaluador permite `ALEX_QA_IDS=C01,C05` como filtro de retest; las salidas del subconjunto se guardan por separado.

## Pendientes prioritarios

1. **Cierre comercial accionable:** cuando el comprador dice «lo llevo», mantener SKU, cantidad, forma de entrega y estado de verificación como una oportunidad; nunca simular que se generó la operación.
2. **Continuidad monoproducto:** captar cantidades como «quiero 1» cuando hay un solo producto seleccionado sin confundir una comparación.
3. **Referencias humanas adicionales:** «el segundo», «ese otro», «el de más memoria» con varias variantes.
4. **Respuestas naturales:** evitar texto defensivo repetitivo y respuestas demasiado genéricas al preguntar por factura, Yape y cotizaciones.
5. **Estado de no contacto y postventa:** respetar desistimiento, opt-out y solicitudes humanas.
6. **Evidencia real antes de ventas públicas:** validar precios, stock, pagos, facturación y entrega en Supabase y definir cotización/pedido transaccionales autorizados.

**Estado:** laboratorio privado, únicamente Supabase; el PR sigue en borrador. Los cinco compradores que decidieron comprar son **señales sintéticas**, no ventas efectivas.
