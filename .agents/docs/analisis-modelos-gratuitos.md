# Análisis: dónde usar modelos gratuitos y dónde no

Estado: propuesta para decidir. No cambia código.
Fecha: 2026-10-26.

## 1. Qué hay hoy (hechos verificados en el repo)

| Flujo | Modelo | Datos que recibe el modelo | Tipo de dato |
|---|---|---|---|
| Newy AI en el CRM (`POST /api/chat`) | Cascada `OPENROUTER_MODELS`: 3 gratuitos (nemotron, gemma, `openrouter/free`), luego Claude Sonnet y GPT-4o de pago | Contexto del negocio, resultados de herramientas. `get_orders_by_status` devuelve nombre del cliente o su correo. `get_top_customers` devuelve nombre y gasto. Desde hoy, `get_appointments` ya no manda correos ni notas clínicas. | Datos personales de clientes |
| Bot de WhatsApp (workflow de chat, n8n) | Primario `nvidia/nemotron-3.5-lightning:free`, respaldo `google/gemma-4-31b-it:free` | Mensajes de los clientes, nombre, correo al agendar, teléfono en las herramientas, citas | Datos personales y conversaciones |
| Campañas sociales (workflow social) | `google/gemini-2.0-flash-exp:free` con respaldos gratuitos | Datos del negocio y del producto para escribir el texto | Sin datos personales |
| Triage de pacientes (workflow triage) | OpenAI (`lmChatOpenAi`), contrato directo | Alergias, medicamentos, historial médico, edad, peso | Datos de salud |
| Recordatorios | Ninguno (sin LLM) | Solo plantillas | No aplica |

Hallazgo: el bot de WhatsApp ya manda datos personales de clientes a modelos gratuitos. Eso ocurre hoy, sin decisión explícita sobre ello.

## 2. Qué dice el proveedor (OpenRouter)

- Cada proveedor de modelo fija su propia política de entrenamiento y retención. OpenRouter la muestra en cada endpoint.
- La cuenta permite excluir proveedores que entrenan con los datos, con ajustes separados para modelos gratuitos y de pago. Ese ajuste no cambia cómo OpenRouter maneja los prompts.
- Un análisis de terceros (TrueFoundry, no verificado contra los términos actuales) reporta que, de 19 modelos gratuitos revisados, 9 están en proveedores que pueden entrenar, 6 retienen sin entrenar y 4 tienen retención cero. Cuando OpenRouter no puede establecer la política, marca el endpoint como de entrenamiento y retención.
- Conclusión: "gratuito" no dice nada sobre privacidad. Hay que mirar la política de cada endpoint.

