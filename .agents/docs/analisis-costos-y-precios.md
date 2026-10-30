# Análisis de costos, punto de equilibrio y precios

Estado: propuesta para decidir. Generado con `local-utils/gen-cost-analysis.js`; cambia los parámetros del script y vuelve a correrlo para recalcular.
Fecha: 2026-10-26. Moneda: pesos mexicanos (MXN) salvo que se indique. Tipo de cambio supuesto: **$17.80 MXN por dólar**.

En este documento, "usuario" significa un **negocio** (tenant) que paga uno de los planes. Los planes y precios salen de tu captura.

> **Alcance: solo México.** Los precios de los planes y de la implementación son para México (pesos mexicanos, IVA 16 %, Stripe México, tarifa de Meta para México). Para Estados Unidos los precios serán otros y este análisis no los cubre: cambian la moneda, los impuestos (sin IVA; impuesto de ventas según el estado), la comisión de pago, la tarifa de mensajes de Meta y el tipo de cambio. Falta definir esos precios y calcular un análisis aparte.

## 1. Resumen

- Con un modelo de pago barato y los tres planes en mezcla 60/30/10, cada negocio deja en promedio **$510 MXN al mes** de contribución, aun usando toda la cuota.
- El costo fijo de producción mínima es de **$1,528 MXN al mes** (US$85.87). El punto de equilibrio es de **3 negocios** con ese modelo.
- El modelo es lo que decide la rentabilidad: con GPT-4o, el plan Pro pierde dinero si el cliente usa toda su cuota (ver sección 5).
- Los modelos gratuitos dan el mejor margen, pero mandan datos de clientes a proveedores que pueden entrenar con ellos (ver `analisis-modelos-gratuitos.md`).
- Faltan piezas en el producto para vender estos planes tal como están escritos (sección 9).

## 2. Supuestos

| Supuesto | Valor | Nota |
|---|---|---|
| Tipo de cambio | $17.80 MXN por USD | Última cotización encontrada: marzo de 2026 |
| IVA | 16 % | Se asume que los precios de los planes **ya lo incluyen** (conservador). Si no lo incluyen, el ingreso neto sube 16 %. |
| Respuestas del bot por conversación | 8 | Una conversación son unas 8 respuestas del bot |
| Tokens por respuesta del bot | 2,000 de entrada, 200 de salida | El prompt actual incluye catálogo, FAQ, calendario y reglas |
| Consultas del CRM por plan | Start 50, Plus 100, Pro 200 | 4,000 de entrada y 500 de salida cada una |
| Conversaciones que terminan en cita | 35 % | Define cuántos recordatorios se mandan |
| Mensajes de plantilla por cita | 1.2 | Un recordatorio más 20 % de avisos (cancelación, confirmación) |
| Mensaje de plantilla de Meta (México) | US$0.0085 | Cifra de terceros; verificar en la tarifa de Meta |
| Comisión de pago (Stripe México) | 3.6 % + $3 MXN, más IVA sobre la comisión | Cifra de terceros; verificar |
| Colchón por cliente (Supabase, Cloudinary, Vercel) | $10 MXN | Costo marginal pequeño por cliente |
| Uso típico de la cuota | 60 % | El peor caso usa el 100 % |
| Mezcla de planes | 60 % Start, 30 % Plus, 10 % Pro | Para el promedio ponderado |

No incluye: impuesto sobre la renta, tu tiempo, publicidad, ni contador. Son costos reales que hay que sumar aparte.

## 3. Costos fijos mensuales

Dónde corre cada cosa hoy: la aplicación en Vercel, la base de datos en Supabase, las imágenes en Cloudinary, y n8n con Evolution API en una instancia de AWS (t3.small).

