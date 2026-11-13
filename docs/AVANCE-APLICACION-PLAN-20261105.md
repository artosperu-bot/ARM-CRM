# ARM-CRM — Estado verificado de la primera ejecución del plan
Fecha: 2026-11-05. Aplicación progresiva; NO es una declaración de que todas las fases del plan maestro estén completadas.

## Cambios aplicados en producción del proyecto (sin salir del sandbox WhatsApp)
- P0 **RLS Supabase:** migración `20261105_arm_workspace_rls_hardening.sql` aplicada a proyecto `iipamvqbipbolchlozoj`. Corrige 15 políticas ARM (contactos, deals, followups, hilos, uso IA y ofertas de prueba). Verificación: 0 expresiones de workspace autorreferenciales. Prueba con identidad no autorizada: 0 workspaces, 0 contactos, 0 hilos, 0 deals, 0 followups. Con propietario activo: 1 workspace, 1 contacto, 1 hilo. **Solo hay 1 workspace real; la prueba de aislamiento entre 2 workspaces queda pendiente**.
- P0 **Inicio supervisado PC020:** scripts `scripts/ARM-CRM-Watchdog-PC020.ps1` e `INSTALAR-ARM-CRM-INICIO-PC020.ps1` desplegados y shortcut `STECH ARM-CRM PC020.lnk` creado en Startup del usuario `stech`. Supervisión cada 60 s de puertos locales 3000, 8789, 5175. Solo inicia si el puerto está libre, nunca mata procesos ajenos. Log en `%LOCALAPPDATA%\STECH_ARMCRM\watchdog.log`. Se verificaron sintaxis, ejecución inicial, acceso local de servicios y shortcut. **No es servicio al boot sin logon; falta una prueba de reinicio real.**
- P1 **Conexión lectura ERP:** PC020 tiene linked server PC005, DB_ST SQL Server. La copia local de `ST_STOCK_HST_CONSULTA` tenía fecha máxima 2026-10-15, mientras que PC005 reportó 2026-11-05. Se leyó PC005 con consulta SQL parametrizada de solo lectura sin usar NOLOCK.
- P1 **Fuente separada en Supabase:** migración `20261105_arm_erp_stock_observations.sql` aplicada; tabla de mapeo y observaciones. 4 registros sincronizados, 3 coincidencias exactas y recientes, 1 `pending_mapping` (ARM `ARMOR-22-256G` vs PC005 `ARMOR-22-256GB`). No se modifica `arm_products.price_pen` ni `arm_products.stock_erp` ni envío al cliente. La observación de existencia física NO significa disponibilidad vendible.
- P1 **Sincronización programada:** tarea Windows `STECH_ARM_CRM_ERP_SNAPSHOT_PC020` creada y consultada como `Listo`, cada 60 minutos, ejecución solo interactiva, wrapper local bajo `%LOCALAPPDATA%\STECH_ARMCRM`. El primer sync manual respondió 4 observaciones, 3 fresh, 1 pending mapping, 0 stale/anomaly. **Falta confirmar una ejecución automática real tras el primer intervalo y supervisar errores.**
- P0 **Seguridad de datos ERP:** RLS y read-only browser: propietario activo ve 4 mapeos/4 observaciones; identidad no autorizada ve 0/0; authenticated no tiene INSERT en observaciones.
- **CI GitHub:** workflow `.github/workflows/arm-crm-ci.yml` implementado. Ejecución 42094956914 completada con conclusion `success`, typecheck + tests + build sin credenciales.
- **Catálogo visual:** `src/features/catalog/CatalogPage.tsx`, `erp-stock.css`, `src/App.tsx` actualizados en GitHub para mostrar origen PC005, caducidad, físico vs vendible, alias pendiente y filtros. **Aún no desplegado en PC020:** DNS de github.com falló durante git pull y posteriormente la herramienta remota reportó `spawn EPERM`. Último HEAD local verificado en PC020 `220ac68`. NO declarar que el catálogo nuevo está instalado en la PC.

## Situación que no se debe ocultar
- El bot WhatsApp de dos teléfonos sandbox y panel CRM ya funcionaban antes. La nueva integración ERP **no habilita respuestas de stock comercial ni precios reales**.
- Los seguimientos por WhatsApp, cotizaciones, pedidos, mensajes proactivos y otros canales continúan sin activar.
- Persistencia duradera de salida, broker/outbox y prevención de duplicados frente a caída siguen pendientes (Issue #2).
- Entorno comercial sin login Windows, restore/backup, RLS entre workspaces y alertas completas siguen pendientes (Issue #3).
- El proyecto Supabase es compartido con el backend antiguo; los avisos del analizador para vistas/funciones anteriores deben investigarse por separado y no modificarse a ciegas.
- No considerar los 4 productos Ulefone como catálogo completo; faltan Lenovo/Epson/accesorios y todo lo demás.
- Alias Armor22 no existe en ST_EQUIV_PRODUCT/ST_SKU_EQUIVALENCIA; tratarlo como candidato hasta revisión explícita.

## Entregas trazadas como issues
- [#2](https://github.com/artosperu-bot/ARM-CRM/issues/2) durable outbox/reintentos seguros.
- [#3](https://github.com/artosperu-bot/ARM-CRM/issues/3) servicio real sin logon, backups, RLS multiworkspace.
- [#4](https://github.com/artosperu-bot/ARM-CRM/issues/4) stock comercial vendible y pricing ERP.
- [#5](https://github.com/artosperu-bot/ARM-CRM/issues/5) cliente 360, pipeline y cotizador.
- [#6](https://github.com/artosperu-bot/ARM-CRM/issues/6) seguimientos con consentimiento.
- [#7](https://github.com/artosperu-bot/ARM-CRM/issues/7) omnicanal y captación B2C/B2B/B2G.
- [#8](https://github.com/artosperu-bot/ARM-CRM/issues/8) postventa y analítica.

## Siguiente ejecución recomendada (sin comprometer operación)
1. Restaurar DNS/ejecución remota de PC020 y hacer pull ff-only; typecheck/test/build y smoke del Catálogo con sesión Google antes de declarar desplegado.
2. Confirmar primera ejecución automática del snapshot ERP; observar vencimiento sin marcar stock como vendible.
3. Implementar durable outbox y pruebas de reintento ambiguo, y control de acceso entre 2 workspaces.
4. Completar reservas, precios comerciales y equivalencias antes de permitir que ALEX cotice desde ERP.
