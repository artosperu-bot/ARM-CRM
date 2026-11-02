# STECH | Reglas del vendedor IA (02/11/2026)

## Prioridad comercial
1. Conversación breve y consultiva. Primero identificar necesidad y uso. Nunca anunciar precio, costo ni disponibilidad sin petición expresa del cliente.
2. Cuando el cliente pregunte por stock responder únicamente **disponible, no disponible o por confirmar**, sin cantidades exactas.
3. Precio solo a petición y desde ERP/catálogo verificado; si aún no está comprobado, ofrecer cotización. Sin cifras inventadas en operación real.
4. **Simulación opcional del laboratorio**, desactivada por defecto; precios ficticios en PEN separados del catálogo real, etiquetados en la respuesta. En simulación no se agendan tareas ni se envía a canales.
5. Usar únicamente certificaciones documentadas por fabricante. La clasificación IP68/IP69K y ensayos MIL-STD-810H no constituyen garantía de que un equipo jamás sufrirá daño por agua.
6. Beneficios técnicos verificados en `server/product-knowledge.mjs`, con URLs de Ulefone: Armor 22, Armor X13 y Armor 25T Pro.
7. Recordatorios: pedir **nombre completo**, medio de contacto (celular para chat privado), fecha/hora en zona de Lima y consentimiento explícito. No solicitar DNI/carné de extranjería para cotizar ni recordar una compra. Distrito/dirección solo si hay entrega/recojo.
8. `OpenAI Responses API` extrae el seguimiento en JSON estructurado usando la misma solicitud del chat, sin herramientas adicionales de pago; validación determinista del último mensaje, identidad, consentimiento, fecha y hora antes de llamar a Supabase.
9. `arm_book_agent_followup`: RPC `SECURITY INVOKER`, transacción atómica, RLS, teléfono de 9 dígitos, fecha futura hasta 90 días, operación idempotente por conversación, reutiliza contactos por teléfono. Solo crea tarea interna; nunca envía mensajes automáticamente.
10. Confirmación al cliente **solo después de guardar**. Se mantiene una sola tarea por conversación.

## Estado/limitaciones
- Las conversaciones comerciales del agente funcionan solamente en laboratorio interno PC020. El seguimiento automático ya está implementado para sesiones autorizadas, pero **aún no se probó una sesión Google de punta a punta creando una tarea persistente**.
- SQL RPC probado con rol autenticado, creación duplicada y transacción `ROLLBACK`; se preserva el CRM sin datos ficticios.
- La mensajería real de Meta, ERP y envío de recordatorios por WhatsApp siguen pendientes; no afirmar que un mensaje saldrá automáticamente en la fecha.
- Precios ficticios laboratorio: Armor 22 S/999, Armor 25T Pro S/1799, Armor X12 Pro S/659, Armor X13 S/799. Nunca enviarlos al cliente ni escribirlos al catálogo/ERP.
- Límite actual: 20 consultas API por día, GPT-5.4 Mini, 450 tokens máximos de salida por respuesta estructurada.

## Fuentes de certificaciones
- Armor 22: https://store.ulefone.com/es/pages/armor22-spec
- Armor X13: https://store.ulefone.com/es/pages/armorx13-spec
- Armor 25T Pro: https://store.ulefone.com/es/pages/armor-25t-pro-specs

## Pruebas
- `npm test` incluye checks de aislamiento de simulación y calendario/consentimiento.
- `node server/evaluate-sales-policy.mjs` hace solicitudes reales a OpenAI y **consume tokens**, sin persistencia CRM.
