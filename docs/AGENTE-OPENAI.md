# Agente comercial STECH — solo OpenAI API

## Entregado en PC020
- `src/features/agent/AgentPage.tsx`: conversaciones privadas, listado, historial persistente, consulta supervisada, tokens y costo aproximado.
- `server/agent-server.mjs`: backend Node.js local que escucha **únicamente** en `127.0.0.1:8789`. Lee la clave de `C:\DESAROLLO\STECH_AGENT\.env` (`OPENAI_API_KEY`) **sin copiarla**, o variable de entorno. La clave **NO está en Vite, GitHub ni Supabase**.
- Proveedor de IA: **exclusivamente OpenAI Responses API**. Modelo fijado `gpt-5.4-mini`. Sin búsqueda web, file search, embeddings, voz, imágenes, Realtime, modelo alternativo ni herramientas alojadas facturables.
- Solo chat interno del administrador/asesor autorizado. **Sin envío de mensajes** a WhatsApp, Facebook o Instagram.
- Catálogo: hasta 25 productos reales de Supabase. Precios, stock, especificaciones y garantías no se inventan; se señalan sin verificar.
- Historial privado en `arm_agent_conversations` / `arm_agent_turns`, eventos nuevos en `arm_ai_usage` con `source=arm_agent`.
- Las tablas nuevas tienen RLS que restringe lectura y escritura al usuario propietario de cada conversación; probado mediante transacción de prueba con ROLLBACK.

## Límite de gastos y privacidad
- 20 consultas por usuario y día en el proceso local, y 20 eventos guardados por workspace/día UTC.
- Pregunta hasta 800 caracteres, contexto últimos 8 turnos, hasta 350 tokens de salida por respuesta (incluye razonamiento).
- El backend usa `store: false`, no requiere almacenamiento de conversación en OpenAI.
- OpenAI sí puede cobrar tokens de las solicitudes. Estimación de referencia (noviembre 2026): `gpt-5.4-mini` USD $0.75 / millón entrada, $0.075 / millón entrada cacheada y $4.50 / millón salida; tarifa sujeta a cambios. El CRM registra **estimaciones**, nunca las presenta como factura oficial.
- **Para un límite de gasto real** configurar también presupuestos/controles en la plataforma OpenAI. Los límites de la aplicación no garantizan un máximo de facturación externo.

## Inicio local
```powershell
cd C:\DESAROLLO\ARM-CRM
npm run agent
```
El frontend corre en `http://127.0.0.1:5175/`; entra con Google y abre **Agente comercial**. El backend local queda en `http://127.0.0.1:8789/health`.

No exponer el puerto a Internet ni copiar `OPENAI_API_KEY` a variables `VITE_*`.
El servicio debe mantenerse en ejecución en PC020 mientras se utilice el agente. Para acceso remoto o producción se requiere migrar el backend a un entorno HTTPS con secretos server-side.

## Validación
- Clave preexistente presente y modelo `gpt-5.4-mini` consultado a través de `GET /v1/models/gpt-5.4-mini`, resultado OK (sin consumo de generación).
- `GET /health` -> configured=true, model=gpt-5.4-mini.
- `POST /chat` sin JWT -> HTTP 401.
- SQL RLS de sesiones, turnos y métrica -> validación transaccional con ROLLBACK.
- TypeScript, Vitest, build en PC020 correctos.
- **Aún pendiente**: prueba completa de solicitud autenticada a OpenAI con respuesta generada, ya que la invocación facturable de comprobación fue bloqueada por controles de ejecución. El usuario podrá probar una consulta desde el CRM y se anotarán los tokens en la base si la API responde.

## Pendiente para automatizar ventas
Validar la experiencia de chat con el usuario, integrar stock/precio ERP read-only y finalmente habilitar canales con controles de consentimiento y revisión humana.