| Escenario | USD al mes | MXN al mes | Qué incluye |
|---|---|---|---|
| **F0** Primer usuario, capas gratuitas (Vercel Hobby, Supabase Free, Cloudinary Free) | US$23.68 | $422 | No cumple los términos de Vercel: Hobby no permite uso comercial. |
| **F0b** Primer usuario, cumpliendo términos (Vercel Pro, resto gratuito) | US$43.68 | $778 | Supabase Free se pausa tras 1 semana sin actividad y no es un plan para producción. |
| **F1** Producción mínima (t3.medium, Vercel Pro, Supabase Pro, Cloudinary Free) | US$85.87 | $1,528 | Punto de partida recomendado con los primeros clientes de pago. |
| **F2** Crecimiento (producción mínima + Cloudinary Plus) | US$184.87 | $3,291 | Cuando las imágenes superen los 25 créditos mensuales gratuitos. |

Detalle de precios usados:

| Concepto | USD al mes | Fuente |
|---|---|---|
| AWS t3.small (2 GiB, 2 vCPU) | US$15.18 | [Precio por hora de AWS EC2 t3.small](https://www.doit.com/compute/spot/us-east-1/t3.small): $0.0208 por hora |
| AWS t3.medium (4 GiB, 2 vCPU) | US$30.37 | [Precio por hora de AWS EC2 t3.medium](https://www.doit.com/compute/spot/us-east-1/t3.medium): $0.0416 por hora |
| Disco y dirección IP pública | US$6 a US$8 | Estimado propio; sin fuente en esta búsqueda |
| Dominios | US$2.50 | Estimado propio |
| Vercel Pro | US$20 | [Plan Pro de Vercel](https://docs.vercel.com/docs/plans/pro-plan): $20 al mes con un asiento incluido |
| Supabase Pro | US$25 | [Precios de Supabase](https://supabase.com/pricing.md) |
| Cloudinary Plus | US$99 | [Precios de Cloudinary](https://cloudinary.com/documentation/pricing.md): $99 al mes, 225 créditos |

Nota sobre tu imagen del t3.small: los adjuntos que recibí eran todos la captura de los planes, no la de costos del servidor. Los precios de arriba son los públicos de AWS en us-east-1. Si tu instancia está en otra región o tiene descuentos, dime los números y se actualizan en el script.

## 4. Primer usuario con capas gratuitas

Pregunta: si el primer cliente paga el plan Start y usamos capas gratuitas, ¿se paga la infraestructura?

| Escenario fijo | Costo fijo (MXN) | Contribución del cliente Start, LLM gratuito | Resultado mensual | Contribución con DeepSeek | Resultado mensual |
|---|---|---|---|---|---|
| F0 | $422 | $380 | -$42 | $359 | -$63 |
| F0b | $778 | $380 | -$398 | $359 | -$419 |

Lectura: un solo cliente del plan Start casi cubre la infraestructura mínima (F0), pero no la de producción mínima (F1). Con capas gratuitas, el riesgo no es el costo sino la fiabilidad y los términos:

- **Vercel Hobby no permite uso comercial.** En cuanto cobres, el plan correcto es Pro ($20 al mes). Fuente: [Plan Pro de Vercel](https://docs.vercel.com/docs/plans/pro-plan).
- **Supabase Free pausa el proyecto tras una semana sin actividad** y tiene 500 MB de base de datos. Un negocio con pocas conversaciones podría quedarse sin servicio. Fuente: [Precios de Supabase](https://supabase.com/pricing.md).
- **Cloudinary Free** da 25 créditos al mes. Alcanza para los primeros clientes. Fuente: [Precios de Cloudinary](https://cloudinary.com/documentation/pricing.md).
- **n8n y Evolution API** son gratuitos para instalar, pero corren en tu servidor y comparten un solo punto de falla.

## 5. Economía por plan (por negocio al mes)

### 5.1 Costo del modelo por plan, en MXN, usando toda la cuota

| Plan | Conversaciones | Respuestas del bot | Gratuito | DeepSeek v3.1 (pago barato) | GPT-4o (pago premium) |
|---|---|---|---|---|---|
| Start | 250 | 2000 | $0 | $21 | $263 |
| Plus | 600 | 4800 | $0 | $50 | $625 |
| Pro | 1200 | 9600 | $0 | $100 | $1,250 |

### 5.2 Contribución por negocio, usando toda la cuota (peor caso)

Contribución = ingreso neto sin IVA, menos comisión de pago, menos mensajes de WhatsApp (Meta), menos costo del modelo, menos colchón.

| Plan | Precio | Ingreso neto | Comisión de pago | WhatsApp (Meta) | Contribución, Gratuito | Contribución, DeepSeek v3.1 (pago barato) | Contribución, GPT-4o (pago premium) |
|---|---|---|---|---|---|---|---|
| Start | $499 | $430 | $24 | $16 | $380 (88 %) | $359 (83 %) | $117 (27 %) |
| Plus | $899 | $775 | $41 | $38 | $686 (88 %) | $636 (82 %) | $61 (8 %) |
| Pro | $1,499 | $1,292 | $66 | $76 | $1,140 (88 %) | $1,040 (80 %) | -$110 (-8 %) |

### 5.3 Contribución por negocio, con uso típico (60 % de la cuota)

| Plan | Contribución, Gratuito | Contribución, DeepSeek v3.1 (pago barato) | Contribución, GPT-4o (pago premium) |
|---|---|---|---|
| Start | $386 (90 %) | $374 (87 %) | $229 (53 %) |
| Plus | $701 (90 %) | $671 (87 %) | $326 (42 %) |
| Pro | $1,170 (91 %) | $1,110 (86 %) | $421 (33 %) |

Lectura:

- Con un modelo de pago barato, los tres planes tienen margen sano aun usando toda la cuota.
- Con GPT-4o, el plan Pro **pierde $110 MXN al mes por cliente** si el cliente usa toda su cuota. El modelo premium no es compatible con estos precios sin límites.
- Una conversación de 8 respuestas cuesta $0.08 MXN con DeepSeek y $1.00 MXN con GPT-4o.
- Reducir los tokens del prompt (hoy unos 2,000 por respuesta, porque cada mensaje reenvía catálogo, FAQ y calendario) baja el costo del modelo de forma directa.

## 6. Punto de equilibrio (cuántos negocios necesitas)

Promedio ponderado con mezcla 60 % Start, 30 % Plus, 10 % Pro.

| Escenario | Costo fijo (MXN) | Modelo | Uso | Contribución promedio por negocio | Negocios para el punto de equilibrio |
|---|---|---|---|---|---|
| F0 | $422 | Gratuito | 100 % | $548 | 1 |
| F0 | $422 | Gratuito | 60 % | $559 | 1 |
| F0 | $422 | DeepSeek v3.1 (pago barato) | 100 % | $510 | 1 |
| F0 | $422 | DeepSeek v3.1 (pago barato) | 60 % | $537 | 1 |
| F0 | $422 | GPT-4o (pago premium) | 100 % | $78 | 6 |
| F0 | $422 | GPT-4o (pago premium) | 60 % | $277 | 2 |
| F0b | $778 | Gratuito | 100 % | $548 | 2 |
| F0b | $778 | Gratuito | 60 % | $559 | 2 |
| F0b | $778 | DeepSeek v3.1 (pago barato) | 100 % | $510 | 2 |
| F0b | $778 | DeepSeek v3.1 (pago barato) | 60 % | $537 | 2 |
| F0b | $778 | GPT-4o (pago premium) | 100 % | $78 | 10 |
| F0b | $778 | GPT-4o (pago premium) | 60 % | $277 | 3 |
| F1 | $1,528 | Gratuito | 100 % | $548 | 3 |
| F1 | $1,528 | Gratuito | 60 % | $559 | 3 |
| F1 | $1,528 | DeepSeek v3.1 (pago barato) | 100 % | $510 | 3 |
| F1 | $1,528 | DeepSeek v3.1 (pago barato) | 60 % | $537 | 3 |
| F1 | $1,528 | GPT-4o (pago premium) | 100 % | $78 | 20 |
| F1 | $1,528 | GPT-4o (pago premium) | 60 % | $277 | 6 |
| F2 | $3,291 | Gratuito | 100 % | $548 | 7 |
| F2 | $3,291 | Gratuito | 60 % | $559 | 6 |
| F2 | $3,291 | DeepSeek v3.1 (pago barato) | 100 % | $510 | 7 |
| F2 | $3,291 | DeepSeek v3.1 (pago barato) | 60 % | $537 | 7 |
| F2 | $3,291 | GPT-4o (pago premium) | 100 % | $78 | 43 |
| F2 | $3,291 | GPT-4o (pago premium) | 60 % | $277 | 12 |

Nota: el promedio supone la mezcla 60/30/10. Con pocos clientes la mezcla real manda: con un solo cliente del plan Start hacen falta 2 negocios para cubrir F0 y 5 para F1, no 1 y 3.

Lectura: con producción mínima (F1) y un modelo de pago barato, bastan **3** negocios para cubrir la infraestructura. Todo lo que sigue es margen, antes de impuesto sobre la renta y de tu tiempo.

## 7. Cuánto podemos cobrar

Precio mínimo por plan para que la contribución sea cero, y para que sea el 60 % del ingreso neto, usando DeepSeek y toda la cuota.

| Plan | Precio actual | Precio de equilibrio | Precio para 60 % de margen | Veredicto |
|---|---|---|---|---|
| Start | $499 | $61 | $166 | Los precios actuales superan el 60 % de margen |
| Plus | $899 | $124 | $335 | Los precios actuales superan el 60 % de margen |
| Pro | $1,499 | $231 | $626 | Los precios actuales superan el 60 % de margen |

Lectura: con un modelo barato, los precios actuales tienen margen de sobra. El riesgo no es cobrar poco, sino el modelo caro y las conversaciones sin límite. Opciones para proteger el margen:

1. **Tope por conversación:** limitar tokens por respuesta y por conversación.
2. **Cobro por excedente:** cobrar las conversaciones extra. Costo real: $0.08 MXN por conversación con DeepSeek. Cobrar $1.50 MXN por conversación extra deja un margen amplio.
3. **Modelo por plan:** modelo barato para Start y Plus; modelo mejor solo en Pro y con tope.

### Si bajaras los precios

Contribución con DeepSeek y toda la cuota, y cuántos negocios del mismo plan cubren producción mínima (F1).

| Plan | Precio | Contribución | Margen | Negocios de este plan para cubrir F1 |
|---|---|---|---|---|
| Start | $299 | $195 | 76 % | 8 |
| Start | $399 | $277 | 81 % | 6 |
| Start | $499 | $359 | 83 % | 5 |
| Plus | $599 | $390 | 75 % | 4 |
| Plus | $749 | $513 | 79 % | 3 |
| Plus | $899 | $636 | 82 % | 3 |
| Pro | $999 | $630 | 73 % | 3 |
| Pro | $1,249 | $835 | 78 % | 2 |
| Pro | $1,499 | $1,040 | 80 % | 2 |

### Costo fijo por negocio, según cuántos negocios tengas

| Negocios | Costo fijo F1 por negocio | Costo fijo F2 por negocio |
|---|---|---|
| 3 | $509 | $1,097 |
| 5 | $306 | $658 |
| 10 | $153 | $329 |
| 25 | $61 | $132 |
| 50 | $31 | $66 |

El costo fijo por negocio baja rápido. Con 10 negocios, la infraestructura mínima pesa cerca del 31 % del precio del plan Start; con 25, cerca del 12 %; con 50, cerca del 6 %. Lo que no baja con la escala es el costo del modelo y de WhatsApp, que son por uso.

## 8. Costo único de implementación

Precios definidos por ti (pago único, neto: se interpreta sin IVA, el IVA se suma encima). Antes se pensaba en $500 MXN como máximo; los precios nuevos son varias veces mayores.

| Plan | Cobro neto | Con IVA | Comisión de pago | Horas supuestas | Costo de tu tiempo | Utilidad de la implementación |
|---|---|---|---|---|---|---|
| Start | $2,500 | $2,900 | -$125 | 2 | -$500 | $1,875 |
| Plus | $5,500 | $6,380 | -$270 | 5 | -$1,250 | $3,980 |
| Pro | $9,500 | $11,020 | -$464 | 8 | -$2,000 | $7,036 |

Horas y tarifa son supuestos (2, 5 y 8 horas a $250 MXN por hora; ajústalos). Start incluye conectar WhatsApp, cargar catálogo y preguntas frecuentes, y conectar Google Calendar. Plus agrega confirmaciones, lista de espera y reportes; Pro agrega CRM, campañas, canales de Facebook e Instagram e importación de contactos, que es lo más largo de preparar.

Con estos montos, la implementación sí genera utilidad y ya no es solo un filtro de clientes. Un solo cliente Start deja $1,875 de utilidad de arranque. Riesgo comercial: Start pasa de $499 al mes a unos $3,399 el primer mes ($2,900 de alta con IVA más la mensualidad), una barrera de entrada fuerte para un negocio pequeño. Una opción es repartir la implementación en 2 o 3 pagos o dar la prueba de 14 días antes de cobrarla.

Costos únicos de la empresa, una sola vez (estimados, sin fuente):

| Concepto | MXN | Nota |
|---|---|---|
| Migración de t3.small a t3.medium | tu tiempo | Sin costo directo en AWS más allá del mes de traslape |
| Verificación de negocio en Meta | $0 | Sin costo para el negocio; lleva tiempo |
| Aviso de privacidad y términos revisados por un abogado | $3,000 a $8,000 | Estimado propio; necesario por datos personales y de salud |
| Dominios | $250 a $700 al año | Estimado propio |

## 9. Lo que falta (revisión a fondo)

**A. Lo que los planes prometen y el producto no tiene todavía**

| Promesa del plan | Estado en el código |
|---|---|
| Conversaciones al mes por plan (250, 600, 1,200) | No existe contador de conversaciones ni límite por plan. Hoy el límite es en **dólares de crédito de IA** ($15 USD en Starter), no en conversaciones. |
| Nombres Start, Plus, Pro | En el código los planes son STARTER, PRO y ENTERPRISE. Hay que alinear nombres, precios de Stripe y límites. |
| Reprogramación y lista de espera | La reprogramación existe. **La lista de espera no existe.** |
| Estados y reportes de asistencia | Existen estados de cita. **No hay reportes de asistencia.** |
| Confirmaciones de asistencia | Existen (recordatorios y confirmación por WhatsApp). |
| 1, 2 y 3 usuarios por plan | No verifiqué que haya límite de usuarios por plan. |
| Importación inicial de 500 contactos | No encontré un importador de contactos. |
| CRM de seguimiento, campañas y métricas | Existen campañas sociales; "CRM de seguimiento" no está definido todavía. |
| Español e inglés | Existe (idioma de los mensajes al cliente). |
| Un recordatorio por cita incluido | El producto hoy **cobra cada recordatorio aparte** ($0.0085 USD). Si el plan lo incluye, hay que dejar de cobrarlo y absorber el costo de Meta. |

**B. Riesgos de infraestructura y licencias**

1. **Evolution API con código QR (la modalidad actual) no es la conexión oficial de Meta.** Funciona como un WhatsApp Web; tiene riesgo de bloqueo del número. Es gratis, pero un bloqueo deja al negocio sin servicio. Migrar a la API oficial de Meta resuelve eso a cambio de cobros por mensaje y de aprobar plantillas.
2. **n8n y la licencia.** La licencia Sustainable Use cubre el uso interno. Para un servicio multi-negocio hay lecturas distintas, y un producto que incluye n8n puede requerir una licencia comercial. Revisar el texto de la licencia y pedir confirmación escrita a n8n. Fuente: [comentarios sobre la licencia](https://www.activepieces.com/blog/n8n-license-fair-code-community-enterprise-2026), no es el texto oficial.
3. **Un solo servidor.** n8n y Evolution comparten una instancia. Si cae, cae el bot de todos los negocios. Una instancia t3.medium da más memoria (4 GiB contra 2 GiB), pero sigue siendo un punto único de falla.
4. **Respaldos.** Supabase Free no es una base pensada para producción. Confirma en la página de Supabase qué respaldos incluye cada plan y si la recuperación a un punto en el tiempo es un complemento aparte; yo no lo verifiqué.
5. **Exposición cambiaria.** Los costos (AWS, Supabase, Vercel, Meta, modelos) están en dólares y los planes en pesos. Si el dólar sube 10 %, los costos suben 10 % y el precio no.

**C. Costos y trámites que no están en las tablas**

1. **Facturación (CFDI).** Si tus clientes piden factura, necesitas emitirla. Revisa el costo de un proveedor de facturación.
2. **Impuestos.** El impuesto sobre la renta depende de tu régimen; consulta a un contador.
3. **Costo de adquirir clientes** y **prueba gratis de 14 días:** cada cliente de prueba consume modelo y WhatsApp sin pagar.
4. **Cuota de OpenRouter:** puede cobrar una comisión al comprar créditos. No lo verifiqué; revisa en su sitio.
5. **Soporte y atención:** tu tiempo atendiendo clientes no está en la contribución.
6. **Cada negocio necesita su propio número de WhatsApp Business.** Con la API oficial hay que verificar el negocio y conectar el número; eso toma tiempo por cliente.
7. **Definición de "conversación".** Hay que definirla (por ejemplo, ventana de 24 horas por cliente) y que el contador coincida con la forma en que Meta cobra, para no cobrar de más ni de menos.

**D. Datos sensibles**

Las notas clínicas y el triage son datos de salud. Revisa `analisis-modelos-gratuitos.md` antes de decidir el modelo para esos flujos, y valida la postura legal.

## 10. Recomendación

1. **Modelo:** usar un modelo de pago barato (DeepSeek, Qwen o Gemini Flash) para Start y Plus. Probar calidad con conversaciones reales antes de fijarlo. GPT-4o o Sonnet solo con tope por cliente.
2. **Infraestructura:** pasar a producción mínima (F1) en cuanto haya el primer cliente de pago: Vercel Pro, Supabase Pro y t3.medium.
3. **Precios:** los planes actuales dejan margen amplio con un modelo barato. No hace falta subirlos; hace falta protegerlos con límites.
4. **Implementación:** $2,500, $5,500 y $9,500 MXN netos (Start, Plus, Pro) cubren el trabajo de arranque con utilidad. Vigila la barrera de entrada en Start y define qué incluye cada alta para no regalar horas.
5. **Producto:** antes de vender los planes tal como están escritos, construir el contador de conversaciones y los límites por plan, y decidir qué pasa con lo que aún no existe (lista de espera, reportes de asistencia, importación de contactos).
6. **Mensajería:** decidir cuándo pasar de Evolution a la API oficial de Meta, y decidir con n8n cómo cubrir la licencia.

## 11. Fuentes

- [AWS EC2 t3.small en us-east-1](https://www.doit.com/compute/spot/us-east-1/t3.small)
- [AWS EC2 t3.medium en us-east-1](https://www.doit.com/compute/spot/us-east-1/t3.medium)
- [Precios de la plataforma de WhatsApp Business (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [Precio de la API de WhatsApp en México 2026](https://www.aurorainbox.com/en/2026/05/26/price-whatsapp-business-api-mexico-2026/)
- [Tarifas de WhatsApp Business por país (Kanal)](https://getkanal.com/blog/whatsapp-business-pricing-guide)
- [Comisiones de Stripe México](https://www.guiadesoftware.com/blog/mejor-pasarela-pago-mexico)
- [Impuestos sobre las comisiones de Stripe en México](https://support.stripe.com/questions/taxes-on-stripe-fees-for-mexico-based-businesses)
- [Precios de Supabase](https://supabase.com/pricing.md)
- [Plan Pro de Vercel](https://docs.vercel.com/docs/plans/pro-plan)
- [Precios de Cloudinary](https://cloudinary.com/documentation/pricing.md)
- [Licencia de n8n explicada (SSD Nodes)](https://www.ssdnodes.com/learn/n8n-sustainable-use-license-explained)

Las cifras de terceros no coinciden en todo. Verifica la tarifa vigente en la página oficial de cada proveedor antes de fijar precios.
