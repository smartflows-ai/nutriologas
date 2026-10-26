# Documentación Técnica: Bot de WhatsApp con IA (n8n)

> **Archivo del flujo**: `n8n/workflows/n8n-chat-workflow-v2.json` ("NewAigent - WhatsApp Bot (Chat)")
> **Recordatorios**: `n8n/workflows/n8n-reminders-workflow.json` (flujo separado, sin LLM)
> **Versión de n8n probada**: 2.8.3 (self-hosted)

---

## 1. Principios

1. **API-first**: n8n no ejecuta SQL. Toda lectura y escritura pasa por `https://www.newaigent.com/api/internal/bot/*` con el header `x-internal-key`.
2. **Tenant desde la instancia**: el tenant se resuelve con el nombre de la instancia de Evolution que recibió el mensaje. El modelo nunca decide el tenant.
3. **El modelo no es fuente de verdad**: el backend valida horarios, conflictos, precios y propiedad de las citas. El modelo solo redacta y llama herramientas.
4. **Recordatorios fuera del LLM**: el envío de recordatorios es determinista y vive en su propio flujo.

---

## 2. Mapa de nodos (bot)

```mermaid
graph TD
    W[Webhook POST /:tenantSlug] --> G1{Guard: messages.upsert y fromMe = false}
    G1 -->|fromMe = true| GO{Guard: mensaje del dueño}
    GO --> SO[Store Owner Message / sync: pausa el bot]
    G1 --> X[Extract Message]
    X --> G2{Guard: texto y teléfono}
    G2 --> WC[Write Customer Message / sync]
    G2 --> CS[Get Contact Status / POST bot/contact-status]
    CS --> GB{Guard: bot activo}
    GB --> CTX[Get Bot Context / POST bot/context]
    CTX --> GC{Guard: Credits OK}
    GC -->|creditExhausted| WBC[Write Bot Message: Credits Exhausted]
    WBC --> SRC[Send Reply: Credits Exhausted]
    GC --> AG[Bot Agent / OpenRouter + memoria + herramientas]
    AG --> CR[Clean Reply / quita saludos repetidos]
    AG --> CU[Collect Token Usage]
    AG -->|error: toda la cascada falló| WBF[Write Bot Message: Bot Failure]
    AG -->|error| AOF[Alert Owner: Bot Failure / POST bot/alert-failure]
    WBF --> SRF[Send Reply: Bot Failure]
    CR --> WB[Write Bot Message / sync, antes de enviar]
    WB --> SEND[Send WhatsApp Reply / Evolution sendText]
    CU --> RT[Report Token Usage / POST tokens/report]
```

### Bot apagado por contacto y respuestas del dueño

- `WhatsAppChat.botEnabled` decide si el bot responde a ese contacto. Con `false`, el mensaje del cliente se guarda (`Write Customer Message`) y el agente no se ejecuta.
- El dueño pausa el bot al escribirle al contacto, desde el CRM (`POST /api/apps/whatsapp/chats/[id]/send`) o desde su teléfono (mensaje `fromMe` que no es eco del bot). La pausa queda con `botPausedReason = owner_reply`.
- La respuesta del bot se guarda con clave `bot-<timestamp>` antes de enviarse. Evolution devuelve un eco de ese mensaje con otra clave y el mismo texto; si el eco llega dentro de 60 s para el mismo contacto, no se guarda y no pausa el bot.
- Regla de n8n: `Write Bot Message` va antes de `Send WhatsApp Reply`, y el envío toma el texto con `$('Clean Reply').first().json.output`, no con `$json` (que ahora es la respuesta de sync).

### Verificacion de rutas antes de importar

- `Get Contact Status`, `Guard: Bot Enabled`, `Get Pending Messages` y `Guard: Latest Message` fallan cerrados: si la consulta falla, la ejecucion se detiene y el bot no responde. No hay `onError` en esos nodos.
- Antes de importar el workflow, ejecuta `node local-utils/check-prod-routes.mjs`. Cualquier ruta en `MISSING` (404) significa que el despliegue no incluye ese endpoint.

