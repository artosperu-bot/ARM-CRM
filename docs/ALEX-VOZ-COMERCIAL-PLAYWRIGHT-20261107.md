# ALEX — auditoría de voz comercial en conversaciones nuevas (07/11/2026)

## Objetivo

Hacer de comprador real desde una conversación nueva del CRM mediante el navegador autorizado (STECH Playwright MCP), leer respuestas de ALEX, detectar patrones que desalientan la compra y corregirlos en la lógica compartida. No hay WhatsApp externo, pago, reserva ni pedidos de prueba.

## Hallazgo que motivó el cambio

Ante una pregunta general sobre un equipo resistente para trabajar, ALEX enumeró certificaciones y, sin que el cliente solicitara garantías, agregó que «la resistencia no es permanente» y que «los daños por líquidos no están cubiertos por garantía».

**Regla comercial**: la primera respuesta debe relacionar un beneficio verificable con el uso concreto; no iniciar con exclusiones de garantía, consejos alarmistas o condiciones de laboratorio cuando no se piden. **No significa esconder información material**: si el cliente pregunta por agua, cobertura, compatibilidad o uso que dependa de un límite, se responde de forma correcta y completa. Jamás prometer invulnerabilidad, impermeabilidad absoluta ni garantías falsas.

## Cambios técnicos

- `server/commercial-voice.mjs`: clasifica si hay petición explícita sobre garantías, agua, inmersión, golpes o condiciones; produce instrucciones para español comercial peruano, filtra `note` e `ip68` del *contexto generativo por defecto* (no de la ficha de origen), elimina exclusivamente advertencias no pedidas y cierra frases vacías.
- `server/sales-policy.mjs`: prioriza utilidad del producto, contexto y lenguaje corto; pide condiciones de garantía solo cuando corresponde; añade reglas para no extrapolar duración de batería, costo por página o compatibilidad de datos no verificados.
- `server/sales-playbook.mjs`: recomienda beneficio primero, evita abrir con salvedades; el comprador que eligió no debe recibir un ciclo de comparaciones.
- `server/sales-response-guard.mjs`: sanea la respuesta final sin cambiar precio autorizado, cobertura de garantía preguntada ni pregunta técnica que realmente importe.
- `server/agent-server.mjs`, `server/whatsapp-test-responder.mjs`, `server/audit-real-dialogues.mjs`: consumen el mismo criterio comercial sensible al último mensaje del cliente.
- `server/commercial-voice.test.mjs`: 11 pruebas específicas para advertencias espontáneas, información de garantía cuando se solicita, respuestas concretas, diferentes categorías, preguntas válidas y cierre comercial natural.

## Pruebas Playwright — nuevas conversaciones independientes

**Caso 1: celular para almacén y campo**
- Cliente: «Busco un celular que me aguante el ritmo y que tenga buena batería. ¿Qué tal es el Ulefone Armor X13 para mí?»
- ALEX posterior al primer ajuste: describe batería y resistencia orientadas al trabajo; no agregó exclusiones de garantía ni laboratorio.
- Falta detectada: apertura «Sí te puede servir bastante» y pregunta final artificial para comparar con otro Ulefone sin necesidad.
- Segundo mensaje: cliente ya eligió dos y pidió sencillez; ALEX respetó el modelo, pero seguía cerrando con «si te sirve, puedo ayudarte a revisar el siguiente paso».
- Tercer mensaje: cliente preguntó **directamente** por cobertura de daños por agua e IP68. ALEX sí explicó el ensayo de 1,5 m durante 30 minutos y la exclusión de daños por líquidos según el fabricante. Es el comportamiento correcto ante consulta explícita.

**Caso 2: impresora Epson L1250 para negocio pequeño**
- ALEX respondió con un beneficio práctico y sin advertencias espontáneas.
- Debilidad detectada: repetía «Sí te puede servir bastante» y hacía preguntas no indispensables; mención de costo bajo de mantenimiento sin costo por página comprobado. Se añadieron instrucciones para no asegurar ahorros sin evidencia.

**Caso 3: nueva conversación después de la segunda corrección**
- Cliente: «Necesito un celular para trabajar en reparto y almacén. Me interesa el Ulefone Armor X13. En pocas palabras, ¿qué me aporta a mí? No me des un discurso de vendedor.»
- Respuesta real recuperada desde la interfaz tras una reconexión del navegador: «Para reparto y almacén te aporta batería grande para aguantar la jornada, 64 GB para lo básico del trabajo y protección IP68/IP69K + MIL-STD-810H, que ayuda en ambientes con polvo, salpicaduras y golpes ocasionales. Además, la cámara nocturna puede servirte si trabajas con poca luz o haces registros en zonas oscuras.»
- Evolución: sin advertencias gratuitas, sin preguntar por otros modelos y sin cierre vacío. Advertencia de calidad pendiente: no convertir capacidad de batería en duración garantizada; la instrucción quedó reforzada tras esta observación.

## Verificaciones técnicas

- El primer conjunto de cambios aprobó 187/187 pruebas, `npm run typecheck` y build.
- La segunda revisión de tono aprobó 191/191 pruebas, typecheck y build antes de las instrucciones adicionales sobre batería y ahorros. **Reejecutar al desplegar estas últimas instrucciones**.
- ALEX privado en PC020 se reinició para cargar las mejoras del primer ajuste y de cierre conversacional. Los demás servicios, incluido WhatsApp, no se reiniciaron.
- Los mensajes de prueba del chat privado quedan en el historial de CRM, sin crear oportunidades ni contactos ni enviar mensajes a clientes.

## Siguiente ciclo

Crear un conjunto repetible de conversaciones simuladas en categorías distintas: compra decidida, comparación solicitada, objeciones, precio, regalo, garantía consultada, compatibilidad, cliente apurado, cantidades y B2B no asumido. Medir coherencia, utilidad, naturalidad, preguntas innecesarias y si se ejecutó realmente la acción comercial, no solo seguridad o cantidad de tests.
