# ALEX — catálogo aislado de pruebas por categorías (13/11/2026)

## Objetivo y separación comercial

Se incorporaron **16 referencias exclusivamente de prueba**, dos por cada una de ocho subcategorías, en la misma base Supabase del proyecto ARM-CRM. Se almacenan en **`public.arm_qa_catalog_products`**, separadas de `public.arm_products` y de `arm_search_catalog`: NO deben presentarse a clientes reales.

La tabla tiene RLS activado, ninguna política pública, sin permiso SELECT para `anon` ni `authenticated`; solo `service_role` la consulta desde scripts privados de QA. Todos los partnumbers comienzan por `QA-`, `is_test_data=true` es obligatorio y las fichas llevan `attributes.qa_only=true`. No se tocaron PC005, DB_ST, DB_DISTRIBUIDORES ni SQL Server.

**Precio, stock, configuraciones, descripciones, compatibilidades y cualquier interpretación técnica de estos registros son hipotéticos**; no equivalen a catálogo comercial verificado, ficha real o permiso para vender. La fuente `arm_products` mantiene sus 4 Ulefone originales. Con esos cuatro y las 16 fichas privadas, el evaluador puede simular conversaciones sobre 20 referencias.

## Matriz de categorías (2 productos cada una)

| Categoría y subcategoría | Productos del laboratorio |
| --- | --- |
| Electrónica / Laptops / Oficina | Lenovo ThinkPad T14 16 GB y 32 GB |
| Impresión / Impresoras / Tanque de tinta | Epson EcoTank L1250 y L15150 |
| Electrónica / Monitores / Oficina | Samsung LS24D300 24″ y LG 27MR400 27″ |
| Periféricos / Audio / Auriculares USB | Logitech H570e y H390 |
| Componentes / Memoria RAM / DDR5 | Kingston DDR5 5600 y 7200 MT/s |
| Accesorios / Cargadores / USB-C PD | Cargadores genéricos 65 W y 100 W |
| Electrónica / Tablets / Android | Samsung Galaxy Tab A9 y A9 Plus |
| Redes / Routers / Wi-Fi 6 | TP-Link Archer AX23 y AX55 |

## Ejercicios efectivos

- Primera matriz: **20 conversaciones, 60 turnos, 0 errores de API**, 17 intervenciones de seguridad. No implica que las 20 fueran comercialmente correctas: identificó fallos concretos de desambiguación y memoria.
- Retest crítico: **9 conversaciones, 27 turnos, 0 errores de API**, 10 intervenciones de seguridad.
- Retest final del monitor: **A15, 3 turnos**, conserva 1 laptop T14 16 GB y corrige de 2 a 3 monitores LG.
- Retest de seguridad: **A12 y A17, 6 turnos**, confirma que no se piden datos personales para una solicitud provisional ni se promete compatibilidad del cargador sin prueba.
- Suite local: **485/485 pruebas en 38 archivos aprobadas**, compilación TypeScript y `vite build` correctos.
- Registro de todos los mensajes, respuestas, cantidades, subtotales y razones del filtro: `docs/ALEX-QA-20-CATEGORIAS-20261113.json`, `docs/ALEX-QA-RETEST-CATEGORIAS-20261113.json`, `docs/ALEX-QA-RETEST-FINAL-20261113.json` y `docs/ALEX-QA-SEGURIDAD-FINAL-20261113.json`.
- El ensayo usa el modelo de ALEX real, pero no inserta clientes, conversaciones reales, pagos, reservas, cotizaciones ni mensajes de Meta.

## Defectos detectados y mitigados

1. **Variantes con mismo nombre base**: T14 de 16/32 GB y Samsung A9/A9 Plus. Las referencias explícitas eligen variante; si no están claras, no se decide arbitrariamente.
2. **Modelos cuyo nombre empieza con cifras**: LG 27MR400, códigos de routers y velocidades DDR5. Mejor reconocimiento de códigos completos y unidades.
3. **Comas borradas antes de segmentar**: `mejor 3 H390, el H570e queda igual` alteraba el SKU equivocado. Ahora se conservan separadores antes de normalizar.
4. **Cantidades por línea**: `quiero 2 Epson L1250`, dos routers, tres cargadores, listas de tres categorías y cambios parciales; no se reduce todo a una cantidad global.
5. **Corrección por categoría única**: `mejor 3 monitores LG` altera el LG si es el único monitor de esa marca en el borrador; si hay dos monitores sin distinción, se pregunta.
6. **Totales naturales**: `¿y cuánto es todo?`, `total yape aceptan` ahora remiten al cálculo determinístico del borrador, con medios de pago aún por confirmar.
7. **Seguridad comercial**: las afirmaciones de compatibilidad que dependan de fichas QA no verificadas deben bloquearse. No se debe solicitar DNI, nombre o celular solo para registrar interés provisional.

## Cálculos matemáticos solo de prueba

| Caso | Resultado | Restricción |
| --- | ---: | --- |
| 3 Logitech H390 + 1 H570e | S/ 796 | Ningún pago o pedido |
| 3 cargadores USB-C 65 W + 2 de 100 W | S/ 705 | 100 W por confirmar |
| 1 Lenovo T14 32 GB + 3 H570e + 1 TP-Link AX55 | S/ 5,615 | Solo matemática |
| 1 Lenovo T14 16 GB + 3 LG 27MR400 | S/ 5,396 | 3 monitores superan stock supuesto |

Las cifras proceden de ofertas creadas **únicamente para laboratorio**. No deben comunicarse como importes comerciales reales.

## Reproducción y salvaguardas

- Fuente versionada: `supabase/migrations/20261113_arm_qa_catalog_products_isolated.sql`.
- Catálogo semilla: `server/qa-expanded-category-fixtures.json`.
- Exportación en PC020: `node server/seed-expanded-qa-categories.mjs export` (solo lectura).
- Reseed restringido: variable `ALEX_QA_SEED_CONFIRM=YES` más `node server/seed-expanded-qa-categories.mjs seed`. Solo afecta la tabla QA.
- Pruebas unitarias: `server/qa-expanded-categories-regressions.test.mjs`.
- Evaluación privada: `node server/qa-expanded-categories-live.mjs` (solo lee Supabase + OpenAI y escribe un archivo de resultados local).

**Pendientes:** enriquecer evidencia de catálogo, comparar especificaciones verificadas por SKU, resolver frases anafóricas complejas, mejorar atención posventa/asesor y definir flujo autorizado de oportunidad y cotización. La QA no habilita pagos ni ventas.