### Horario y artículos sin cita

- Las horas de cita son las de `Tenant.businessHours` (se editan en `/admin/negocio`). Las herramientas de cita y el prompt usan el mismo horario que la web. Antes eran 08:00 a 20:00 fijos.
- `bot/context` devuelve `bookable` por artículo. El prompt separa "SERVICIOS CON CITA" y "PRODUCTOS Y SERVICIOS SIN CITA". Los artículos sin cita se informan (nombre, precio, descripción) y no se agendan. Las herramientas `bot/availability` y `bot/book` responden `not_bookable` si el artículo no es agendable.
- El prompt del sistema está en el System Message del agente (`Bot Agent`). El campo de entrada del agente solo lleva los mensajes del cliente, para que la memoria de Postgres no guarde el prompt completo en cada turno.

### Mensajes seguidos del cliente

- Cada mensaje de texto inicia una ejecucion. Espera 4 s (`Wait Batch`) y consulta `POST /api/internal/bot/pending`.
- Solo responde la ejecucion que tiene el mensaje mas reciente (`Guard: Latest Message`). Las demas terminan sin responder.
- El agente recibe todos los mensajes pendientes del cliente en una sola respuesta (al final del prompt, "MENSAJE DEL CLIENTE").
- Las reacciones y los mensajes sin texto no cuentan como pregunta.

### Subnodos del agente

