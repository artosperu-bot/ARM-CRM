# ALEX — entrega a asesor con estado operativo (12/11/2026)

## Cambios comprobados
- El estado `human` con `assigned_to IS NULL` significa **en cola sin asesor**.
- La acción `claim` asigna el usuario autenticado mediante una transacción y bloqueo de fila; el caso deja de estar disponible para otro asesor.
- `release` devuelve la conversación a la cola; `close` la marca resuelta; `reopen` requiere propietario del espacio.
- `human_queued_at` y `human_assigned_at` registran las fechas; `arm_handoff_audit` conserva el historial de transiciones.
- La bandeja muestra cola, propietario (propia u otro asesor), fechas y acciones permitidas, con refresco mientras esté abierta.
- Las acciones no envían mensajes WhatsApp, no abren reclamos ni generan pedidos ni cotizaciones.

## Seguridad
- API pública `arm_human_thread_action(uuid,uuid,text)`: `SECURITY INVOKER`, invoca una función de `arm_private` no expuesta.
- La función privada valida `auth.uid()`, acceso activo en `crm_usuarios`, pertenencia al workspace y estado vigente antes de actualizar.
- La tabla `arm_threads` conserva solamente SELECT para `authenticated`; se revocó el antiguo UPDATE(status).
- La tabla de auditoría solo permite lectura RLS a miembros del workspace. No se concede INSERT/UPDATE/DELETE al navegador.
- Sin permisos para `anon`. No se consulta ni modifica PC005/DB_ST.

## Verificaciones
- Prueba SQL en transacción con ROLLBACK: queue → claim → segunda toma rechazada → release → claim → close → reopen. Auditoría de seis eventos antes del ROLLBACK y cero eventos después.
- Escritura directa a `arm_threads` rechazada para usuario normal.
- 364/364 pruebas unitarias/regresión; typecheck y build correctos.
- Comprobación posterior: conversación de prueba mantiene estado `pending`, sin responsable ni eventos de auditoría.
- Pendiente: interacción visual con una cuenta humana en el navegador, confirmación de notificación interna a varios asesores, ensayos de cargas simultáneas reales y envío/recepción de WhatsApp a teléfonos permitidos.

## Operación
1. El cliente solicita humano o se detecta posventa grave: el gateway pone el hilo en estado `human` sin `assigned_to`.
2. Un asesor autorizado abre **Bandeja**, ve «En cola · sin asesor» y hace clic en **Tomar conversación**.
3. Solo si la operación se confirmó, el CRM muestra «Atendida por mí» y la fecha.
4. El asesor puede **Liberar** o **Marcar resuelta**. Un propietario puede reabrir una conversación cerrada.
5. ALEX mantiene sus respuestas automáticas detenidas mientras el hilo esté en atención humana.

> Una cola no es una asignación. Una asignación no es una notificación enviada ni una respuesta redactada.