Fuentes:
- [OpenRouter: privacidad y registro de los proveedores](https://openrouter.ai/docs/guides/privacy/provider-logging)
- [OpenRouter: privacidad y registro](https://openrouter.ai/docs/features/privacy-and-logging)
- [TrueFoundry: modelos gratuitos de OpenRouter](https://www.truefoundry.com/blog/openrouter-free-models-whats-actually-free-and-what-it-costs-you)

## 3. Clases de dato y política propuesta

| Clase | Ejemplos | Modelo gratuito | Modelo de pago | Sin LLM |
|---|---|---|---|---|
| A. Información pública del negocio | Catálogo, precios, horario, FAQ, campañas | Permitido | Permitido | No necesario |
| B. Datos personales de clientes | Nombre, correo, teléfono, mensajes, citas | Solo endpoints sin entrenamiento y con retención aceptable | Preferido, con términos de no entrenamiento | Para cálculos (conteos, fechas) |
| C. Datos de salud | Notas clínicas, triage (alergias, medicamentos, historial) | No | Sí, con contrato y política de no entrenamiento | Preferido para resúmenes simples |

Notas:
- La clase C es dato de salud. En México la ley lo trata como dato sensible. Conviene validar la postura legal con asesoría antes de activar notas clínicas en el chat.
- Minimizar antes de enviar: en la clase B, reemplazar nombres y correos por identificadores internos cuando el modelo no los necesita. Por ejemplo, para contar citas no hace falta el nombre.

## 4. Recomendaciones por flujo

1. **Newy AI (CRM):**
   - Clase A y conteos: cascada actual está bien, con el ajuste de excluir proveedores que entrenan.
   - Con notas clínicas (clase C): cascada separada solo de pago, y que la herramienta de notas lo marque antes de mostrarlas.
   - Quitar correos de `get_orders_by_status` y `get_top_customers`, o reemplazarlos por identificadores.
2. **Bot de WhatsApp:**
   - Decidir si los mensajes de clientes (clase B) siguen en modelos gratuitos. Mi recomendación: primario de pago para conversaciones con datos de clientes, y gratuito solo para saludos y respuestas de clase A.
   - Hoy el saludo y la confirmación ya no llaman al modelo (se resuelven en el servidor), así que el volumen gratuito baja.
3. **Campañas sociales:** gratuitos están bien (clase A).
4. **Triage:** revisar el contrato con OpenAI y su política de retención. Es el flujo de salud más sensible que ya existe.
5. **Cuenta de OpenRouter:** activar la exclusión de proveedores que entrenan, para todos los modelos. Es el cambio más barato.

## 5. Implementación propuesta (cuando se decida)

- Cada llamada declara su clase de dato (A, B o C).
- Variables separadas: `OPENROUTER_MODELS` (A), `OPENROUTER_MODELS_PERSONAL` (B, de pago o endpoints verificados), `OPENROUTER_MODELS_HEALTH` (C, de pago).
- Una herramienta que toca datos de clase C registra en el log que la usó, sin guardar el contenido.

## 6. Preguntas abiertas

1. ¿Qué endpoints gratuitos tienen retención cero o no entrenan? Hay que revisarlos en OpenRouter antes de elegir.
2. ¿Los modelos de pago (Claude, GPT-4o) se usan por OpenRouter con qué política de retención? Hay que confirmarlo en su endpoint.
3. ¿Quieres que la herramienta de notas clínicas exista en el chat, o que el chat solo dé conteos de notas?
4. ¿Se valida la postura legal sobre datos de salud antes de activar la clase C?

## 7. Anexo: comparativa de modelos de pago y costo por mes

### 7.1 Precios usados (USD por millón de tokens, entrada / salida)

| Modelo | Entrada | Salida | Fuente |
|---|---|---|---|
| Claude Sonnet 4.5 (respaldo de pago) | 3.00 | 15.00 | Precio del proyecto (CLAUDE.md), confirmado por trackers |
| GPT-4o (respaldo de pago) | 2.50 | 10.00 | Precio del proyecto (CLAUDE.md); no apareció en OpenRouter en la búsqueda |
| Gemini 2.5 Flash | 0.30 | 2.50 | Tracker de precios (una fuente) |
| DeepSeek Chat v3.1 | 0.20 | 0.80 | Tracker de precios (una fuente) |
| Qwen3 14B (OpenRouter) | 0.12 | 0.24 | Tracker de OpenRouter (octubre 2026) |
| Qwen3 VL 32B (OpenRouter) | 0.10 | 0.42 | Tracker de OpenRouter (septiembre 2026) |
| Qwen3.6 Flash (Alibaba, directo) | 0.188 | 1.13 | PricePerToken (julio 2026); precio directo, no OpenRouter |

### 7.2 Costo por llamada

Supuestos: mensaje del bot = 2,000 tokens de entrada y 200 de salida. Consulta del CRM = 4,000 y 500. Post de campaña = 1,500 y 300.

| Modelo | Bot (por mensaje) | CRM (por consulta) | Campaña (por post) |
|---|---|---|---|
| Claude Sonnet 4.5 | $0.00900 | $0.01950 | $0.00900 |
| GPT-4o | $0.00700 | $0.01500 | $0.00675 |
| Gemini 2.5 Flash | $0.00110 | $0.00245 | $0.00120 |
| DeepSeek Chat v3.1 | $0.00056 | $0.00120 | $0.00054 |
| Qwen3 14B | $0.00029 | $0.00060 | $0.00025 |
| Qwen3 VL 32B | $0.00028 | $0.00061 | $0.00028 |
| Qwen3.6 Flash | $0.00060 | $0.00132 | $0.00062 |

### 7.3 Costo por negocio al mes

Escenario de referencia: 500 mensajes del bot, 100 consultas del CRM y 30 posts de campaña al mes. Sirve para escalar: el costo es lineal.

| Modelo | Bot | CRM | Campaña | Total real | Cobrado al negocio* | Margen |
|---|---|---|---|---|---|---|
| Claude Sonnet 4.5 | $4.50 | $1.95 | $0.27 | $6.72 | $6.72 | $0.00 |
| GPT-4o | $3.50 | $1.50 | $0.20 | $5.20 | $6.72 | $1.52 |
| Gemini 2.5 Flash | $0.55 | $0.24 | $0.04 | $0.83 | $6.72 | $5.89 |
| DeepSeek Chat v3.1 | $0.28 | $0.12 | $0.02 | $0.42 | $6.72 | $6.30 |
| Qwen3.6 Flash | $0.30 | $0.13 | $0.02 | $0.45 | $6.72 | $6.27 |
| Qwen3 14B | $0.14 | $0.06 | $0.01 | $0.21 | $6.72 | $6.51 |
| Gratuito (cualquier modelo) | $0.00 | $0.00 | $0.00 | $0.00 | $6.72 | $6.72 |

\* Según CLAUDE.md, el consumo se cobra al negocio con la tarifa fija de $3 / $15 por millón, sin importar el modelo. Con este uso, el negocio gasta unos $6.72 de sus $15 de Starter al mes (cerca del 45%).

### 7.4 Lectura

- Con Sonnet, el margen es cero: lo que cobramos es lo que pagamos. Con GPT-4o queda un margen pequeño.
- Un modelo de pago barato (Qwen, DeepSeek o Gemini Flash) deja un margen de unos $6 por negocio al mes, con este uso.
- Si el negocio usa más de lo que se incluye, el costo crece linealmente. Sigue siendo muy inferior al cobro.
- **Clase C (salud):** el costo no es el problema, sino el contrato y la política. Un modelo barato sin contrato sigue siendo mala opción para notas clínicas.
- Las cifras son aproximadas. Las fuentes no coinciden en algunos precios, y OpenRouter puede variar por proveedor. Confirmar en [openrouter.ai/models](https://openrouter.ai/models) antes de fijar precios.

Fuentes de precios:
- [Claude Sonnet 4.5 en cloudprice](https://cloudprice.net/models/openrouter/anthropic/claude-sonnet-4.5)
- [Claude Sonnet 4.5 en PricePerToken](https://pricepertoken.com/pricing-page/model/anthropic-claude-sonnet-4.5)
- [Calculadora de OpenRouter (FutureAGI)](https://futureagi.com/llm-cost-calculator/openrouter)
- [Qwen3 14B en AnotherWrapper](https://anotherwrapper.com/llm-pricing/qwen3-14b)
- [Qwen3 VL 32B en AnotherWrapper](https://anotherwrapper.com/llm-pricing/qwen3-vl-32b-instruct)
- [Precios de Qwen 2026 (eesel)](https://www.eesel.ai/es/blog/precios-qwen)
- [Qwen3.6 Flash en PricePerToken](https://pricepertoken.com/pricing-page/model/qwen-qwen3.6-flash)
- [OpenRouter: privacidad y registro de los proveedores](https://openrouter.ai/docs/guides/privacy/provider-logging)

### 7.5 Versión en pesos mexicanos (MXN)

Tipo de cambio: **$17.80 MXN por dólar** (supuesto). La búsqueda solo encontró cotizaciones de marzo de 2026 (alrededor de 17.80); conviene confirmar el tipo de cambio de hoy en [Banxico](https://www.banxico.org.mx/) antes de fijar precios.

| Modelo | Entrada (MXN por 1M tokens) | Salida (MXN por 1M tokens) | Bot por mensaje | CRM por consulta | Campaña por post | Costo real al mes por negocio | Margen al mes si cobramos $119.62 MXN |
|---|---|---|---|---|---|---|---|
| Claude Sonnet 4.5 | $53.40 | $267.00 | $0.160 | $0.347 | $0.160 | $119.62 | $0.00 |
| GPT-4o | $44.50 | $178.00 | $0.125 | $0.267 | $0.120 | $92.56 | $27.06 |
| Gemini 2.5 Flash | $5.34 | $44.50 | $0.020 | $0.044 | $0.021 | $14.77 | $104.85 |
| DeepSeek Chat v3.1 | $3.56 | $14.24 | $0.010 | $0.021 | $0.010 | $7.48 | $112.14 |
| Qwen3.6 Flash (Alibaba) | $3.35 | $20.11 | $0.011 | $0.023 | $0.011 | $8.01 | $111.61 |
| Qwen3 14B | $2.14 | $4.27 | $0.005 | $0.011 | $0.004 | $3.74 | $115.88 |

Notas:
- Los costos por mensaje son fracciones de centavo; por eso se muestran con tres decimales.
- El cobro al negocio es de $6.72 USD al mes, equivalente a **$119.62 MXN** con el tipo de cambio supuesto. Es el mismo cobro para todos los modelos, porque se cobra a tarifa fija por token.
- Si el tipo de cambio cambia, todo el costo y el margen en pesos cambian en la misma proporción.

## 8. Decisión (2026-10-29)

- Los datos de clientes (bot de WhatsApp y Newy AI) pasan a **modelos de pago**. Modelo principal: **Gemini 2.5 Flash** (`google/gemini-2.5-flash`), respaldo `openai/gpt-4o-mini` en el bot.
- Se pide a OpenRouter excluir a los proveedores que almacenan o pueden entrenar con los datos (`provider.data_collection: "deny"`), y opcionalmente retención cero (`OPENROUTER_REQUIRE_ZDR`). En la cuenta de OpenRouter hay que activar la misma exclusión para cubrir a n8n.
- Los modelos gratuitos quedan para contenido sin datos personales (campañas sociales).
- Pendiente de esta decisión: la lista `OPENROUTER_MODELS` de Vercel, la verificación de la política de entrenamiento del endpoint elegido, la prueba de calidad con conversaciones reales, y el contrato del triage con OpenAI.
