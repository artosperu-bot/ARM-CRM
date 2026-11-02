# Acceso interno STECH — Google OAuth y correos autorizados

## Implementado y usado en PC020
- ARM-CRM trabaja en `http://127.0.0.1:5175/`.
- Supabase activo: **proyecto anterior** `iipamvqbipbolchlozoj`. Se reutiliza porque **Google OAuth ya estaba habilitado** y existe el administrador real de STECH.
- El proyecto `stech-crm-ai-v2` (`rxewmgnndzacthnhdxjx`) sigue separado; Google allí está deshabilitado, **por lo que NO es el backend actual de ARM-CRM**.
- La URL y la clave **publishable** del proyecto activo están únicamente en `C:\DESAROLLO\ARM-CRM\.env.local`, ignorado en Git.
- En el antiguo `crm_usuarios` había una cuenta habilitada: `artosperu@gmail.com` (`ADMIN`). No se añadieron correos nuevos.
- `ADMIN` puede crear workspaces, `ASESOR` necesita membresía; siempre se exige `crm_usuarios.activo`.
- La interfaz no tiene registro público, entrada demo, ni formulario contraseña. Solo **Continuar con Google**.
- RLS protege las nuevas tablas `arm_*` y depende del workspace y autorización del correo.
- Un usuario que Google autentique sin correo previamente aprobado no puede ingresar ni consultar tablas ARM. El antiguo Supabase mantiene su configuración de signup general; **no se cambió Auth de otros sistemas en producción**.

## Validaciones confirmadas
1. Supabase antiguo `/auth/v1/settings`: Google habilitado.
2. Playwright Chrome aislado en PC020: HTTP 200, un único botón Google, sin registro ni demo.
3. Click Google en Playwright: redirección a `accounts.google.com` sin error.
4. Test transaccional RLS aprobado con identidad Google autorizada: lectura de workspace/catálogo, creación de cliente/oportunidad/seguimiento, cambio de estado; transacción revertida sin datos de prueba.
5. Test RLS identidad no autorizada: sin acceso a workspace, productos ni clientes.
6. **Pendiente exclusivamente la prueba interactiva de completar Google y volver al ARM-CRM con sesión real de navegador**. Playwright no seleccionó cuentas ni introdujo contraseñas, por seguridad.

## Protección de los sistemas existentes
- Nunca se modificó `crm_usuarios` ni se migraron clientes o conversaciones del CRM antiguo.
- Solamente se crearon tablas prefijadas `arm_*` y sus políticas en el Supabase antiguo.
- Se importaron 4 productos Ulefone existentes a `arm_products` del nuevo workspace, sin precios ni stock inventados.
- Mantener el CRM antiguo operativo y sus scopes de Google intactos.

## Supabase nuevo — futuro
El proyecto `stech-crm-ai-v2` conserva sus tablas `arm_*` y una función de validación de nuevos registros preparada, pero aún no se activó su Auth Hook ni el proveedor Google.
Migrar a él únicamente cuando sus credenciales OAuth y redirects estén configurados y validados, evitando apagar el login activo.

Docs oficiales: https://supabase.com/docs/guides/auth/social-login/auth-google
