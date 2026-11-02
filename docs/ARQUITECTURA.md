# Arquitectura objetivo — STECH ARM-CRM

## Estado 2026-11-02
La rama inicial contiene un prototipo funcional 100% DEMO: dashboard, Kanban, clientes, inbox, catálogo, laboratorio de borradores e integraciones marcadas como PENDIENTES.
No almacena datos reales, no realiza peticiones a Supabase, no publica y no envía mensajes.

## Separación de responsabilidades

- **CRM/ARM (este repositorio):** UI, clientes, conversaciones, oportunidades, tareas, roles y auditoría.
- **Agente comercial:** clasificación, fichas técnicas verificadas, respuestas supervisadas, handoff humano.
- **Datos (Supabase):** esquema propuesto versionado, RLS por workspace y proveedor/evento único.
- **Datos STECH (ERP/DB_ST PC005):** gateway privado, solo lectura, con PN/EAN validado y fecha de consulta; jamás conexiones SQL desde browser.
- **Composio:** conectores de apps externas habilitados de forma explícita por cuenta y permisos; credenciales solo backend.
- **HERMES:** módulo de marketing Meta ya existente en C:\DESAROLLO\HERMES; reutilización futura vía API versionada, sin fusionar sus archivos ni habilitar publicaciones.
- **n8n:** seguimientos programados y automatizaciones idempotentes (no reemplaza la lógica CRM).
- **DeskcommCRM (MIT):** referencia de arquitectura y componentes para evaluación, no copiado en esta rama.

## Reglas para integración
1. Una sola entidad de contacto por identidad verificable, con mapeo externo por canal, tenant y provider ID.
2. Ingreso mediante webhook firmado/validado y cola idempotente: UNIQUE(workspace, provider, external_event_id).
3. Un único dueño por capacidad de escritura: evita que Composio + HERMES + n8n publiquen o respondan dos veces.
4. LLM devuelve borrador y propuesta de acción; envíos y descuentos requieren permisos/guardrails y auditoría.
5. WhatsApp por Meta Cloud API oficial; evitar sesiones WhatsApp Web no oficiales para operación empresarial.
6. Supabase Auth + RLS para todas las tablas expuestas; tokens privados solo en backend.
7. Sin copiar el .env antiguo directamente: solo reutilizar nombres de variables públicas, comprobar proyecto/keys actuales.
8. Los datos de prueba jamás deben confundirse con clientes reales.

## Siguiente incremento
Autenticación Supabase con membresías, CRUD real sobre esquema aprobado, ingesta Meta por webhook, adaptador ERP de consulta, RAG de celulares, pruebas end-to-end y auditoría de seguridad antes de producción.