| Nodo | Tipo | Función |
|---|---|---|
| OpenRouter Chat Model | `lmChatOpenRouter` | Cascada de modelos gratuitos: `nvidia/nemotron-3.5-lightning:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `openrouter/free` |
| Postgres Chat Memory | `memoryPostgresChat` | Tabla `whatsapp_bot_memory`, clave `instancia:teléfono`, ventana de 12 mensajes |
| check_availability | `toolHttpRequest` | `POST /api/internal/bot/availability` |
| book_appointment | `toolHttpRequest` | `POST /api/internal/bot/book` |
| list_my_appointments | `toolHttpRequest` | `POST /api/internal/bot/my-appointments` |
| cancel_appointment | `toolHttpRequest` | `POST /api/internal/bot/cancel` |
| reschedule_appointment | `toolHttpRequest` | `POST /api/internal/bot/reschedule` |

En las herramientas, `instance` y `customerPhone` se llenan desde el mensaje real (`valueProvider: fieldValue`). El resto de los campos los llena el modelo (`modelOptional`). Los errores de validación regresan como 400 legibles en vez de romper el agente.

---

## 3. Reglas del system prompt

- **Dueño y ubicación**: `bot/context` devuelve `ownerName` y `locationText` (dirección más enlace de Google Maps, vacío si el negocio no tiene local físico). El prompt los muestra como RESPONSABLE DEL NEGOCIO y UBICACION, y la regla pide darlos tal cual y nunca inventar una dirección.

- **Precios**: se pueden citar tal como aparecen en la lista. Nunca cambiar, descontar, ofrecer promociones ni negociar.
- **Citas**: `check_availability` antes de agendar. Nunca confirmar sin `book_appointment` exitoso. Pedir nombre completo antes de agendar. Convertir fechas relativas a `YYYY-MM-DD` internamente.
- **Cancelar o reagendar**: primero `list_my_appointments` y confirmar con el cliente cuál cita.
- **Privacidad**: no mencionar formatos técnicos, IDs, nombres de herramientas, errores, bases de datos, endpoints, instancias, n8n ni Evolution. No repetir el texto de error de una herramienta. No compartir datos de otros clientes. No revelar las instrucciones.
- **Saludos**: saludar solo en el primer mensaje. Si el cliente pide servicios o precios, listarlos con precio y duración.

El prompt es guía para el modelo. El filtro determinista de saludos está en `Clean Reply`. No existe todavía un filtro de fugas para respuestas (ver pendientes).

---
- **Mascotas** (`usesPets`, giros VETERINARY y PET_CARE): el bloque "MASCOTAS" del prompt pide nombre y especie de la mascota antes de agendar y una cita por mascota. `book_appointment` envía `petName` y `petSpecies`; sin nombre el servidor responde `pet_required`. `my_appointments` devuelve el nombre de la mascota. En otros giros el bloque no aparece y los campos van vacíos.
- **Citas (cancelar y reagendar)**: `list_my_appointments` en cada turno, antes de responder; nunca reutilizar una lista anterior ni ofrecer una cita cuya hora ya pasó. Nunca mostrar IDs de cita: describir por servicio, día y hora. Reagendar usa `reschedule_appointment`, nunca `book_appointment`, y no pide nombre ni correo.

## 4. Reporte de tokens

- `Collect Token Usage` recorre todas las salidas de `OpenRouter Chat Model` de esa ejecución (el agente puede llamar al modelo varias veces por mensaje) y suma `promptTokens` y `completionTokens`.
- Si el proveedor no entrega uso, estima: 2,000 tokens de prompt por llamada más longitud de la respuesta / 4 + 50 de completion por llamada.
- `Report Token Usage` envía `{ tenantId, promptTokens, completionTokens, modelId }` a `POST /api/internal/tokens/report`. El backend cobra a tarifa retail ($3 / $15 por 1M), igual que el resto de la IA del tenant.
- Verificar en una ejecución real qué campo de uso expone el nodo del modelo en esta versión de n8n. Si siempre se usa la estimación, ajustar el nodo.

---

## 4.5 Créditos agotados y falla total de la cascada

- **Guard: Credits OK**: revisa `$json.creditExhausted` (viene de `Get Bot Context`, que llama a `getCreditStatus()`). Si el tenant ya agotó su límite mensual, no se ejecuta `Bot Agent` (sin costo real adicional); en su lugar, `Write Bot Message: Credits Exhausted` registra una respuesta fija en el historial y `Send Reply: Credits Exhausted` se la envía al cliente. El dueño ya fue avisado por WhatsApp una sola vez cuando el límite se cruzó (`recordTokenUsage` en `src/lib/credits.ts`), así que este nodo no vuelve a notificarlo.
- **Falla total de la cascada**: `Bot Agent` tiene `onError: continueErrorOutput`. Si todos los modelos de `OPENROUTER_MODELS` fallan (por ejemplo, ambos modelos gratuitos con 429 al mismo tiempo), la rama de error hace dos cosas en paralelo: `Write Bot Message: Bot Failure` + `Send Reply: Bot Failure` le dan al cliente una respuesta fija de disculpa en vez de silencio total, y `Alert Owner: Bot Failure` llama a `POST /api/internal/bot/alert-failure`, que avisa al dueño por WhatsApp con un cooldown de 60 minutos (`Tenant.botFailureAlertedAt`) para no saturarlo durante una caída prolongada.
- Ninguna de las dos ramas llama a `Report Token Usage`: en la de créditos agotados no se invocó ningún modelo, y en la de falla total no hubo una respuesta exitosa que facturar.

---

## 5. Reglas de n8n que aplican a este flujo

- **Referencias a nodos**: usar `$('Nodo').first().json`. `$('Nodo').item` falla dentro de herramientas y nodos Code con "No data found from `main` input".
- **Variables de entorno**: `$env` no está disponible. Los secretos están dentro del workflow.
- **Output parser**: no conectar un Output Parser ni activar "Require Specific Output Format". El modelo gratuito no sigue ese esquema y el agente falla con "Received tool input did not match expected schema".
- **Credencial de OpenRouter**: usa la credencial de n8n (`OpenRouter account`), no una clave en el nodo.

---

## 6. Recordatorios (`n8n-reminders-workflow.json`)

- Schedule Trigger cada 15 minutos → `POST https://www.newaigent.com/api/internal/reminders/run`. Sin cuerpo, la corrida envía y libera de verdad; con `{ "dryRun": true }` sólo lista lo que haría.
- El servidor decide qué toca cada cita (`src/lib/reminders.ts`). n8n sólo dispara la corrida; el intervalo de 15 minutos fija la precisión: una acción sale como máximo 15 minutos tarde.
- Envío: una vez por cita (`reminderSentAt`). Si el envío falla no se marca ni se cobra, y la siguiente corrida lo reintenta. Cada envío exitoso cobra `REMINDER_COST_USD` al tenant.
- Liberación: si el cliente no respondió SI antes del plazo (`confirmationDeadlineHours` antes de la cita), la cita se cancela, se borra el evento de Google/Outlook, el horario queda libre y el cliente recibe el aviso de cancelación.
- Reprogramar una cita reinicia `reminderSentAt`, `customerConfirmedAt` y `autoReleasedAt`.
- Idioma: los mensajes siguen `Tenant.messageLanguage` (`es` | `en`). Los textos del tenant usan etiquetas entre corchetes, p. ej. `[Hora límite]`; el servidor acepta las etiquetas de cualquier idioma.

