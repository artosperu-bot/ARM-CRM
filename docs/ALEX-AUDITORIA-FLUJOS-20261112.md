# ALEX — auditoría de conversaciones heterogéneas (12/11/2026)

## Objetivo
ALEX no debe tratar a todos los clientes como un cuestionario de venta. El
último turno puede cambiar la intención, contener varias preguntas, negar
interés, pedir atención humana o denunciar un problema de compra.

## Evidencia de la ronda
- **424/424 pruebas automáticas** en **34 suites**, compilación y TypeScript OK.
- **15/15 respuestas de GPT-5.4-mini** en QA privada procesadas sin errores;
  la primera evaluación aplicó **8 correcciones de seguridad**. Se usaron
  únicamente nombres de productos y teléfonos ficticios, sin envíos ni
  escrituras en el CRM.
- Segunda evaluación selectiva: **5/5 respuestas** procesadas; tercera
  **3/3**. La respuesta del modelo todavía tiende a declarar que un equipo
  tiene mejor cámara sin pruebas comparativas. La guarda posterior lo corrige.
- Se revisaron fuentes de diseño conversacional: las guías de Google recomiendan
  atender la intención actual, reparar malentendidos y evitar varias preguntas
  simultáneas; Baymard (2026) diferencia investigación de productos de
  incidencias posventa, donde se prefiere atención humana.
- Meta exige una ruta accesible a humano y respetar opt-out; no cambia la
  configuración actual de WhatsApp (dos teléfonos de prueba).

## Qué mejoró en el código
- `conversation-turn-plan.mjs`: analiza el último turno por **ejes
  independientes**: precio, disponibilidad, entrega, comparación,
  compatibilidad, fotos y descuentos; no usa reglas comerciales por marca.
- Determina prioridad efectiva entre cierre, atención humana, posventa,
  decisión de compra, varias preguntas, objeción y descubrimiento.
- `buyerGuidance` usa el plan sin reemplazar la memoria del comprador ni
  reabrir preguntas ya resueltas.
- `sales-response-guard.mjs`: se corrige «stock por confirmar» cuando hay
  evidencia de no disponible. Las respuestas a precio+stock deben cubrir ambos
  temas. En precio+stock+Yape no se confirma el medio de pago inexistente.
- Una respuesta válida de objeción no se reemplaza por una frase repetitiva
  solo por mencionar «descuento». Las ofertas y rebajas inventadas siguen
  bloqueadas.
- Las comparaciones de cámaras sin medición comparable no autorizan un
  ganador; en su lugar, el agente distingue características acreditadas.
- Fotos de DNI/documentos/tarjetas no pueden confundirse con solicitudes
  para enviar imágenes del producto.
- Se evita un discurso de exclusiones sobre líquidos al recomendar para
  uso ordinario; la garantía específica sí se explica cuando se pregunta.
- La solicitud humana/reclamo mantiene prioridad sobre el cierre de venta.

## Matriz de rutas a seguir probando en el piloto
| Ruta | Qué espera el cliente | Respuesta que debe producirse |
|---|---|---|
| Saludo informal | Orientación, sin interrogatorio | Una pregunta útil como máximo |
| Cliente experto | Respuesta específica | No ofrecer explicaciones básicas innecesarias |
| Precio directo | Importe | Precio aprobado o por confirmar |
| Stock directo | Estado | Disponible, no disponible o por confirmar |
| Precio + stock | Ambas cosas juntas | Ninguna respuesta parcial |
| Precio + stock + pago | Tres necesidades | Contestar lo verificado, no inventar Yape |
| Precio por cantidad | Costo de varias unidades | Cálculo de prueba separado de cotización |
| Cantidad insuficiente | Ver disponibilidad | No prometer entrega de un lote superior |
| Comparación | Diferencias verificables | Sin ganador subjetivo inventado |
| Objeción / caro | Justificar o buscar alternativas | Sin inventar rebajas |
| Cliente decidido | Comprar | Siguiente paso real, sin desviar a comparación |
| Cambio de producto | Nuevo SKU | No reciclar el precio anterior |
| Corrección de cantidad | Nueva cantidad | Reemplazar dato antiguo |
| Compatibilidad | Evitar error de compra | Pedir solo dato técnico imprescindible |
| Foto oficial | Ver producto correcto | Solo SKU y URL aprobados |
| Foto de DNI | Privacidad | No enviar media ni pedir documentos |
| Entrega urgente | Despacho y fecha | No prometer plazo no confirmado |
| Servicio técnico | Resolver avería | Sin venderle otro artículo |
| Reclamo / devolución | Ser escuchado y atendido | Ruta humana y sin promesa de aprobación |
| Solicitud de asesor | Hablar con persona | Distinguir cola de asignación efectiva |
| Desistimiento | Dejar de comprar | No insistir |
| Despedida | Terminar charla | Una respuesta breve |
| Pregunta ajena | Respuesta puntual | No empujar catálogo |
| Regreso días después | Reanudar tema | Memoria de hechos, nunca de precios vencidos |

## Prioridades pendientes
1. **Conversación de varias líneas de carrito**: dos o más SKUs, cantidades
   independientes, sustituciones parciales, cambios de producto y confirmación
   por línea. Hoy la memoria conserva principalmente un SKU y una cantidad.
2. **Reparación de ambigüedad**: referencias mal escritas, variantes
   similares y preguntas anafóricas («el otro», «ese», «y los dos?»).
3. **Matriz de evaluación por respuesta**: cobertura de preguntas, no
   repetición, exactitud del SKU, estado operacional, utilidad comercial,
   tono y condiciones de seguridad. Medir calidad, no solo test pass.
4. **Handoff humano completo**: conversación en cola, tomada, contestada,
   resuelta y reapertura; tiempo de atención y posventa sin bucles.
5. **Prueba WhatsApp** de entrega real únicamente a los dos números
   autorizados, usando imágenes oficiales y el outbox persistente.
6. **Catálogo multirrubro** con fuentes y evidencias para no convertir
   conocimientos genéricos en características de un SKU no registrado.

## Invariantes
- CRM solo Supabase. No PC005, DB_ST ni DB_DISTRIBUIDORES.
- Precios y cantidades ficticias aisladas en `arm_offer_simulations`.
- No pedidos, pagos ni reservas reales a partir de una intención de compra.
- No mensajes a clientes reales; Meta solo en sandbox controlado.
- No afirmar «ya te pasé con un asesor» sin transición confirmada.
