# Cambios pendientes en n8n: P0 del bot (#139, #140; #141 y #148 no necesitan cambio)

Flujo: **NewAigent - WhatsApp Bot (Chat)** (producción, activo, 47 nodos). Revisión de **solo lectura** del 22-nov-2026: la ola del 23-nov ya está viva en ese flujo (el prompt trae "raised: false" y "campo message").

Solo se cambia este flujo. El flujo de Stage no se toca.

Este archivo no contiene claves. **Nada de esto lo cambió Claude: son cambios para pegar a mano, con respaldo y aprobación aparte.**

## Antes de pegar (obligatorio)

1. **Respaldo completo** del flujo vivo en `~/.n8n-backups/` (solo el dueño lo lee), por ejemplo `chat-prod-<id>-p0-139-140-<fecha>.json`, y confirmar que el archivo existe. Si algo sale mal, se restaura esa copia.
2. **Aprobación aparte** del dueño que nombre el flujo, el cambio exacto y la ruta del respaldo.
3. **Orden:** N2 y N3 se pueden pegar antes o después del deploy de la app. **N1 solo después de desplegar** la app de esta ronda (llama a `POST /api/internal/bot/media` y necesita la rama `[Imagen]` de `whatsapp/sync`). #141 y #148 funcionan solos con el deploy: el agente ya sigue el campo `message` que devuelve la herramienta.
4. **Coordinación con #145** (`content_filter` → "Perfect"): ese ticket toca la salida de error de `Bot Agent`. Aquí solo se agregan nodos nuevos y líneas del prompt; no se cambia ninguna conexión de error. Lee el estado vivo antes de pegar.

## Cómo está escrito el prompt

El system message del nodo **Bot Agent** es **una sola expresión de JavaScript**: empieza con `={{` y una comilla invertida. Por eso:

| Regla | Por qué |
|---|---|
| **Nunca pegues comillas invertidas** (la tecla junto al 1) | Cierran la expresión antes de tiempo y el nodo falla |
| Las comillas dobles y simples sí se pueden | Dentro de la expresión son texto normal |
| La parte de reglas de privacidad y de herramientas es **una línea larga** con los saltos escritos como `\n` | Un cambio ahí lleva su `\n-` al inicio, tal como se muestra |
| Otras secciones (por ejemplo, las reglas de agenda) tienen **saltos de línea reales** | Ahí cada regla nueva va en una **línea nueva real**, con `- ` al inicio |

**Cómo usar cada cambio:** en el editor del nodo busca (Ctrl/Cmd + F) el texto de **Buscar** (cada uno aparece **una sola vez**; se verificó contra la copia de solo lectura del 22-nov) y cámbialo por **Reemplazar por**.

---

## N1. Rama de archivos sin texto (#139)

**Por qué:** la salida falsa de `Guard: Has Text And Phone` no está conectada a nada, así que un audio, una foto, un video o un documento muere en silencio (ejecuciones 22420 y 22468).

**Alcance (decisión del dueño):** solo audio, imagen, video y documento. Ubicación, contacto, sticker, reacción, pie de foto y cualquier otro tipo no se manejan: la app responde `ignore`.

**Dónde se corta hoy:** `Webhook → Guard: Inbound Message → Extract Message → Guard: Has Text And Phone` (falso: nada).

**Cómo (armar en el editor; sin datos secretos):**

1. Conecta la **salida falsa** de `Guard: Has Text And Phone` a un nodo If nuevo **`Guard: Is File Message`**. Solo debe dejar pasar **audio, imagen, video, documento y documento con pie** (la misma lista que usa la app) y exigir que haya teléfono; **no** "cualquier mensaje con tipo". Así los stickers, las ubicaciones, los contactos, las reacciones y los mensajes de protocolo siguen como hoy: no pasan por `sync` ni por `bot/media` (si pasaran, una reacción se guardaría como "Reacción eliminada", se perdería el pie de foto y un sticker contaría como si el cliente hubiera escrito). La condición exacta está en el último bloque de texto de esta sección ("Condiciones de las puertas"). Salida falsa: sin conexión (igual que hoy). Configuración del nodo: **typeValidation `loose` y looseTypeValidation activado** ("Convert types where required"), como `Guard: Greeting Reply`: si llega un dato raro, va a falso en vez de fallar la ejecución.
2. Salida verdadera → **`Strip File Data`** (nodo Code, "Run Once for All Items"). Quita el archivo antes de mandar nada a la app: en un mensaje de archivo, `eventData` trae el `base64` y un video o documento puede pasar de **4.5 MB, el límite de cuerpo de Vercel** (daría 413 y no se guardaría `[Video]`). Pega este código:

