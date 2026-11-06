# Auditoría de coherencia de ALEX — 05/11/2026

## Objetivo
Evaluar si ALEX **responde la pregunta real, escucha correcciones, pregunta solo cuando falta algo decisivo, conoce sus límites y no finge acciones comerciales**. No confundir calidad conversacional con que los endpoints y tests funcionan.

## Cómo se auditó
- 12 escenarios sintéticos, **26 turnos reales de gpt-5.4-mini** en una primera ronda, con historial real del diálogo y la política de ALEX.
- Se leyeron todas las respuestas del modelo y el resultado final del guard, por separado.
- Se corrigieron fallos y se repitieron **los mismos 12 escenarios y 26 turnos**.
- Una tercera regresión focalizada ejecutó 5 escenarios y 11 turnos: presupuestos, cotizaciones, modelos inexistentes, solicitud humana y decisión de comprar.
- Sin WhatsApp ni mensajes a destinatarios, sin escrituras en CRM, sin ofertas/productos ficticios cargados en Supabase; solo API de OpenAI para QA.

## Hallazgos concretos y correcciones
| Caso real de prueba | Riesgo observado | Ajuste implementado |
| --- | --- | --- |
| «Quiero hablar con un asesor» → «¿Ya le avisaste?» | ALEX pidió nombre/teléfono y perdió la preferencia por humano | Estado humano se mantiene en el contexto; guard final responde sin inventar notificación ni pedir datos; la asignación real depende del CRM |
| «¿Venden Brother HL-L2340?» → «¿Precio exacto?» | Volvía a pedir referencia completa ya escrita | Conserva referencias externas del comprador, aún cuando no existen en catálogo; bloquea volver a preguntar modelo exacto ya dicho |
| «Cargador Lenovo 65W, ¿sirve?» | Clasificado equivocadamente como stock | Etapa independiente de compatibilidad; pide el dato técnico verdaderamente decisivo |
| «No quiero dar mi DNI» | El modelo intentó pedir nombre y teléfono para un seguimiento no solicitado | Respuesta determinística de privacidad: puede consultar sin proporcionar identidad |
| «Necesito entrega hoy» | Modelo quería insinuar verificación o promesa de entrega | Etapa logística separada, sin confirmar un plazo no sustentado |
| «¿Cuánto cuesta?» | Riesgo de inventar importes en formatos no cubiertos | Guard reconoce S/, PEN, soles y US$/USD y solo autoriza precios del SKU correcto |
| «¿Puedes cotizar?» | Promesas de «dejar lista» cotización no creada | Bloquear promesas de preparación/registro sin herramienta confirmada |
| «3 laptops, S/12000 en total» | ALEX dijo «podrían encajar en presupuesto» sin precios | Nunca confirmar ni sugerir que monto alcanza sin cotización calculada; guard de asequibilidad |
| «Gracias por todo» o «ya no compraré» | Riesgo de insistencia y reabrir venta | Cierre respetuoso sin menú ni nuevas preguntas |
| Catálogo amplio / variantes | Riesgo de confundir SKU, cifras o ficha | Búsqueda por SKU/categoría con hechos revisados; guard de precio por modelo |

## Lo que ya se observa mejor
- Reconoce corrección de 3 a 2 laptops y presupuesto total; no debe exigir los mismos datos.
- Una pregunta adicional ahora busca cubrir una decisión real: por ejemplo, si un cargador de 65 W requiere puerto USB-C PD, pregunta por conexión o modelo.
- No anuncia como disponible un producto sin stock comprometible validado.
- No garantiza un descuento, cobro, pedido, seguimiento o entrega por responder amablemente.

## Batería de regresión
- **server/conversation-coherence.test.mjs** cubre los fallos reales e incluye protección presupuestaria; suma tests permanentes al CI.
- **server/audit-real-dialogues.mjs** ejecuta escenarios con el modelo real sin tocar clientes o datos del CRM; puede limitarse con la variable ALEX_QA_CASES.
- **server/sales-response-guard.mjs** tiene límites ejecutables independientes del prompt.
- **server/buyer-reasoning.mjs**, **server/sales-playbook.mjs** y **server/sales-policy.mjs** comparten reglas entre el agente interno y WhatsApp.
- No se cambia ni reentrena automáticamente el modelo OpenAI; las mejoras son ajustes auditables del producto y casos de prueba que previenen regresiones.

## Límites reconocidos
- La calidad se auditó en escenarios **sintéticos**. No se ha hecho todavía un nuevo recorrido completo de mensajes reales de ambos celulares de prueba tras esta revisión.
- 12 escenarios no representan todos los posibles clientes ni prueban que cada respuesta será correcta; el modelo es probabilístico y requiere evaluación continua.
- El catálogo real todavía tiene 4 artículos Ulefone, sin inventario vendible/cotizador integral conectado. Por tanto, orientar y contestar no equivale a cerrar una venta.
- El humano y el opt-out deben controlarse en el backend y con estado persistente, no solo en la respuesta; la salida IA no autoriza contactos proactivos.
- Próxima etapa: banco de diálogos con lenguaje peruano real (anonimizado con consentimiento), evaluación humana de adecuación/precisión y herramientas transaccionales que permitan pasar de «podría revisar» a «verificado».

## Criterios de aprobación para futuros cambios
1. Primero responder la intención principal o explicar claramente por qué no está confirmado.
2. No repetir preguntas con datos ya proporcionados.
3. Preguntar máximo una cosa concreta y solo cuando cambie la recomendación o permita ejecutar un paso.
4. No atribuir propiedades, precios, compatibilidades ni stock a una ficha sin fuente revisada.
5. No suponer que una compra «entra en presupuesto» sin calcular precio por cantidad, IGV y costos.
6. No prometer acciones que no existen.
7. Suspender atención automática ante baja, humano o cierre según reglas del backend.
8. Registrar el escenario en pruebas de regresión cuando se descubre un fallo.

Documentos relacionados: docs/ALEX-MOTOR-UNIVERSAL-VENTAS-20261105.md, docs/ARQUITECTURA-CATALOGO-UNIVERSAL-20261105.md.