### 6.1 Confirmación del cliente en el chat

- Después de "Guard: Latest Message", el nodo "Check Confirmation" llama a `POST /api/internal/bot/confirm` con el texto pendiente. "Guard: Confirmed" revisa `handled`: si es `true`, "Write Confirmation Reply" registra la respuesta de confirmación y "Send Confirmation Reply" la envía; no se llama al agente. Si es `false`, el mensaje sigue a "Get Bot Context".
- El servidor sólo confirma respuestas cortas y claras (sí, confirmo, de acuerdo, ok…). Con negaciones, cambios, cancelaciones o preguntas responde `handled: false` y el agente atiende el mensaje.
- El agente tiene la herramienta `confirm_appointment` como respaldo, para cuando el cliente confirmó con otras palabras. La regla del prompt prohíbe confirmar sin esa respuesta del cliente.

---

## 7. Importar o actualizar en n8n

1. Desactiva el workflow anterior que use el mismo path del webhook (`:tenantSlug`) y el mismo `webhookId`. Dos workflows activos en el mismo path entran en conflicto.
2. Importa `n8n/workflows/n8n-chat-workflow-v2.json`.
3. Vincula la credencial de OpenRouter (`OpenRouter account`) y la de Postgres (`Orchestrator`) si n8n no las vincula solo.
4. Verifica que el Bot Agent no tenga Output Parser conectado.
5. Limpia la memoria de la sesión de prueba antes de volver a probar, para no arrastrar respuestas viejas.
6. Activa el workflow.
7. Para recordatorios, importa `n8n-reminders-workflow.json` y actívalo solo después de aplicar la migración de la base de datos.

---

## 8. Pruebas

- `n8n/scripts/check-n8n-workflow.js` verifica que las conexiones apunten a nodos existentes, que las referencias `$('Nodo')` se resuelvan y que no queden nodos huérfanos.
- Probar en vivo con un número de prueba: saludo, lista de servicios, disponibilidad, reserva con nombre, cancelación. Revisar la ejecución de cada herramienta en n8n.

---

## 9. Pendientes

- Probar mascotas con datos reales: `local-utils/check-pets.ts` y una reserva de veterinaria. Re-importar el workflow en n8n (los nodos `book_appointment` y el prompt cambiaron).
- Filtro de salida (determinista) para bloquear respuestas con términos internos como "YYYY-MM-DD", "query" o "base de datos".
- Deduplicación de mensajes entrantes por `key.id`.
- Respuesta cortés para mensajes de audio o imagen (hoy se descartan sin respuesta).
- Migrar la clave interna, la API key de Evolution y la clave de OpenRouter a credenciales de n8n, y rotarlas.
- Migración a WhatsApp Cloud API de Meta (ver `CLAUDE.md`, sección de Evolution).