<!-- strip-file-data:start -->
```js
// Strip File Data: keep only what whatsapp/sync reads (ids, name, time and the KEY of the media type). Never the file.
const e = $('Extract Message').first().json;
const d = e.eventData || {};
const key = d.key || {};
const type = d.messageType || Object.keys(d.message || {}).find((k) => /Message$/.test(k)) || '';
return [{
  json: {
    instance: e.instance,
    data: {
      key: { id: key.id, remoteJid: key.remoteJid, remoteJidAlt: key.remoteJidAlt, fromMe: !!key.fromMe },
      pushName: d.pushName || null,
      messageTimestamp: d.messageTimestamp,
      messageType: type,
      message: type ? { [type]: {} } : {},
    },
  },
}];
```
<!-- strip-file-data:end -->

3. → **`Write Customer Message (File)`**: **copia** del nodo `Write Customer Message` (misma URL `/api/internal/whatsapp/sync`, mismos encabezados, mismo tiempo de espera, y ya trae "continuar si falla"). **Solo cambia el cuerpo** a:

```text
={{ JSON.stringify({ instance: $json.instance, data: $json.data }) }}
```

   Verifica que quede con **On Error: Continue (regular output)**, igual que el original: así `Media Decision` corre aunque este nodo falle.

4. → **`Media Decision`** (HTTP Request, `POST https://www.newaigent.com/api/internal/bot/media`, **mismos encabezados que `Write Customer Message`**, sin copiar la clave a ningún documento). Cuerpo (JSON, **solo estos campos**, sin `base64`):

```text
={{ JSON.stringify({ instance: $('Extract Message').first().json.instance, remoteJid: $('Extract Message').first().json.eventData?.key?.remoteJid, remoteJidAlt: $('Extract Message').first().json.eventData?.key?.remoteJidAlt, messageType: $('Extract Message').first().json.eventData?.messageType }) }}
```

   Toma sus datos de `Extract Message`, no del nodo anterior. Configura **On Error: Continue (regular output)** y tiempo de espera de 10 s: si falla, el flujo termina como hoy.

5. → **`Guard: Media Reply`** (If): `{{ $json.action }}` es igual a `reply` (comparación de texto). Configuración del nodo: **typeValidation `loose` y looseTypeValidation activado**, igual que `Guard: Is File Message`: un dato raro va a falso y no hace fallar la ejecución.
6. Verdadero → **`Send Media Reply`**: **copia** de `Send Greeting Reply` (misma URL `/api/internal/whatsapp/send`, mismos encabezados). Lleva `messageKey`, con el mismo valor que el id de `Write Media Reply`, como ya hace `Send WhatsApp Reply`: la ruta de envío lo usa como clave de idempotencia y un reintento de n8n no manda la respuesta dos veces. Cuerpo:

```text
={{ JSON.stringify({ instance: $('Extract Message').first().json.instance, to: $('Extract Message').first().json.customerPhone, text: $('Media Decision').first().json.reply, messageKey: 'bot-media-' + ($('Extract Message').first().json.eventData?.key?.id || $execution.id) }) }}
```

7. → **`Write Media Reply`**: **copia** de `Write Bot Message: Greeting` (misma URL `/api/internal/whatsapp/sync`, "continuar si falla"). Cuerpo:

```text
={{ JSON.stringify({ instance: $('Extract Message').first().json.instance, data: { key: { remoteJid: $('Extract Message').first().json.customerPhone + '@s.whatsapp.net', fromMe: true, id: 'bot-media-' + ($('Extract Message').first().json.eventData?.key?.id || $execution.id) }, message: { conversation: $('Media Decision').first().json.reply }, messageTimestamp: Math.floor(Date.now() / 1000) } }) }}
```

