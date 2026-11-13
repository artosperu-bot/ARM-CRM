# ALEX — Auditoría de estrés conversacional del 13 de noviembre de 2026

## Alcance y método

Se ejecutaron **20 clientes ficticios x 4 turnos = 80 mensajes de compradores y 80 respuestas del modelo** con el motor real de ALEX desde PC020, leyendo las **16 referencias QA** y los **4 Ulefone piloto** de Supabase. Las 16 referencias QA pertenecen a ocho subcategorías y permanecen separadas del catálogo operativo. Se usa la política de `simulated:true`, memoria de comprador JSON, catálogo y ofertas inventadas exclusivamente para laboratorio y filtro comercial. No se usó PC005, DB_ST ni SQL Server; no hubo operaciones reales de CRM, pedidos, cobros, reservas ni mensajes por WhatsApp, Instagram o Facebook.

**Distinción esencial:** cinco personajes llegan a expresar «lo compro» por diseño de los casos. No son ventas efectuadas, no demuestran tasa real de conversión y no justifican decir «5 ventas cerradas». La prueba comprueba continuidad y seguridad del siguiente paso, no autorización de checkout.

## Resultados verificables

| Evaluación | Conversaciones completas | Memoria exacta | Fallos detectados por el evaluador |
| --- | ---: | ---: | ---: |
| Primera ejecución, antes de corregir memoria | 20/20 | 15/20 | 5 errores de memoria y 4 alertas textuales |
| Repetición tras corregir memoria | 20/20 | 20/20 | 3 solicitudes prematuras de datos |
| Repetición completa tras mejorar cierre y prompt | 20/20 | 20/20 | 2 respuestas con cuerpo vacío por formato |
| Retest final del formato, S10 y S18 | 2/2 | 2/2 | 0 alertas |
| **Conjunto verificado** (18 casos de ejecución completa + S10 y S18 retestados) | **20/20** | **20/20** | **0 alertas de las reglas evaluadas** |

El **conjunto verificado es una evidencia compuesta**, no una ejecución homogénea de 20 chats después del último cambio. El archivo documenta de qué ejecución proviene cada conversación. Se efectuaron además tres retests específicos de cierres de compra con los ajustes de privacidad; sus resultados finales no presentaron solicitudes indebidas de datos.

**Validación de código:** **505/505 pruebas en 39 archivos**, más compilación TypeScript y `vite build` correctos (advertencia no bloqueante de bundle JS superior a 500 kB).

## Defectos corregidos

1. Cantidad errónea cuando el comprador escribe «mejor 1 monitor LG, las dos laptops igual». La corrección de monitor no modifica la laptop.
2. «Cambio la L15150 por una L1250»: reemplaza solamente el SKU mencionado; preguntar precio de la alternativa no implica sustituir ni agregar.
3. «Además una tablet»: agrega una cuarta línea al borrador cuando hay intención explícita.
4. «Cancélalo todo, ya no compro»: limpia la lista de interés; «no me escribas» no autoriza seguimiento.
5. «Busco Epson L1250, quiero 1»: vincula la cantidad de una segunda cláusula con el único producto explícito.
6. Sumas de prueba de una sola línea, además de varias, sin atribuir los precios inventados al catálogo real.
7. Seguridad del cierre: el prompt de laboratorio ahora prohíbe pedir nombre, apellido, teléfono o datos para una gestión inexistente; el filtro detecta variantes como «me falta tu nombre», «compartas tu nombre» y «dejar tus datos de contacto».
8. Encabezado de WhatsApp: un texto del modelo `PRUEBA STECH: [respuesta]` ya no elimina toda la respuesta de la misma línea.
9. Para acciones no confirmadas en solicitudes QA multiproducto, ALEX conserva la lista y explica qué verificar, en lugar de afirmar que ya registró la compra.

## Algunos resultados de las conversaciones

| Caso | Estado comprobado |
| --- | --- |
| S01 | 2 Lenovo T14 16 GB + 1 LG 27MR400; compra deseada, sin pedir datos personales |
| S02 | 3 Logitech H390 + 1 H570e; siguiente paso seguro |
| S04 | Epson L15150 reemplazada por L1250; interés de compra |
| S09 | 2 Epson L1250 + 4 Logitech H390; una alternativa de router consultada no se añadió |
| S10 | La ambigüedad «mejor 4» no alteró ni las 2 Epson ni los 3 Logitech |
| S13 | Cuatro líneas: AX23 x1, H570e x2, Epson L1250 x1, Tab A9 Plus x1 |
| S15 | Solicitud de asesor humano sin afirmar que haya sido asignado |
| S16 | Cancelación y rechazo de seguimiento respetados |
| S17 | Epson L1250 x1; operación de prueba S/ 799, no cotización real |
| S18 | Archer AX23 x2; operación de prueba S/ 458, no cotización real |
| S19 | Solo comparación Armor X13 vs Tab A9 Plus, sin convertir interés en pedido |
| S20 | 2 Lenovo T14 32 GB + 1 Epson L15150; no se confirmó pago, factura ni entrega |

La lista de S13 produjo un **total de laboratorio de S/ 2,665** (1 × S/ 229 + 2 × S/ 319 + 1 × S/ 799 + 1 × S/ 999). Todos los importes son ficticios y el total es únicamente matemático. Cualquier incompatibilidad o falta de stock obliga a validar antes de vender.

## Evidencias reproducibles

- `docs/ALEX-QA-STRESS-20-20261113.json`: primera ronda, cinco defectos de memoria.
- `docs/ALEX-QA-STRESS-FULL-RETEST-20261113.json`: segunda ronda completa, fallos de privacidad.
- `docs/ALEX-QA-STRESS-FINAL-COMPLETO-20261113.json`: ronda completa con memoria exacta y dos fallos del encabezado.
- `docs/ALEX-QA-STRESS-FORMATO-FINAL-20261113.json`: repetición posterior al arreglo del formato.
- `docs/ALEX-QA-STRESS-VERIFICACION-CONSOLIDADA-20261113.json`: trazas finales con procedencia por caso.
- `docs/ALEX-QA-STRESS-VERIFICACION-CONSOLIDADA-20261113-VERDICT.json`: evaluación automática final.
- `server/qa-stress-scenarios-20261113.mjs`: 20 escenarios de compra, consulta, desistimiento y postventa.
- `server/qa-stress-live-20261113.mjs`, `server/qa-stress-verdict-20261113.mjs`, `server/qa-stress-consolidate-20261113.mjs`: ejecución, evaluación y consolidación de evidencias.
- `server/qa-stress-regressions.test.mjs`: casos reproducibles de cada corrección.

## Lo que todavía no está demostrado

Una auditoría con respuestas de cuatro turnos no valida de manera completa conversaciones de muchos días, resolución universal de «el segundo» o «el de más memoria», compatibilidad técnica de cada fabricante, efectividad de ventas reales ni confirmación transaccional. Algunas respuestas seguras siguen siendo demasiado genéricas (p. ej., cierre ante compatibilidad no verificada sin compra). Estas áreas requieren evaluación de calidad comercial aparte, con evidencia técnica y condiciones comerciales reales aprobadas.

**Alcance final:** Supabase + agente en laboratorio privado; no habilitados clientes reales, pagos, pedidos ni reservas.
