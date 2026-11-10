# ALEX — Estado comercial comprobable y pruebas Playwright (10/11/2026)

## Resultado

En la rama borrador de ALEX se incorpora un resumen comercial calculado por el backend, independiente de lo que afirme la IA, visible en la pantalla del chat privado.

- `server/commercial-readiness.mjs`: evalúa coincidencia de SKU, cantidad pedida, presupuesto declarado, evidencia de precio vigente, disponibilidad vendible y condiciones de cotización pendientes. **Siempre mantiene quoteCreated/orderCreated/paymentRegistered/advisorAssigned en false** mientras no existan funciones reales que las confirmen. No registra nada ni devuelve datos privados. Las ofertas simuladas y el stock físico no cuentan como disponibilidad comercial verificada.
- `server/agent-server.mjs`: adjunta `commercial` a la respuesta de `/chat`; cálculo desde mensaje del comprador y catálogo recuperado de ese espacio, nunca desde una afirmación del modelo.
- `src/features/agent/AgentPage.tsx`: muestra producto, cantidad, presupuesto y verificaciones pendientes. Permite abrir el formulario manual existente solamente fuera de simulación; el contacto ya no se elige automáticamente. Nunca implica que se haya asignado asesor, cotizado o emitido pedido.
- `src/features/agent/salesSignals.ts`: estado comercial basado en el mensaje más reciente, no en sumar palabras clave de hasta cinco turnos previos. Distingue compra, solicitud humana, rechazo del asesor, seguimiento explícito, consulta de precio, desistimiento y conversación cerrada.
- Desistimiento: al recibir «mejor no compro», se oculta y cierra el formulario de seguimiento anterior; las funciones de escritura también comprueban ese estado antes de ejecutarse.
- `server/buyer-reasoning.mjs`: interpreta «mi presupuesto total es S/ ...» sin asumir que el presupuesto equivale al precio del producto.

## Pruebas

- **221/221 tests** en 25 archivos, `npm run typecheck` y `npm run build` correctos en PC020, commit `5c54774`.
- La batería nueva incluye 7 pruebas de evidencia y no creación de pedido/cotización y 7 pruebas adicionales de intención de la UI: palabras antiguas, cambio de intención, cancelación, no asesor, garantías consultadas, pedir siguiente paso y seguimiento no agendado.
- GitHub Actions OK en commit previo `5a78915`; último cambio UI de cancelación aprobado localmente.
- Agente privado `127.0.0.1:8789` reiniciado después de actualizar el backend; `GET /health` respondió `ok:true` y `mode:supervised`.
- Playwright en **nueva pestaña Chrome** (sin tocar la pestaña del sistema de oportunidades):
  1. Cliente de laboratorio: «me interesan 2 Ulefone Armor X13 ... los quiero comprar ... ¿cuánto y dónde pago?». ALEX evitó cifra inventada. La pantalla mostró **Ulefone Armor X13 64 GB, cantidad 2**, «precio vigente», «disponibilidad para venta» y «condiciones de cotización» pendientes. No había cotización, pedido, pago ni asesor asignado.
  2. Se abrió «Gestionar manualmente en CRM»: cliente en `Seleccionar cliente` (sin elegir de manera automática al único contacto existente); registrar seguimiento y crear oportunidad permanecieron deshabilitados.
  3. En el mismo hilo, cliente: «Ya mejor no compro por ahora, gracias. Lo voy a pensar». ALEX aceptó sin presionar. La señal cambió a **No insistir en la venta**. Se detectó que el formulario previamente abierto seguía visible; se corrigió.
  4. Tras último cambio por HMR, Playwright confirmó la desaparición del formulario y el aviso «El cliente decidió no continuar · ninguna gestión pendiente».
- No se enviaron mensajes a WhatsApp, no se creó oportunidad, seguimiento, precio, pedido ni pago. El único error del navegador era una petición opcional `/favicon.ico` con 404, no una falla del chat.

## Límites que permanecen

- Este avance **no** implementa cotizador, checkout, notificación efectiva a asesor ni stock vendible; el CRM puede crear oportunidades/seguimientos manuales con un contacto identificado y una acción autorizada del operador, pero esto no se hizo durante las pruebas.
- El resumen `commercial` es una evaluación temporal de la última respuesta y no se recarga en la página hasta que exista un nuevo turno o endpoint de recuperación. La memoria comercial de comprador sí se guarda en Supabase.
- Procesos de WhatsApp no reiniciados ni habilitados para clientes; PC005 y DB_ST intactos.
- PR #1 sigue **draft**, no integrado a `main`.

## Siguiente acción de valor

Priorizar una **cotización revisable con precio válido + stock vendible + gastos/IGV**, o una **derivación real a asesor con estado visible**, y probarla con operaciones autorizadas, sin crear ventas ficticias. Mantener evaluaciones de lenguaje comercial y resistencia al abandono.
