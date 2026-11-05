# Análisis de costos y precios, Estados Unidos (USD)

Estado: estimado para decidir. Generado con `local-utils/gen-cost-analysis-us.js`. Para México ver `analisis-costos-y-precios.md`.
Fecha: 2026-10-29. Moneda: dólares (USD). Los precios son los **estimados** que hoy están en Stripe; todavía no son finales.

## 1. Precios en Stripe (estimados)

| Plan | Mensual | Anual | Equivale al mes | Descuento anual |
|---|---|---|---|---|
| Starter | US$29 | US$228 | US$19.00 | 34 % |
| Pro | US$79 | US$708 | US$59.00 | 25 % |

Observaciones:

- El producto **Pro Anual Dlls** tiene además un precio de US$1,600 **por mes**. Parece un error (20 veces el mensual de Pro). Hay que archivarlo en Stripe si no es intencional.
- Plus se añade también en Estados Unidos (decisión D6): mensual solamente, precio por confirmar. Ver la sección 3b. Los nombres en Stripe hoy son Starter y Pro; falta crear el precio de Plus.
- No hay cobro único de implementación definido para Estados Unidos; este análisis no lo incluye.
- Las cuotas de conversaciones por plan no están definidas para Estados Unidos. Supuesto: Starter 250 y Pro 1,200, iguales a Start y Pro de México.

## 2. Supuestos

| Supuesto | Valor | Nota |
|---|---|---|
| Impuestos | Sin impuesto de ventas | Se asume que los precios no lo incluyen. El impuesto de ventas a software por suscripción depende del estado; consulta a un contador. |
| Comisión de pago (Stripe Estados Unidos) | 2.9 % + US$0.30 por cobro | Cifra de terceros; verificar. El plan anual paga la comisión una sola vez. |
| Mensaje de plantilla de Meta (Estados Unidos) | US$0.0040 | Cifra de terceros; verificar en la tarifa de Meta. Hoy el envío es por Evolution API (sin cobro por mensaje). |
| Respuestas del bot por conversación | 8 | 2,000 tokens de entrada y 200 de salida cada una |
| Consultas del CRM | Starter 50, Pro 200 | 4,000 de entrada y 500 de salida cada una |
| Conversaciones que terminan en cita | 35 % | Define cuántos recordatorios se mandan |
| Colchón por cliente | US$0.60 | Supabase, Cloudinary y Vercel |
| Mezcla de planes | 70 % Starter, 30 % Pro | Supuesto |
| Costo fijo de producción mínima | US$85.87 al mes | AWS t3.medium, disco e IP, dominios, Vercel Pro y Supabase Pro (igual que F1 de México) |

## 3. Contribución por negocio al mes

Contribución = ingreso menos comisión de pago, WhatsApp, modelo y colchón. Se muestra con toda la cuota y con uso típico (60 %).

| Plan | Cobro | Uso | WhatsApp | Gemini 2.5 Flash (modelo actual) | GPT-4o (premium) |
|---|---|---|---|---|---|
| Starter | mensual | 100 % | US$0.42 | US$24.52 (85 %) | US$12.09 (42 %) |
| Starter | mensual | 60 % | US$0.25 | US$25.61 (88 %) | US$18.16 (63 %) |
| Starter | anual | 100 % | US$0.42 | US$15.08 (79 %) | US$2.65 (14 %) |
| Starter | anual | 60 % | US$0.25 | US$16.18 (85 %) | US$8.72 (46 %) |
| Pro | mensual | 100 % | US$2.02 | US$62.74 (79 %) | US$3.59 (5 %) |
| Pro | mensual | 60 % | US$1.21 | US$67.97 (86 %) | US$32.48 (41 %) |
| Pro | anual | 100 % | US$2.02 | US$43.60 (74 %) | -US$15.55 (-26 %) |
| Pro | anual | 60 % | US$1.21 | US$48.82 (83 %) | US$13.33 (23 %) |

### 3b. Plus, precios candidatos (mensual)

Cuota supuesta: 600 conversaciones y 100 consultas del CRM al mes. Neto = precio menos comisión de pago.

| Precio | Neto | Uso | WhatsApp | Gemini 2.5 Flash (modelo actual) | GPT-4o (premium) |
|---|---|---|---|---|---|
| US$39 | US$37.57 | 100 % | US$1.01 | US$30.44 (78 %) | US$0.86 (2 %) |
| US$39 | US$37.57 | 60 % | US$0.60 | US$33.05 (85 %) | US$15.30 (39 %) |
| US$49 | US$47.28 | 100 % | US$1.01 | US$40.15 (82 %) | US$10.57 (22 %) |
| US$49 | US$47.28 | 60 % | US$0.60 | US$42.76 (87 %) | US$25.01 (51 %) |
| US$59 | US$56.99 | 100 % | US$1.01 | US$49.86 (85 %) | US$20.28 (34 %) |
| US$59 | US$56.99 | 60 % | US$0.60 | US$52.47 (89 %) | US$34.72 (59 %) |

Lectura: con Gemini 2.5 Flash todos los planes dejan margen aun usando toda la cuota.

Lectura: con Gemini 2.5 Flash todos los planes dejan margen aun usando toda la cuota. El plan anual de Starter (US$19 al mes) es el más delgado; con GPT-4o el margen se reduce mucho y el plan Pro anual pierde dinero si el cliente usa toda la cuota, así que ese modelo necesita tope.

## 4. Punto de equilibrio

Negocios necesarios para cubrir US$85.87 al mes de infraestructura, con mezcla 70 / 30.

| Cobro | Modelo | Uso | Contribución promedio | Negocios |
|---|---|---|---|---|
| mensual | Gemini 2.5 Flash (modelo actual) | 100 % | US$35.98 | 3 |
| mensual | Gemini 2.5 Flash (modelo actual) | 60 % | US$38.32 | 3 |
| mensual | GPT-4o (premium) | 100 % | US$9.54 | 10 |
| mensual | GPT-4o (premium) | 60 % | US$22.45 | 4 |
| anual | Gemini 2.5 Flash (modelo actual) | 100 % | US$23.64 | 4 |
| anual | Gemini 2.5 Flash (modelo actual) | 60 % | US$25.97 | 4 |
| anual | GPT-4o (premium) | 100 % | -US$2.81 | no alcanza |
| anual | GPT-4o (premium) | 60 % | US$10.11 | 9 |

El costo fijo se comparte con México: n8n, Evolution y la base de datos son los mismos. Los clientes de Estados Unidos ayudan a cubrir lo que ya pagas.

## 5. Pendiente

1. Elegir el precio mensual de Plus en Estados Unidos (ver 3b) y crearlo en Stripe; confirmar la cuota de conversaciones de Plus (supuesto 600).
2. Definir el cobro único de implementación para Estados Unidos.
3. Decidir si el descuento anual debe ser igual en los dos planes (hoy 34 % en Starter y 25 % en Pro).
4. Archivar el precio de US$1,600 por mes en Pro Anual Dlls si es un error.
5. Impuesto de ventas por estado y obligaciones fiscales de vender a Estados Unidos desde México: consultar a un contador.
6. Verificar la tarifa de Meta y de Stripe en sus sitios; las cifras de este documento son de terceros.
7. Los textos legales y el aviso de privacidad también deben revisarse para clientes en Estados Unidos (hoy están redactados para México).