El id del mensaje usa el del mensaje entrante (como `Write Bot Message`): un reintento de n8n no guarda la respuesta dos veces.

### Condiciones de las puertas

**`Guard: Is File Message`:** una sola condición de tipo **Boolean → is true**, con esta expresión exacta (cópiala completa, incluido `={{`):

```text
={{ ['audioMessage', 'imageMessage', 'videoMessage', 'documentMessage', 'documentWithCaptionMessage'].includes($('Extract Message').first().json.eventData?.messageType) && !!$('Extract Message').first().json.customerPhone }}
```

La lista es la misma que `FILE_MESSAGE_TYPES` de `src/lib/unsupported-media.ts`; `tests/n8n-p0-nodes.test.ts` ejecuta esta expresión y comprueba que coincida con la app para cada tipo. Si algún día la app agrega un tipo (por ejemplo, ubicación), se agrega en las dos partes.

**`Guard: Media Reply`:** condición de texto, `{{ $json.action }}` **igual a** `reply`.

**Reglas del flujo:** usa siempre `$('Nodo').first().json`, nunca `.item`. No pegues nada que contenga el `base64` del archivo.

**Qué hace la app por ti (no hay que repetirlo en n8n):** no responde ni marca el chat si quien manda el archivo es del equipo, si el bot está apagado en ese chat, o si el contacto pidió no recibir mensajes; da **una sola respuesta** por ráfaga de archivos (10 minutos); el archivo igual queda guardado en el chat como `[Imagen]`, `[Audio]`, `[Video]` o `[Documento]`.

**Prueba (desde el número de prueba a newy, avisando al dueño antes de cada mensaje):** una foto, un audio, un documento, tres fotos seguidas (una sola respuesta), un sticker (nada) y un archivo grande de más de 5 MB (el chat guarda `[Video]` o `[Documento]` y el bot responde).

---

## N2. Reglas de redacción del prompt (#140)

Las tres van en el system message de **Bot Agent**.

### N2a. No hablar de error sin error (ejecución 22453)

**Por qué:** la herramienta respondió bien ("ya no hay horarios ese día") y el modelo antepuso "hubo un error".

**Buscar** (parte de una sola línea; en el editor se ve con `\"` alrededor de la frase):

```text
Solo si no hay message, di algo como: \"No pude completar esa accion en este momento. Intentemos de nuevo o te comunicamos con el equipo.\"
```

**Reemplazar por** (una sola línea; el `\n-` separa la regla nueva):

```text
Solo si no hay message, di algo como: \"No pude completar esa accion en este momento. Intentemos de nuevo o te comunicamos con el equipo.\"\n- Solo menciones un error o un problema si una herramienta devolvio success false o un campo error. Si una herramienta respondio con exito pero sin horarios, di que ese dia no hay lugares y ofrece otro dia; no digas que hubo un error.
```

### N2b. Solo confirmar tras un éxito

**Por qué:** que el bot no diga "agendada" o "ya quedó" sin un `success: true`.

**Buscar** (esta regla está al inicio de una **línea real**):

```text
- No ofrezcas ni agendes horas que ya pasaron.
```

**Reemplazar por** (**dos líneas reales**: no escribas `\n`, pulsa Enter):

```text
- Solo digas que una cita quedo agendada, confirmada o movida si en esta misma respuesta book_appointment o reschedule_appointment devolvieron success true. Si fallaron o no los llamaste, no lo afirmes: di lo que paso o pide el dato que falta. Si la cita ya existia, di que ya la tenia segun list_my_appointments.
- No ofrezcas ni agendes horas que ya pasaron.
```

### N2c. Reintentar con la lista de servicios (ejecución 22764)

**Por qué:** el modelo copió mal el id del servicio. La app ahora lo encuentra por su inicio o su nombre, y si no puede, responde `service_not_found` con la lista de servicios.

**Buscar** (después de `\n` escrito, en la parte de una sola línea):

