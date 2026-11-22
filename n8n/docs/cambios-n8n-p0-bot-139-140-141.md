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

1. Conecta la **salida falsa** de `Guard: Has Text And Phone` a un nodo If nuevo **`Guard: Is File Message`** con dos condiciones unidas por "y": `{{ $('Extract Message').first().json.customerPhone }}` no vacío, y `{{ $('Extract Message').first().json.eventData.messageType }}` no vacío. Salida falsa: sin conexión (igual que hoy).
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

5. → **`Guard: Media Reply`** (If): `{{ $json.action }}` es igual a `reply` (comparación de texto).
6. Verdadero → **`Send Media Reply`**: **copia** de `Send Greeting Reply` (misma URL `/api/internal/whatsapp/send`, mismos encabezados). Cuerpo:

```text
={{ JSON.stringify({ instance: $('Extract Message').first().json.instance, to: $('Extract Message').first().json.customerPhone, text: $('Media Decision').first().json.reply }) }}
```

7. → **`Write Media Reply`**: **copia** de `Write Bot Message: Greeting` (misma URL `/api/internal/whatsapp/sync`, "continuar si falla"). Cuerpo:

```text
={{ JSON.stringify({ instance: $('Extract Message').first().json.instance, data: { key: { remoteJid: $('Extract Message').first().json.customerPhone + '@s.whatsapp.net', fromMe: true, id: 'bot-media-' + ($('Extract Message').first().json.eventData?.key?.id || $execution.id) }, message: { conversation: $('Media Decision').first().json.reply }, messageTimestamp: Math.floor(Date.now() / 1000) } }) }}
```

El id del mensaje usa el del mensaje entrante (como `Write Bot Message`): un reintento de n8n no guarda la respuesta dos veces.

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

**Qué hace:** si la respuesta dice que una cita quedó agendada, confirmada o movida y **ninguna** herramienta devolvió `success: true` en esta ejecución (`book_appointment`, `reschedule_appointment`, `list_my_appointments` o `confirm_appointment`), agrega `claimUnbacked: true` al dato. **Nunca cambia `output`.** Una negación ("no quedó agendada") no cuenta.

<!-- guard-booking-claim:start -->
```js
// Guard: Booking Claim (SHADOW MODE). Marks a reply that says a visit is booked, moved or confirmed when no tool succeeded
// in this run. It never changes the reply. A tool node that did not run has no data: that counts as "did not succeed".
const reply = String($json.output || '');
const CLAIM = /\b(ya\s+)?(qued[oó]|est[aá]|queda|fue)\s+(agendad[ao]|confirmad[ao]|reagendad[ao])\b|\b(he|hemos)\s+(agendado|confirmado|reagendado)\b|\bagend[eé]\s+(tu|su|la)\s+cita\b/i;
const NEGATION = /\b(no|todav[ií]a no|a[uú]n no)\s*$/i;
const match = CLAIM.exec(reply);
const claims = !!match && !NEGATION.test(reply.slice(Math.max(0, match.index - 14), match.index));
const succeeded = (name) => {
  try {
    return $(name).all().some((item) => item.json && item.json.success === true);
  } catch (err) {
    return false;
  }
};
const backed = ['book_appointment', 'reschedule_appointment', 'list_my_appointments', 'confirm_appointment'].some(succeeded);
return [{ json: { ...$json, claimUnbacked: claims && !backed } }];
```
<!-- guard-booking-claim:end -->

**A verificar en la primera ejecución de prueba, antes de depender de ello:** que `$('book_appointment').all()` funcione desde un Code node para una herramienta de agente. La evidencia indirecta es que `Collect Token Usage` ya lee `$('OpenRouter Chat Model').all()` de un sub-nodo. Si falla, el `try/catch` devuelve "no tuvo éxito" y la guarda marcaría de más: en ese caso se detiene la revisión y no se pasa a "reemplazar".

**Cómo revisar:** en las ejecuciones normales (solo lectura), busca `claimUnbacked: true` en la salida de `Guard: Booking Claim`; cada marca se compara con las herramientas de esa ejecución. Al juntar unas 100 conversaciones sin falsos positivos, se decide el siguiente paso con el dueño.

---

## Si algo sale mal

Restaura el respaldo hecho antes de pegar. No hace falta tocar la app: nada de lo anterior es requisito para que la app funcione (sin N1, los archivos siguen descartándose como hoy; sin N2 y N3, el bot sigue con el prompt actual, y la app ya devuelve los mensajes explícitos).
