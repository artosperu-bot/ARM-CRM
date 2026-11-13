# ALEX — catálogo provisional para laboratorio privado (12/11/2026)

Esta etapa usa **Supabase exclusivamente**. Los importes se recuperaron de `arm_offer_simulations` existente y las cantidades son supuestos propuestos para las pruebas, no un conteo físico.

| SKU | Precio piloto S/ | Unidades supuestas | Estado piloto |
|---|---:|---:|---|
| ARMOR-22-256G | 999.00 | 8 | disponible |
| ARMOR-25TPro-256GB | 1799.00 | 3 | disponible |
| ARMOR-X12Pro | 659.00 | 0 | no disponible |
| ARMOR-X13 | 799.00 | 5 | disponible |

## Reglas
- Solo `arm_offer_simulations.is_test_data=true`; cantidades en `stock_units_demo` con restricción 0 a 10000. Sin permiso implícito para publicar o convertir a real.
- El chat privado de ALEX inicia con simulación seleccionada; existe control visible para desactivarla. El texto simulado se etiqueta inequívocamente como prueba.
- Si la cantidad solicitada supera la cantidad supuesta, el estado de prueba es `no disponible`; se pueden sugerir alternativas del catálogo según necesidades y ficha verificable.
- Se calcula una estimación aritmética interna solo para un producto identificado y cantidad conocida, sin dar por confirmadas tarifas, impuesto final ni envío. **No es cotización emitida.**
- Ninguna estimación crea un pedido, pago, reserva real, asignación humana, seguimiento ni mensaje saliente.
- El motor de ventas real solo lee `arm_commercial_reviews` y `arm_stock_snapshot`; no toma precios ni unidades de la tabla de prueba.
- Los números de prueba de WhatsApp y las restricciones de salida permanecen sin ampliar.

## Pendiente
- Probar más conversaciones humanas con errores tipográficos, varias referencias y cambios de cantidad.
- Implementar un cotizador de simulación separado antes del cotizador real.
- Tras validar los precios y cantidades definitivos, aprobarlos mediante las operaciones de inventario/precio en Supabase, **no copiando automáticamente estos datos de prueba a tablas reales**.