```text
- Si una herramienta devuelve un campo message con una instruccion,
```

**Reemplazar por** (una sola línea; el `\n-` separa las dos reglas):

```text
- Si una herramienta responde service_not_found con una lista de services, elige de la lista el que el cliente pidio, copia su id completo caracter por caracter y vuelve a llamar la herramienta una vez, sin decirle nada al cliente. Solo si ninguno se parece, di que no tienes ese servicio y ofrece los de la lista por su nombre. Cuando una herramienta te devuelva serviceName, usa ese nombre con el cliente (no el que habias escrito tu), y si no coincide con lo que pidio, confirmalo antes de agendar.\n- Si una herramienta devuelve un campo message con una instruccion,
```

**Después de pegar N2:** guarda el flujo y abre de nuevo el nodo **Bot Agent**: si la vista previa del system message marca un error ("invalid syntax" o similar), busca una comilla invertida que se haya colado. Si no se arregla, restaura el respaldo.

**Prueba (newy, avisando al dueño):** un día sin horarios (el bot dice que no hay lugares, **sin** decir "error"), una cita completa (confirma solo tras el éxito), un horario ocupado (no confirma y ofrece otros).

---

## N3. Guarda en modo sombra: cita afirmada sin éxito (#140)

**Decisión del dueño:** empieza en **modo sombra** (solo anota) hasta revisar **unas 100 conversaciones** con la guarda activa sin falsos positivos. Solo entonces se decide si reemplaza la respuesta.

**Dónde:** un nodo Code nuevo **`Guard: Booking Claim`** entre **`Clean Reply`** y **`Send WhatsApp Reply`**. Va **después** de `Clean Reply` para no tocar la cadena `Bot Agent → Collect Token Usage → Report Token Usage → Clean Reply`; los nodos que siguen leen `Clean Reply` por nombre, así que no cambia nada. **No cambia la conexión de error de `Bot Agent`.**

**Qué hace:** si la respuesta dice que una cita quedó agendada, confirmada o movida y **ninguna** herramienta devolvió `success: true` en esta ejecución (`book_appointment`, `reschedule_appointment`, `list_my_appointments` o `confirm_appointment`), agrega `claimUnbacked: true` al dato. **Nunca cambia `output`.** Una negación ("no quedó agendada", "has not been booked") no cuenta. Reconoce español e inglés ("ha sido agendada", "te agendé", "has been booked"). `list_my_appointments` no trae `success`: cuenta como respaldo si trae al menos una cita en `appointments`.

