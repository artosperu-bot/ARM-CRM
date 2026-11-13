# ALEX: catálogo universal y criterios para crecer (05/11/2026)

## Objetivo
El agente es vendedor consultivo de cualquier producto o servicio comercializado por STECH. No debe codificarse cada modelo ni asumir que todos los compradores son empresas o buscan celulares. Su trabajo es entender la necesidad, verificar productos pertinentes, recomendar, aclarar dudas, gestionar objeciones y facilitar el siguiente paso verdadero.

## Arquitectura implementada
1. **Intención:** hechos del cliente, preferencias, correcciones, presupuesto, producto y etapa de venta; las decisiones de compra son independientes de la marca.
2. **Búsqueda por contexto:** función PostgreSQL arm_search_catalog, acotada a un workspace con RLS e índices trigram. El backend llama máximo dos consultas y carga hasta 18 productos. Ya no depende de los primeros 25 registros.
3. **SKU exacto:** partnumber identifica una variante comprable; family_key agrupa modelos; variant_options almacena ediciones/configuraciones; category_path y search_terms permiten nuevos rubros y sinónimos sin editar prompts.
4. **Hechos verificados:** arm_product_facts almacena fact_key, fact_value, origen, revisión y expiración por SKU; solo verificados y vigentes llegan a ALEX. Las fichas Ulefone heredadas son fallback temporal.
5. **Precio y disponibilidad:** no dependen de la búsqueda ni de la familia. Precio ha de estar vigente y ser del SKU concreto; stock físico no es disponibilidad vendible. Descuentos, envíos y pedidos requieren confirmación del backend.
6. **Respuesta:** el modelo recibe un JSON íntegro de una selección, sin atributos libres no verificados. El guard independiente rechaza importes cruzados entre SKUs, acciones ficticias, descuentos o promesas de entrega.

## Cómo agregar futuros productos
- Registrar SKU único y fuente de catálogo; nunca inferir equivalencia por similitud de nombre.
- Clasificar categoría, términos de búsqueda y familia, e identificar opciones de variante (almacenamiento, color, licencia, potencia u otros atributos según el rubro).
- Cargar ficha fabricante/manual con URL, hechos específicos, compatibilidades y fecha de revisión. Mantener pendings fuera de las respuestas.
- Validar precio, IGV, logística, canal, margen y stock comprometible en subsistemas transaccionales separados.
- Ejecutar pruebas con modelo concreto, múltiples variantes, términos genéricos, errores ortográficos y artículos no disponibles antes de ponerlos en canales de atención.

| Rubro futuro | Datos especialmente importantes |
| --- | --- |
| Celulares/tablets | PN, memoria, bandas, certificados y garantía |
| Laptops/PC | CPU, RAM, SSD, SO, interfaces, ampliación y compatibilidad |
| Impresoras | tecnología, conectividad, consumibles, rendimiento y garantía |
| Licencias | edición, modalidad, vigencia, activación, usuarios y SO |
| Baterías/drones/cámaras | capacidad, conectores, carga, compatibilidad y restricciones |
| Otros bienes/servicios | atributos del rubro definidos en datos y con fuente, no código fijo |

## Qué se comprobó
- Migraciones 20261105_arm_catalog_scale.sql y 20261105_arm_catalog_search_access.sql aplicadas.
- Consulta "Armor 22" muestra un SKU dominante; categoría "celular resistente" muestra los cuatro Ulefone; artículo desconocido devuelve cero.
- Acceso legítimo ve resultados y usuario sin membresía obtiene cero; anon sin permiso de búsqueda ni de hechos; navegador no puede escribir en hechos.
- 136 pruebas de código aprobadas, TypeScript y compilación. Datos de prueba comerciales intactos, sin envíos de WhatsApp ni modificaciones de precio/stock.
- Solo hay 4 productos y 1 workspace reales en el catálogo actual. Una arquitectura abierta NO equivale a haber cargado todos los inventarios.

## Siguiente fase de negocio, priorizada
P1 importar catálogo ERP y distribuidores con control de cambios (SKU, título, categoría, variantes y evidencias). P1 ficha y compatibilidad verificables. P1 cotizador/precio vendible con aprobaciones. P2 memoria comercial persistente. P2 mediciones de precisión, latencia y búsqueda con 10k/100k SKU antes de afirmar escalabilidad productiva. P2 herramientas de acciones con aprobación y auditoría.

No implementar embeddings, múltiples agentes ni APIs pagadas extra por moda. Empezar con búsqueda léxica y medición; agregar búsqueda híbrida solo si los casos reales lo justifican.

## Referencias
- OpenAI function calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI evaluaciones: https://developers.openai.com/api/docs/guides/agent-evals
- PostgreSQL pg_trgm: https://www.postgresql.org/docs/17/pgtrgm.html
- Supabase búsqueda: https://supabase.com/docs/guides/database/full-text-search
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Shopify productos/variantes: https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections
