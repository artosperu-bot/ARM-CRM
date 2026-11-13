# WhatsApp de prueba — ARM-CRM separado del CRM anterior

Verificado el 02/11/2026 en PC020:

- Receptor público **https://whatsapp.artos.pe/webhooks/whatsapp**, servido por el túnel Cloudflare existente ARTOS-N8N, `127.0.0.1:3000`.
- Código nuevo `server/whatsapp-gateway.mjs`, `server/whatsapp-ingest.mjs`, `server/whatsapp-test-responder.mjs`. El CRM anterior `C:\DESAROLLO\n8n\backend` permanece detenido y no se duplica.
- Meta App: `Wp_Test_N8N_001` (ID `2264991854297489`); test `Phone Number ID=1283086411554196`; emisor `+1 555-672-9256`.
- El token heredado responde correctamente a GET de Meta Graph; **eso no prueba aún permisos de envío**.
- Firma HMAC SHA256 obligatoria, un único destinatario en allowlist, corte por fecha y cuenta habilitada en Supabase, idempotencia por message ID.
- Modelo OpenAI `gpt-5.4-mini` sin herramientas alojadas de pago; máximos 12 respuestas por workspace y día; sin reintento de envíos ambiguos; mensajes y costo guardados en Supabase.
- Solo interlocutores permitidos. ASESOR/handoff tiene prioridad. Automatizaciones antiguas apagadas. Los precios ficticios solo se usan cuando se acepta expresamente el modo simulación y siempre se etiquetan **PRUEBA STECH**.
- Todavía no se ejecutó un envío real ni se verificó un evento firmado por Meta. El módulo de seguimiento automático de WhatsApp sigue sin habilitarse: no afirmar que agenda recordatorios externos.

## Preparación del usuario sin revelar claves

1. Asegurar que el celular **propio** está como receptor de prueba autorizado en la app Meta. No asumir que el número histórico de Jaime pertenece al usuario.
2. Abrir https://developers.facebook.com/apps/2264991854297489/settings/basic/ y revelar **App Secret** con las credenciales del titular.
3. Desde Windows PowerShell en PC020, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\DESAROLLO\ARM-CRM\scripts\CONFIGURAR_WHATSAPP_PRUEBA_ARM.ps1"
```

El asistente pide el secreto sin mostrarlo, celular peruano con prefijo 51 y preferencia de precios ficticios; exige `ACTIVAR` explícitamente. Guarda únicamente en el .env.local privado, reinicia solo el gateway tras verificar PID y habilita el Phone Number ID test de ARM en Supabase. No modifica Cloudflare, Meta webhook existente, procesos antiguos ni canales comerciales.

4. Tras mensaje **ARM_WHATSAPP_TEST_READY=true**, enviar desde el celular autorizado a **+1 555-672-9256**: `Hola, busco el Armor X13 para trabajar en obra`.
5. Confirmar en `https://whatsapp.artos.pe/health`: `webhookVerifiedReady=true`, `inboundConnected=true`, `automaticReplies=true`, `acceptedEvents>0`, `replyStats.sent>0`. Revisar registros de `arm_messages` y `arm_ai_usage`.
6. Para cortar toda respuesta sin desactivar el CRM: poner `ARM_WHATSAPP_AUTO_REPLY=disabled` en el archivo privado y reiniciar **solo** `server/whatsapp-gateway.mjs`, o detener su proceso. No iniciar backend antiguo junto al gateway.

## Diagnóstico
- `403 INVALID_SIGNATURE`: App Secret incorrecto o firma inválida; **no quitar esta verificación**.
- `503 META_APP_SECRET_NOT_CONFIGURED`: falta secreto privado.
- `CRM_INBOUND_NOT_CONNECTED`: falta allowlist segura o servicio de persistencia.
- Mensaje registrado sin respuesta: revisar contador `replyStats.failed`, token Graph, permisos WhatsApp y disponibilidad OpenAI.
- Meta número sandbox puede requerir destinatarios expresamente verificados; confirmar en WhatsApp API Setup antes de enviar.

## Limitaciones de prueba
- Se probó código mediante Vitest; la prueba completa con evento Meta real y respuesta a celular no está confirmada.
- No confiar en precios o stock simulados para ventas.
- No se han habilitado publicaciones/DM de Instagram/Facebook; solo prueba WhatsApp explícita.


## Añadir un segundo destinatario ya verificado en Meta

No repetir el asistente inicial: lo reemplazaría por un solo número. Conserva el primer celular autorizado y añade otro con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\DESAROLLO\ARM-CRM\scripts\AGREGAR_CELULAR_WHATSAPP_PRUEBA_ARM.ps1"
```

Introduce el segundo celular peruano que ya aparece en Meta → WhatsApp → API Setup → To. Confirma `AGREGAR`. No solicita App Secret, no modifica la lista de Meta y no toca el CRM antiguo. Al concluir debe mostrar `ARM_WHATSAPP_EXTRA_NUMBER_READY=true` y `AUTHORIZED_TEST_NUMBERS=2`. Después escribe **desde el segundo celular** al emisor de prueba `+1 555-672-9256`. Meta debe haberlo verificado previamente: el backend ARM no puede verificarlo desde el API de configuración actual.