<!-- guard-booking-claim:start -->
```js
// Guard: Booking Claim (SHADOW MODE). Marks a reply that says a visit is booked, moved or confirmed when no tool succeeded
// in this run. It never changes the reply. A tool node that did not run has no data: that counts as "did not succeed".
const reply = String($json.output || '');
const DONE_ES = '(agendad|confirmad|reagendad|reservad|programad)[ao]s?';
const DONE_EN = '(booked|scheduled|confirmed|rescheduled)';
// First person: the bot says what it did. Always a claim.
const FIRST_PERSON = [
  /\b(he|hemos)\s+(agendado|confirmado|reagendado|reservado|programado)\b/gi,
  /\bte\s+(agend|reserv|program)é(?![a-záéíóúñ])/gi,
  /\b(agend|reserv|program)[eé]\s+(tu|su|la)\s+(cita|visita|consulta)\b/gi,
  new RegExp('\\bI(\'ve|’ve|\\s+have)\\s+' + DONE_EN + '\\b', 'gi'),
];
// Status: "quedó agendada", "has been booked", "is confirmed". Also said about a TIME that is taken ("ese horario ya está
// reservado"), so it counts only when the visit of the customer is the subject (see subjectIsVisit).
const STATUS = [
  new RegExp('\\b(ya\\s+)?(qued[oó]|quedaron|est[aá]n?|queda|fue|fueron)\\s+' + DONE_ES + '\\b', 'gi'),
  new RegExp('\\b(ha|han)\\s+sido\\s+' + DONE_ES + '\\b', 'gi'),
  new RegExp('\\b(has|have)\\s+been\\s+' + DONE_EN + '\\b', 'gi'),
  new RegExp('\\b(is|are)\\s+' + DONE_EN + '\\b', 'gi'),
  /\byour\s+(appointments?|visits?|bookings?|reservations?)\s+(is|are)\s+(booked|confirmed|set)\b/gi,
];
const VISIT_WORD = /\b(citas?|visitas?|consultas?|reservas?|reservaci[oó]n|reservaciones|appointments?|visits?|bookings?|reservations?)\b/gi;
const SLOT_WORD = /\b(horarios?|horas?|espacios?|lugar(es)?|slots?|times?)\b/gi;
const NEGATION = /\b(no|not|never|todav[ií]a no|a[uú]n no|yet)\s*$/i;
const lastEnd = (text, re) => Array.from(text.matchAll(re)).reduce((end, m) => m.index + m[0].length, -1);
// The subject is the nearest visit or time word before the claim in its sentence (or the first one after it).
const subjectIsVisit = (m) => {
  if (m[0].search(VISIT_WORD) >= 0) return true;
  const start = Math.max(reply.lastIndexOf('?', m.index), reply.lastIndexOf('!', m.index), reply.lastIndexOf('¿', m.index), reply.lastIndexOf('¡', m.index), reply.lastIndexOf('\n', m.index)) + 1;
  const tail = reply.slice(m.index + m[0].length);
  const stop = tail.search(/[?!\n]/);
  const before = reply.slice(start, m.index);
  const after = stop < 0 ? tail : tail.slice(0, stop);
  const visitBefore = lastEnd(before, VISIT_WORD);
  const slotBefore = lastEnd(before, SLOT_WORD);
  if (visitBefore >= 0 || slotBefore >= 0) return visitBefore > slotBefore;
  const visitAfter = after.search(VISIT_WORD);
  const slotAfter = after.search(SLOT_WORD);
  return visitAfter >= 0 && (slotAfter < 0 || visitAfter < slotAfter);
};
const denied = (m) => NEGATION.test(reply.slice(Math.max(0, m.index - 14), m.index));
const found = (patterns) => patterns.flatMap((re) => Array.from(reply.matchAll(re))).filter((m) => !denied(m));
const claims = found(FIRST_PERSON).length > 0 || found(STATUS).some(subjectIsVisit);
// A tool succeeded: success true, or (list_my_appointments only, which has no success field) a non-empty appointments list.
const succeeded = (name) => {
  try {
    return $(name).all().some((item) => {
      const json = item.json || {};
      return json.success === true || (name === 'list_my_appointments' && Array.isArray(json.appointments) && json.appointments.length > 0);
    });
  } catch (err) {
    return false;
  }
};
const backed = ['book_appointment', 'reschedule_appointment', 'list_my_appointments', 'confirm_appointment'].some(succeeded);
return [{ json: { ...$json, claimUnbacked: claims && !backed } }];
```
<!-- guard-booking-claim:end -->

**A verificar en el humo H12 (una cita completa real en newy, avisando al dueño), antes de depender de ello:** que `$('book_appointment').all()` funcione desde un Code node para una herramienta de agente y traiga `json.success`. La señal es esta: en esa cita real, **`claimUnbacked` debe salir `false`**. Si sale `true`, la guarda no está leyendo el resultado de la herramienta (el `try/catch` devuelve "no tuvo éxito" y marcaría de más): se detiene la revisión y no se pasa a "reemplazar". Se comprueba en ese humo, **no leyendo ejecuciones viejas**.

**Cómo revisar:** en las ejecuciones normales (solo lectura), busca `claimUnbacked: true` en la salida de `Guard: Booking Claim`; cada marca se compara con las herramientas de esa ejecución. Al juntar unas 100 conversaciones sin falsos positivos, se decide el siguiente paso con el dueño.

---

## Si algo sale mal

Restaura el respaldo hecho antes de pegar. No hace falta tocar la app: nada de lo anterior es requisito para que la app funcione (sin N1, los archivos siguen descartándose como hoy; sin N2 y N3, el bot sigue con el prompt actual, y la app ya devuelve los mensajes explícitos).
