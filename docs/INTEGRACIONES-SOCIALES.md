# Investigación y decisión: integraciones STECH

## Fuentes oficiales (revisadas 2026-11-02)
- Composio Instagram: https://docs.composio.dev/toolkits/instagram
- Composio Facebook: https://docs.composio.dev/toolkits/facebook
- Composio WhatsApp: https://docs.composio.dev/kb/guide/toolkits-whatsapp
- Meta Instagram API: https://developers.facebook.com/docs/instagram-platform/
- Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Chatwoot canales: https://www.chatwoot.com/hc/user-guide/articles/1784258859-que-es-un-canal-que-es-una-bandeja-de-entrada
- DeskcommCRM: https://github.com/melgarafael/DeskcommCRM

## Hallazgos
- Composio expone herramientas para consultar conversaciones de páginas Facebook, mensajes de Instagram Business/Creator, comentarios y herramientas de WhatsApp Business.
- En esta sesión de Composio los toolkits instagram, facebook y whatsapp NO tienen conexión activa. No confundir existencia del toolkit con cuentas conectadas.
- Instagram Business/Creator y Pages precisan elegir la cuenta y autorizar scopes correctos. Las cuentas personales no están cubiertas por los toolkits empresariales.
- WhatsApp requiere una WhatsApp Business Account (WABA) y número compatible con Cloud API. Puede requerir plantillas aprobadas y respetar reglas de mensajería.
- Chatwoot es alternativa si queremos omnicanal ready-made, pero evitar crear dos inbox como fuentes de verdad.
- ManyChat sirve para campañas automáticas/embudos sociales; no reemplaza las tablas comerciales ni el ERP.
- Muse no es componente imprescindible: el agente del CRM y Composio cubren orquestación y acciones. No depender de disponibilidad regional de Muse.

## STECH ya existente
- C:\DESAROLLO\HERMES: Meta MCP con contenido orgánico, marketing mixto y controles de aprobación.
- HERMES documenta que Instagram profesional está vinculado a una página específica; no cambiar asociaciones automáticamente.
- Al momento de su última documentación, faltaban permisos de publicación y META_ORGANIC_PUBLISH_ENABLED=false.
- NO dar por vigentes permisos, IDs, tokens ni autorizaciones históricos. Comprobar estado solo al configurar.
- C:\DESAROLLO\crm-frontend: CRM antiguo, referencia de UI y convenciones; no copiar su .env a GitHub.

## Orden seguro para producción
1. Definir identidad STECH/cuentas Meta oficiales y propietarios.
2. Elegir UNA ruta de recepción de conversaciones (backend propio webhook oficial, o un inbox proveedor) y mantener IDs idempotentes.
3. Autenticar Composio por cada herramienta requerida sin exportar tokens al frontend.
4. Validar lectura sin efectos. A continuación prueba controlada de respuesta a cuenta de prueba con aprobación humana.
5. Activar seguimiento comercial después de políticas de opt-in y límites.
6. HERMES se reserva para contenido/Ads, siempre con doble confirmación de publicación.
