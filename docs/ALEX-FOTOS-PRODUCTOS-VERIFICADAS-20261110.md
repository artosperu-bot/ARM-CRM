# ALEX — imágenes verificadas y prueba del chat real (10/11/2026)

## Objetivo comercial

Cuando el comprador pida una foto (incluso «oe pásame foto del X13»), ALEX debe enviar o mostrar **una fotografía real del SKU exacto**, nunca una imagen creada por el LLM o de otro producto. Si no hay fuente aprobada, responde en una frase natural. Mantener todas las reglas comerciales previas, privacidad, el traspaso humano y la prohibición de afirmar operaciones ficticias.

## Origen y comprobaciones realizadas

Se recuperaron las imágenes `og:image` de **páginas oficiales del fabricante Ulefone**, y se comprobó cada objeto con HTTPS HEAD: HTTP 200, `image/jpeg` o `image/png`, archivo inferior a 500 kB.

| Part number exacto | Página de fabricante | Fotografía oficial |
|---|---|---|
| ARMOR-22-256G | https://store.ulefone.com/es/products/armor-22 | https://store.ulefone.com/cdn/shop/files/Rugged_Phone_Armor_22_Night_Vision_Camera.jpg?v=1762843122&width=1024 |
| ARMOR-X13 | https://store.ulefone.com/es/products/armor-x13 | https://store.ulefone.com/cdn/shop/files/Ulefone_Rugged_Phone_Armor_X_13.jpg?v=1729493371&width=1024 |
| ARMOR-X12Pro | https://store.ulefone.com/es/products/armor-x12-pro | https://store.ulefone.com/cdn/shop/files/Tough_Phone_armor_x12pro_Ulefone.jpg?v=1729505637&width=1024 |
| ARMOR-25TPro-256GB | https://store.ulefone.com/es/products/armor-25t-pro | https://store.ulefone.com/cdn/shop/files/25T_pro.png?v=1770624363&width=1024 |

**Base de datos:** cuatro registros en `public.arm_product_facts` de ARM Supabase con `fact_key=product_image`, `review_status=verified`, `source_type=manufacturer`, `source_url` oficial, `verified_sku` y URL HTTPS exacta. Caducidad de revisión a un año. La consulta de validación confirmó cuatro filas que corresponden a los cuatro SKU de `arm_products`. No se alteró inventario, precios ni PC005/DB_ST. ALEX no confunde el logotipo o una imagen referencial de otro producto con el solicitado.

## Implementación

- `server/product-photo.mjs`: detección de frases reales en WhatsApp «mandame una foto», «foto del X13», «me muestras cómo es», y negativas «no quiero fotos»; distingue «sacar fotos» y «fotos tomadas con la cámara» para no mandar imágenes inesperadas. Selecciona únicamente una coincidencia exacta de SKU y evidencia revisada; no acepta URL HTTP, IP privada, sitio ajeno o formatos no soportados, ni imágenes cuando hay varios modelos ambiguos.
- `server/product-knowledge.mjs`: el campo multimedia no contamina los atributos técnicos del prompt; el LLM no elige la imagen.
- `server/whatsapp-test-responder.mjs`: para solicitud fotográfica, bypass de GPT y mensaje oficial Cloud API `type=image` con `image.link` y `caption` si hay fotografía verificada. Se vuelve a comprobar estado de hilo, exclusión y traspaso humano justo antes de enviar. Guarda el resultado `arm_messages.message_type=image` y el texto de presentación. Si no hay imagen, envía únicamente una frase, no una foto parecida.
- `server/agent-server.mjs`: CRM privado authenticated chat devuelve `photo` y guarda un marcador seguro de fotografía en la conversación. No consume una generación del modelo para esta respuesta.
- `src/features/agent/photoMessage.ts`, `AgentPage.tsx`, `agent.css`: fotografía visible y persistente en burbuja del asesor con texto alternativo, marca de origen y diseño adaptable. El usuario puede recargar el historial y recuperar la foto por el enlace público oficial validado.
- `server/buyer-reasoning.mjs`: regresión corregida durante prueba real: «Armor X13» provocaba `quantity=13` (identificador confundido con unidades). Ahora la cantidad no se deduce del modelo, pero sigue detectando «quiero 2 Armor X13», «precio x 5» y «precio x5».

## Prueba con Chrome Playwright real

1. Abierta pestaña nueva del CRM local `http://127.0.0.1:5175/` con sesión autorizada; se abrió una conversación nueva del agente.
2. Se envió «oe mano pasame una foto del armor x13 ps» y se observó la respuesta «Foto referencial del modelo: Ulefone Armor X13 64GB» con imagen en pantalla.
3. La inspección del DOM confirmó `img.complete && naturalWidth > 0`, resolución **1000×1000** y `src` exactamente igual a la imagen oficial del fabricante.
4. Se detectó el error de cantidad **13** mostrado por el panel antes de la corrección, convertido en pruebas de regresión para los cuatro modelos. No asumir que una prueba previa visual demuestra la corrección hasta observarla de nuevo.

## Pruebas automáticas

La versión `c10a35e` aprobó **341/341** pruebas en 30 archivos, `npm run typecheck` y `npm run build`. Incluyen las pruebas de payload WhatsApp `type:image` con Meta simulado; sin llamadas de envío real, sin consentimiento de clientes ni cambios de stock. Se prueba fallo cerrado si imagen no está validada, fuente expirada, SKU equivocado, múltiples productos, opt-out, traspaso humano y solicitud explícita de no enviar fotografía.

Las 4 imágenes reales están verificadas; el envío a WhatsApp real **no se ha probado con un mensaje saliente real**. El proveedor puede devolver un error HTTP o restringir una URL y el sistema lo registra para diagnóstico; no afirmar entrega sin confirmación de Graph. Uso reservado a los dos números de laboratorio autorizados.

## Pendiente para ampliar a más productos

Incorporar fotos verificadas para laptops, Epson, accesorios y otras marcas; cada nueva fotografía debe vincularse a SKU y fuente de confianza dentro del espacio de trabajo. Idealmente conectar la exportación de imágenes de STECH/sitio web y proveedores oficiales con una revisión y caducidad, evitando URLs arbitrarias y fotografías de variantes diferentes. No inferir disponibilidad ni color del fabricante por la foto. 

PR #1 continúa en estado draft; no hay nuevos pedidos, pagos, cotizaciones ni comunicaciones a clientes durante estas pruebas.
