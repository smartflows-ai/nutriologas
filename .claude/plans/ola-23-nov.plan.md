# Plan: ola del lunes 23-nov (#113, #116, #128, #127, #74, #129)

**Versión:** v5 (20-nov, 22:30) · **Complejidad:** media · **Rama única:** `fix/ola-23-nov`, desde `main` (`3b7aa40`) · **Negocio de prueba:** `newy` · **Entrega:** lunes 23-nov

## Cambios en v5

| # | Qué cambió | Dónde |
|---|---|---|
| 1 | Explicación con contexto de quién decide pasar el chat a una persona, y tu decisión: **C4 se queda como está** (el enojo solo no pasa el chat) | C4, sección "[v5] Explicación" |
| 2 | Las notas de n8n piden quitar "molesto o enojado" del prompt y no prometer una persona cuando la app responde `not_requested` | C4 y C6 |
| 3 | Rondas C1 a C5 en commits: `c0ccd8c`, `654e8f1`, `7b2918a`, `66c8d8b`, `56ba6b7` | Set de pruebas |

## Cambios en v4

| # | Qué cambió | Dónde |
|---|---|---|
| 1 | R0 terminado: 7 OK, R0-8 con la falla de contraste | Set de pruebas R0 |
| 2 | Commit nuevo **C5 (UI)**: texto legible sobre el color principal (`readableTextOn`, para todos los negocios) y sin `*` en el correo opcional de `/agendar` | Nueva sección C5 |
| 3 | El commit de documentación pasa a ser **C6** | C6 |
| 4 | La tarjeta de vista previa de `/ubicacion` no entra: queda como mejora | Fuera de esta ola |

## Cambios en v3

| # | Qué cambió | Dónde |
|---|---|---|
| 1 | newy es el negocio de pruebas: escribir **sus datos** en producción no tiene riesgo. Las escrituras en datos de newy se aprueban **una vez por ronda**, no una por una | "Acciones que pido aparte", Riesgos |
| 2 | Lo que **no** queda solo dentro de newy sigue con aprobación aparte: esquema, deploy, n8n, y cualquier cosa global. La base y la app son las mismas para doctorgcenter | "Acciones que pido aparte" |

## Cambios en v2

| # | Qué cambió | Dónde |
|---|---|---|
| 1 | Revisé n8n en solo lectura (GET). En producción el prompt ya usa la zona del negocio en "Hoy es" y en el horario. Falta "decir la zona junto a la hora", y encontré una regla que la contradice | C2, parte n8n |
| 2 | Set de pruebas por ronda: lo que tú escribes o mandas, el resultado de hoy y el esperado después | Nueva sección "Set de pruebas por ronda" |
| 3 | Requisito nuevo en R0: confirmar que newy tiene WhatsApp conectado, porque sin eso no salen los mensajes de prueba | R0 |
| 4 | El canvas queda abierto toda la ola. Conforme probamos, tacho cada caso y marco su resultado aquí | Set de pruebas |

## Respuestas a tus notas

| Nota | Respuesta |
|---|---|
| "Ayer modificamos los nodos y el prompt de n8n para la zona" (#127) | Confirmado en solo lectura. Detalle en C2, parte n8n [v2]. El prompt en vivo es **idéntico** a tu copia local la copia local de `~/.n8n-backups/` (archivo `chat-…-modificado-20261120-001455.json`). No cambié nada |
| "Con newy se puede probar en producción sin riesgo" [v3] | De acuerdo para **los datos de newy**: citas, zona, textos, confirmaciones y el nombre de una palabra de C1-W. Lo que no se puede encerrar en newy: un cambio de esquema o un deploy pega también a doctorgcenter (misma base y misma app), y n8n es un solo flujo para los dos. Esos siguen con su propia aprobación. Los WhatsApp a tu número te los sigo avisando |
| [v5] "Explica el punto con contexto, no solo ids" (sobre C4 y el cliente enojado) | Sección "[v5] Explicación" dentro de C4: los dos caminos que pasan el chat a una persona, qué pasó en #129, qué cambia C4, tu decisión y qué falta en n8n |
| "No cierres el canvas; agrega el set de pruebas y ve tachando" | Hecho: el canvas sigue abierto y la sección "Set de pruebas por ronda" tiene casillas. Tacho cada caso cuando lo validemos [v2] |

## Resumen

Una rama, **un commit por ticket**. Cada commit se prueba y se aprueba antes de pasar al siguiente. **No se hace push** hasta el final: al terminar la ola se manda todo junto (push, PR y deploy, cada paso con su propia aprobación).

"Probar en producción" en esta ola significa: **la app local** (`newy.localhost:3000`) **sobre la base de producción**, con el usuario de prueba y evidencia en Chrome. La estrategia local (`/local-db-mirror`, `/local-wa-test`) se usa solo para forzar un caso que no existe en la base real.

> Metáfora: armamos todas las piezas del juguete en la mesa de la casa (la app local), probando cada una con pilas de verdad (la base real). Solo el lunes lo llevamos a la tienda (el deploy) y ahí probamos que funcione en el aparador (WhatsApp real).

## Decisiones tomadas (20-nov)

| Pregunta | Respuesta |
|---|---|
| Alcance | Conjunto crítico: verificar #113 y #116, y un commit para cada uno de #128, #127, #74 y #129 |
| #127 | Mínimo seguro: texto del aviso corregido, aviso de zona distinta a la de la dirección, y lista de citas afectadas con confirmación antes de guardar. **No se mueven citas ni eventos de Google** |
| Negocio | `newy` (copia de demostración, 18-nov) |
| Deploy | Solo commits, nunca push durante la ola. Al final se manda todo de una vez |

## Hallazgos que cambian cómo se prueba

1. **Sin push, n8n no ve el código nuevo.** El bot de WhatsApp llama a la app **desplegada** (`bot/context`, `bot/confirm`, `bot/help`), no a la local. Así que los cambios del bot (#128, #129, la respuesta al SI de #74) se prueban en local llamando al endpoint con `curl`, y la prueba con WhatsApp real queda para **después del deploy** (lista "Humo del lunes").
2. **Local sobre producción = escritura real.** Toda cita, confirmación o cambio de zona que hagamos en `newy.localhost` se guarda en la base real, y un "Confirmar" manda un WhatsApp de verdad.
3. **`/local-wa-test` choca con #113.** El runner (`local-utils/reminder-live.ts`) solo acepta citas a nombre de `prueba local` o `PRUEBA #16`, pero desde #113 `/agendar` rechaza "prueba" porque es un nombre de relleno (`src/lib/full-name.ts:20`). Arreglo local (no se sube): agregar el nombre completo del usuario de prueba a `TEST_NAMES` del runner y al texto de `.claude/commands/local-wa-test.md`.
4. **El espejo está viejo y apagado.** El último volcado es `full-before-35` (20-nov 01:30), de antes de aplicar la migración 35. Si una ronda necesita la estrategia local, primero `/local-db-mirror refresh`.
5. **No hay auditorías `minimal-ui`** en esta máquina (`local-utils/minimal-ui/` no existe). La revisión de UI se hace a mano con capturas: modo claro y oscuro, color de negocio claro y oscuro, ancho de teléfono.

## Dónde se prueba cada cosa

| Ticket | App local sobre la base real (Chrome) | `curl` al endpoint local | Estrategia local (forzar) | WhatsApp real (después del deploy) |
|---|---|---|---|---|
| #113 / #116 (R0) | Producción desplegada, sin código nuevo | `curl -A "WhatsApp/2.0"` a `newy.newaigent.com` | — | Vista previa del enlace |
| #128 | — | `bot/context` con un número con nombre de una palabra | Espejo: poner un nombre de una sola palabra a una cita de prueba | 3 veces, las 3 piden el apellido |
| #127 | `/admin/negocio`: aviso, lista y confirmación | `GET` del impacto | — | Texto del recordatorio con la zona |
| #74 | Botón Confirmar en Citas y en Confirmaciones; tarjeta de textos con `..` | `bot/confirm` (respuesta al SI) | `/local-wa-test`: recordatorio presencial | Recordatorio y respuesta al SI con ubicación |
| #129 | — | `bot/help` con y sin una petición explícita | — | Agendar para la hija no pausa el bot |

## Cómo se hace cada ronda

1. Escribo la prueba que falla (TDD), luego el código, y corro `npx tsx --test tests/*.test.ts` y `npx tsc --noEmit`.
2. `/ecc:code-review` del diff de la ronda. Para #127 también `/ecc:security-scan`, porque toca una ruta de negocio con sesión.
3. **Prueba en la app local**: abro Chrome con ECC (`chrome-devtools`), **tú inicias sesión** con el usuario de prueba (la contraseña nunca pasa por mí) y **tú envías los formularios**; yo navego, reviso y tomo capturas.
4. Te aviso antes de cualquier paso que use un teléfono o mande un WhatsApp.
5. Las capturas se guardan en `.evidence-ola-23/<ticket>/`, una carpeta que git ignora. Al final elegimos cuáles van al PR.
6. `npm run build` con el servidor de desarrollo apagado (comparten `.next`), luego `rm -rf .next && npm run dev`.
7. Te muestro el resultado; **con tu aprobación hago el commit** (archivos por nombre, sin `git add -A`, revisando que no entre nada de `local-utils/`).

---

## R0 · Verificar #113 y #116 (sin commit de código)

Ya están en `main` (`2b89146`, PR #126). Solo confirmamos que funcionan en producción y juntamos evidencia.

| Caso | Pasos | Esperado |
|---|---|---|
| #113 nombre completo, panel | Citas → Nueva cita con "Ana" | Error de nombre y apellido en el campo; no se crea nada |
| #113 "Para otra persona" | Nueva cita | La opción no aparece |
| #113 Recuperar | Pestaña Eliminadas, con una cita pasada y una futura (si existen) | Recuperar solo en la futura |
| #113 `/agendar` | Sin sesión, nombre "Ana" | Aviso antes de enviar |
| #116 botón | Citas, Servicios, FAQ, Carrusel, Equipo | Mismo botón `btn-primary`; texto legible sobre el color de newy, en claro y oscuro |
| #116 vista previa | `curl -A "WhatsApp/2.0" https://newy.newaigent.com/` | `og:description` en español, con `og:image` y `og:url` |
| #116 `/ubicacion` | `curl -I https://newy.newaigent.com/ubicacion)` | Redirige a `/ubicacion` |

Si algo falla en producción y no en local, quiere decir que `2b89146` **no está desplegado**: lo reporto y no sigo con esa parte.

**[v3] Resultado de los requisitos (20-nov):** WhatsApp conectado (`/admin/whatsapp`: "Connected"). Local físico activo, dirección en Monterrey, visitas presenciales y en línea. Google Calendar sincronizado.

**[v3] Hallazgos de R0 (no se tocaron):**

| Hallazgo | Consecuencia | Pregunta | [v4] Decisión |
|---|---|---|---|
| La zona guardada de newy es **Cancún** (la nota del 19-nov decía que volvió a Ciudad de México) | Hoy el bot y `/agendar` ("Cancun time") ofrecen horas de Cancún para una dirección en Monterrey: **#127 está pasando ahora mismo en newy**. Sirve para C2-4 sin escribir nada | ¿Lo dejaron así a propósito? | Entra en C2: C2-4 lo usa tal cual y C2-5 lo corrige con el botón nuevo |
| `/agendar` muestra "Email \* (optional)" | Asterisco de obligatorio junto a "opcional" | ¿Ticket aparte o entra en esta ola? | Entra en **C5** (`booking.email` en `es.ts`/`en.ts:1494`) |
| Texto blanco sobre el color de newy (1.8:1) | Botones difíciles de leer en negocios de color claro | ¿Revisamos la decisión del 11-nov? Sería aplicar `readableTextOn` (cambia a todos los negocios) | **Sí, para todos** (20-nov). doctorgcenter tiene el **mismo** `#ffaca3`, así que sus botones también pasan a texto oscuro. Entra en **C5** |
| [v4] Panel 3:30 PM (Cancún) e invitación de Google 2:30 PM CST para la misma cita | Mismo instante en dos zonas: el paciente lee dos horas distintas | — | Evidencia para #127 (C2) |
| [v4] `/ubicacion` en WhatsApp no arma tarjeta | Redirige directo a Google Maps, así que WhatsApp no tiene nada que mostrar. Ya no sale la tarjeta rota de #116 | ¿Agregar una tarjeta? | **No en esta ola**: queda como mejora |

**[v2] Requisitos de R0 (los revisamos en la pantalla, con tu sesión):**
- newy tiene **WhatsApp conectado** (`/admin/whatsapp`). Si no, lo conectas tú con el QR antes de las rondas con mensajes. ~~La nota del 18-nov decía "sin conectores".~~ **[v3] Según la QA del 19-nov, newy ya tiene WhatsApp y Google Calendar conectados: solo lo confirmamos. Por eso Confirmar y Recuperar tocan el calendario real de newy, lo cual está bien dentro de newy.**
- newy tiene **local físico y dirección** (`/admin/negocio`). Sin eso, #74 no tiene ubicación que mostrar.
- El número del usuario de prueba es el que recibe los WhatsApp de prueba.

> Metáfora: antes de construir el segundo piso, revisamos que el primero sí esté pegado.

---

## C1 · #128: pedir el apellido antes de agendar (P1)

**Regla:** si el nombre guardado de un paciente registrado no tiene apellido, `bot/context` lo trata como dato faltante. Así el bot pide el apellido **antes** de confirmar los datos, con el prompt actual (sin tocar n8n).

> Metáfora: la maestra ve en la lista "Ana" sin apellido y lo pregunta al pasar lista, no cuando Ana ya va a salir.

| Archivo | Acción | Por qué |
|---|---|---|
| `src/lib/patient-intake.ts` | UPDATE | `intakeNeeds(known)`: `askName` en `true` también cuando `known.name` no pasa `isPlausibleFullName`. Nueva función pura `contextPatientView(known)` que manda `name: null` en ese caso |
| `src/app/api/internal/bot/context/route.ts` | UPDATE | Usar `contextPatientView` en `patient` (línea 107) |
| `tests/patient-intake.test.ts` | UPDATE | Casos: una palabra, nombre completo, relleno ("Paciente"), con título ("Dra. Ana") |

- **Validar:** pruebas en verde, y `curl` a `localhost:3000/api/internal/bot/context` (clave interna cargada en un subshell, nunca impresa) con el número de prueba → `patient.name: null`, `intake.askName: true`.
- **Forzar (si en la base real no hay un número de prueba con nombre de una palabra):** espejo con `/local-db-mirror refresh`, un `update` **solo en el espejo** del nombre de una cita de prueba, y la app con `DATABASE_URL=<espejo>`.
- **Fuera de C1:** el roce de "corregir su propio nombre" (`patient_phone_required` con otro nombre de pila, regla #72). Queda anotado en el ticket.
- **n8n (solo documentar):** la regla de errores del nodo `Bot Agent` (seguir el `message` de la herramienta). Va a `n8n/docs/cambios-n8n-2026-11-23.md`.

---

## C2 · #127: cambio de zona horaria, mínimo seguro (P1)

**Regla:** al cambiar la zona del negocio, las citas guardan su instante. El dueño ve **antes de guardar** cuáles citas futuras se verían a otra hora y tiene que confirmarlo. Si la zona guardada no coincide con la de la dirección, se le avisa y puede usar la de la dirección.

> Metáfora: si mueves el reloj de la pared, los niños que quedaron "a las 3" llegan a la misma hora de siempre, pero el reloj ahora dice otra. Antes de mover el reloj, te enseñamos la lista de esos niños.

| Archivo | Acción | Por qué |
|---|---|---|
| `src/lib/time-zone-change.ts` | CREATE | Función pura `zoneShiftImpact(visits, fromZone, toZone, businessHours)` → por cita: fecha, hora vieja, hora nueva y si queda fuera de horario. Usa `clinicTimeOf` |
| `tests/time-zone-change.test.ts` | CREATE | Mismo instante, misma hora, fuera de horario, sin citas, cambio de horario de verano en zonas que lo usan |
| `src/app/api/tenants/business/time-zone-impact/route.ts` | CREATE | `GET ?zone=`: solo OWNER, `tenantId` de la sesión, citas `PENDING`/`CONFIRMED` futuras con `deletedAt: null` |
| `src/app/api/tenants/business/route.ts` | UPDATE | Si cambia la zona y hay citas afectadas sin `confirmZoneShift: true`, responde 409 `time_zone_shift_unconfirmed` con la cantidad (la regla vive en el servidor) |
| `src/app/api/tenants/business/time-zone-check/route.ts` | CREATE | `GET`: compara la zona guardada con `lookupTimeZone` de las coordenadas guardadas (`mismatch`, `addressZone`) |
| [v3] — | regla | **Comparar por reloj, no por nombre.** La dirección de newy está en Monterrey (`/ubicacion` apunta a 25.67, -100.31) y su zona guardada es Ciudad de México. Son nombres distintos con la misma hora todo el año. El aviso sale solo si las dos zonas dan distinta hora en algún momento de los próximos 12 meses (función pura `sameClock(a, b, now)`, con pruebas: Monterrey = CDMX; Cancún ≠ CDMX; Tijuana ≠ CDMX) |
| `src/app/admin/negocio/page.tsx` | UPDATE | Aviso de zona distinta con botón "Usar la zona de la dirección"; al cambiar la zona, la lista de citas afectadas y una casilla de confirmación (sin diálogo nativo) |
| `src/i18n/es.ts`, `en.ts`, `types.ts` | UPDATE | Texto corregido de `timeZoneChangeNotice`; textos nuevos del aviso, la lista y el error |
| `tests/time-zone-guard.test.ts` | revisar | Que el archivo nuevo no use un offset fijo |

- **Textos por defecto con la zona:** reviso si el recordatorio, la confirmación y la cancelación por defecto ya dicen la zona. Si no, agrego la etiqueta de zona (ya existe el valor `zona` en `renderTemplate`), con prueba. Te muestro el texto antes de que llegue a un cliente.
- **Validar en la app local sobre la base real (newy):** abrir `/admin/negocio`, elegir otra zona y ver la lista y la casilla. **Tú decides si se guarda**: guardar cambia la zona real de newy. Si se guarda, la regresamos a la original al terminar y lo comprobamos.
- **No se hace:** recalcular citas ni mover eventos de Google. Queda en #127 para la siguiente ola.
- ~~**n8n (solo documentar):** zona fija de Ciudad de México en el prompt y "decir siempre la zona".~~
- **[v2] n8n, revisado en solo lectura el 20-nov:**

  | Flujo | Editado | "Hoy es…" | Horario | Zona junto a la hora |
  |---|---|---|---|---|
  | Producción `NewAigent - WhatsApp Bot (Chat)` (activo, 47 nodos) | 20-nov 06:17 UTC | **Ya usa** `$json.timeZone` y `timeZoneLabel` | **Ya usa** `timeZoneLabel` | **Falta** |
  | Stage `… - Stage` (activo) | 19-nov 19:42 UTC | Sigue fija en `America/Mexico_City` | Sigue "(hora de Mexico)" | Falta |

  - `timeZone` y `timeZoneLabel` llegan al agente desde `bot/context` (cadena `Get Bot Context` → `Guard: Credits OK` → `Bot Agent`). Las 15 ejecuciones en producción después de la edición terminaron en `success`.
  - **Hallazgo:** la regla de privacidad del prompt dice "Nunca menciones formatos técnicos (… UTC, **zonas horarias**)…". Eso choca con decir "3:00 p.m., hora de Ciudad de México" y explica la ejecución 21957 (la herramienta devolvió la zona y el bot no la dijo). Propuesta para pegar a mano: prohibir solo los nombres técnicos (`America/…`, UTC, offsets) y pedir **siempre** `timeZoneLabel` junto a la hora de una cita.
  - Stage queda igual que antes del cambio. Si se prueba algo en stage, la zona sale fija.
  - Va en `n8n/docs/cambios-n8n-2026-11-23.md`. **Sin escribir en n8n.**
  - **Qué probamos de esto (hoy, sin código nuevo):** casos C2-W1 y C2-W2 del set de pruebas.

---

## C3 · #74: ubicación en la confirmación y `..` al guardar

**Regla:** toda confirmación de una cita presencial lleva la ubicación del negocio, igual que el recordatorio. Un texto con `..` después de una etiqueta se marca al guardar.

> Metáfora: la invitación de la fiesta siempre lleva la dirección, no solo la primera vez que la mandas.

| Archivo | Acción | Por qué |
|---|---|---|
| `src/app/api/internal/bot/confirm/route.ts` | UPDATE | Respuesta al SI con `withLocation` (seleccionar los campos de ubicación del negocio) |
| `src/lib/reminder-actions.ts` | UPDATE | `VisitForAction.locationText` opcional; `ownerConfirmationText` usa `withLocation` |
| `src/app/api/apps/whatsapp/confirmations/[id]/route.ts` | UPDATE | Pasar `locationText` (pestaña Confirmaciones) |
| `src/app/api/appointments/[id]/route.ts` | UPDATE | Pasar `locationText` (botón Confirmar de Citas, línea 188) |
| `src/lib/reminder-template-rules.ts` | UPDATE | Nuevo problema `double_period_after_tag` en `templateIssues`, con `suggestFix` |
| `src/i18n/*` | UPDATE | Texto del problema nuevo |
| `tests/location-line-text.test.ts`, pruebas de reminder-messages | UPDATE | SI, dueño, en línea sin ubicación, negocio sin local físico, `..` |

- **Validar:** Confirmar desde Citas sobre una cita de prueba presencial de newy → **manda un WhatsApp real** al número de prueba (te aviso antes). `curl` a `bot/confirm` local para el texto del SI. Tarjeta "Recordatorios y confirmación" con un texto de prueba con `]..` → se marca (**no guardamos**).
- **Forzar el recordatorio:** `/local-wa-test` "default texts, reply SI" en el espejo, con la cita a nombre del usuario de prueba (hallazgo 3).

---

## C4 · #129: no pasar a una persona si nadie la pidió

**Regla:** `bot/help` acepta `person_requested` solo si el último mensaje del cliente pide una persona, con la misma regla del filtro de n8n (`asksForPerson`, `src/lib/person-request.ts`).

> Metáfora: solo llamas a la maestra si el niño levanta la mano, no porque dijo "es para mi hermana".

| Archivo | Acción | Por qué |
|---|---|---|
| `src/lib/help-person-check.ts` | CREATE | Regla pura `personRequestAllowed(reason, lastInboundText)` |
| `src/lib/help-handler.ts` | UPDATE | Con `person_requested`, leer el último mensaje entrante del chat (`whatsapp_messages`, `fromMe: false`, mismo `tenantId`) y responder `{ raised: false, reason: "not_requested" }`, sin pausar el bot |
| `tests/help-person-check.test.ts` | CREATE | "quiero hablar con una persona" sí; "es para mi hija, su número es…" no; sin mensaje no |

- **Riesgo:** si n8n llama a la herramienta antes de que `Write Customer Message` guarde el mensaje, el servidor no lo encuentra y rechaza. Lo reviso en solo lectura (`/n8n`) antes de dar C4 por bueno. Si hay carrera, se acepta la petición cuando no hay mensaje (falla abierta).
- **Validar:** `curl` local a `bot/help` con el chat de prueba: un mensaje con petición explícita y otro sin ella.

### [v5] Explicación: quién decide pasar el chat a una persona (y por qué un cliente enojado ya no basta)

**El contexto.** Cuando un paciente escribe por WhatsApp, el mensaje pasa por el flujo de n8n "NewAigent - WhatsApp Bot (Chat)". Ahí hay **dos caminos** que pueden pasar el chat a una persona del equipo. Las dos terminan en el mismo endpoint de la app, `POST /api/internal/bot/help`, con el motivo `person_requested`. Ese endpoint pausa el bot para ese contacto y avisa al asistente o al dueño.

| Camino | Quién decide | Cómo decide |
|---|---|---|
| 1. Filtro fijo **"Guard: Person Request"** (nodo de n8n, antes del agente) | Una regla de palabras, sin IA | El mensaje trae palabras explícitas: "quiero hablar con una persona", "un asesor", "que me llamen"… Es la misma regla que `asksForPerson` en `src/lib/person-request.ts` |
| 2. El **agente de IA** (nodo "Bot Agent") con su herramienta `request_human_help` | El modelo, siguiendo su prompt | El prompt (sección "TRASPASO A UNA PERSONA") le dice que la use cuando el cliente pide una persona **"o cuando esté molesto o enojado"** |

**Qué pasó en #129.** El cliente agendaba para su hija y dio el nombre, la edad y su propio número. Nadie pidió una persona, pero el agente (camino 2) decidió por su cuenta llamar `request_human_help`. El bot se pausó, el dueño recibió un aviso falso y la cita no se agendó.

**Qué hace C4 (commit `66c8d8b`).** Ahora la app revisa también al **camino 2**: solo acepta `person_requested` si algún mensaje del cliente en ese turno trae las palabras explícitas del camino 1. Si no las trae, responde `not_requested`, no pausa el bot y no avisa a nadie.

**El punto que te señalé.** El prompt le permite al agente pasar el chat cuando el cliente está **molesto o enojado**, aunque no pida una persona. Con C4, ese caso ya **no** pasa el chat: un cliente que escribe "esto es una pésima atención, llevo 3 días esperando" sin pedir una persona se queda con el bot.

**Tu decisión (20-nov).** Se queda así. **Regla de negocio: el chat pasa a una persona solo cuando el cliente la pide con palabras reconocibles.** El enojo solo no basta. Hoy en producción ya funciona así, porque el agente casi nunca usa ese permiso; C4 lo hace regla fija.

> Metáfora: en el salón, la maestra viene cuando un niño levanta la mano y dice "¡maestra!". Si un niño solo está enojado, el ayudante (el bot) sigue atendiéndolo; la maestra no llega por adivinar caras.
> Ejemplo: "Quiero hablar con alguien del equipo" → pasa a una persona. "Es para mi hija, su número es 81…" → el bot sigue y agenda. "¡Qué mal servicio!" → el bot sigue y responde.

**Lo único que hay que acomodar en n8n (solo documentar, va en las notas para pegar a mano):**
- Quitar "o cuando esté molesto o enojado" del prompt y de la descripción de la herramienta, para que el prompt diga lo mismo que la regla.
- Si la herramienta responde `raised: false` (`not_requested`), el agente **no** debe decir "una persona del equipo te dará seguimiento". Hoy lo dice en la misma respuesta en que llama la herramienta, así que prometería una persona que no va a llegar.

---

## C5 · [v4] Texto legible sobre el color principal y correo opcional

**Regla:** el texto sobre el color principal del negocio es oscuro cuando ese color es claro, y blanco cuando es oscuro. Así siempre se lee.

> Metáfora: en una hoja rosa clarito escribes con lápiz negro; en una hoja azul marino, con gis blanco.

| Archivo | Acción | Por qué |
|---|---|---|
| `src/lib/theme-vars.ts` | UPDATE | `--on-primary` sale de `readableTextOn(rgb del color principal)` en lugar de `#ffffff` fijo. Se quita el comentario de la decisión del 11-nov |
| `tests/theme-vars.test.ts` | UPDATE | `#ffaca3` da texto oscuro con contraste ≥ 4.5:1; un azul marino da blanco; sin color, el verde por defecto |
| `src/app/admin/apariencia/page.tsx` | revisar | La vista previa ya usa `preview["--on-primary"]`: que muestre el color nuevo |
| `src/i18n/es.ts`, `en.ts` (línea 1494) | UPDATE | `booking.email`: sin `*` (el campo es opcional) |

- ~~**Lo que no se barre en esta ola:** unos 29 usos viejos de `bg-primary ... text-white` (apps, pacientes, pedidos, WhatsApp, Navbar, ProductCard…) siguen en blanco. Los botones `btn-primary`, `FilterChip` y `RadioOption` sí cambian. Quedan anotados para la siguiente ola.~~ **[v4] Sí se barren** (32 líneas en 22 archivos): sin eso, la misma pantalla mezclaba texto oscuro y blanco sobre el mismo color.

| Caso | Dónde | Tú | Hoy | Después | Res. |
|---|---|---|---|---|---|
| ~~C5-1~~ | ~~Lo hago yo: contraste calculado en la página local~~ | — | ~~1.8:1~~ | ~~≥ 4.5:1 en el botón "New visit"~~ | **OK: 9.87:1** (texto `#111827` sobre `#ffaca3`). `C5/C5-1-citas-boton-legible.png` |
| ~~C5-2~~ | ~~newy local: Citas, Servicios, FAQ, Carrusel, Equipo y `/agendar`~~ | — | ~~Blanco sobre rosa~~ | ~~Texto oscuro sobre rosa~~ | **OK**: botón, chips (Today, All) y día del calendario en oscuro. [v4] Para no dejar la pantalla mezclada se barrieron las **32 líneas** de `bg-primary … text-white` (panel y tienda) a `--on-primary`, con una prueba que impide que vuelva. `C5/C5-2-citas-chips-y-boton.png` |
| ~~C5-3~~ | ~~doctorgcenter local, **solo ver** (mismo color)~~ | — | ~~Blanco~~ | ~~Oscuro~~ | **OK** (solo lectura): `--on-primary` `#111827`; "Sign in" y "Book appointment" en oscuro. `C5/C5-3-doctorgcenter-publico.png` |
| ~~C5-4~~ | ~~Apariencia (local): elegir un color oscuro en la vista previa, **sin guardar**~~ | — | — | ~~La vista previa pasa a texto blanco~~ | **OK** (sin guardar): `#1d4ed8` da `#ffffff`; el rosa de newy da `#111827` |
| ~~C5-5~~ | ~~`/agendar`~~ | — | ~~"Email \* (optional)"~~ | ~~"Email (optional)"~~ | **OK**: "Email (optional)". La otra etiqueta "Email \*" (otro formulario, obligatorio) no se tocó |

## C6 · Documentación y evidencia (commit final)

**[v5] Hecho (20-nov):**

| Archivo | Qué lleva |
|---|---|
| `n8n/docs/cambios-n8n-2026-11-23.md` | 4 cambios para pegar a mano: zona junto a la hora (#127), seguir el `message` de la herramienta (#128), pasar a una persona solo cuando la pide (#129, **urgente antes del deploy**) y la zona en stage |
| `docs/CHANGELOG.md` | Sección "wave of 2026-11-23" |
| `docs/STATUS.md` | Pendientes: deploy y pruebas del lunes, n8n, recálculo de #127, roce de #128, datos de newy, citas de prueba |
| `.claude/rules/newaigent/whatsapp-bot.md`, `time-zone-and-short-links.md`, `reminders.md`, `ui-tenant.md` | Las reglas nuevas, para que Claude y el equipo las lean al tocar esas partes |
| `docs/screenshots/ola-23-nov/` | 7 recortes sin correos, teléfonos ni nombres reales: aviso de zona, citas que cambian de hora, doble punto, nombre sin apellido y botón/filtros antes y después |
| Este plan | Se sube con la ola. Teléfonos enmascarados (`…2968`) y sin ids de n8n |

No se regeneraron los codemaps (`/ecc:update-codemaps`): queda opcional, después del deploy.

- [v4] `.claude/rules/newaigent/ui-tenant.md`: la regla de `--on-primary` cambia ("blanco para todos" → "legible según el color").

- `docs/CHANGELOG.md`, `.claude/rules/newaigent/whatsapp-bot.md`, `time-zone-and-short-links.md`, `reminders.md` y `docs/STATUS.md` (pendientes: recálculo de #127, roce de #128, n8n).
- `n8n/docs/cambios-n8n-2026-11-23.md`: cambios del prompt para pegar a mano (#127, #128, #129). **Sin escribir en n8n.**
- Capturas elegidas en `docs/screenshots/ola-23-nov/<ticket>/`, **sin nombres ni teléfonos reales** (el repo es público): solo el usuario de prueba, con el teléfono tapado.

## Set de pruebas por ronda [v2]

Cómo leer las tablas:
- **Tú** = lo que escribes en la pantalla o mandas por WhatsApp desde el teléfono de prueba al número de newy.
- **Hoy** = lo que pasa con el código desplegado ahora (sirve como evidencia del "antes").
- **Después** = lo esperado con el commit de la ronda (en local) o después del deploy (WhatsApp).
- `<Nombre Apellido>` = el nombre del usuario de prueba. `<tu número>` = su WhatsApp.
- Cuando validemos un caso, tacho la fila y pongo el resultado en "Res." (OK o FALLA, con la captura).

Mandar un WhatsApp a newy pasa por n8n de **producción** y gasta créditos de newy. Te aviso antes de cada caso que use tu número.

### R0 · #113 y #116 (producción desplegada)

| Caso | Dónde | Tú | Esperado | Res. |
|---|---|---|---|---|
| ~~R0-1~~ | ~~Citas → Nueva cita~~ | ~~Nombre `Ana`, cualquier servicio y hora~~ | ~~Error de nombre y apellido en el campo; no se guarda~~ | **OK**: al salir del campo dice "Enter the patient's first name and surname." Sin guardar. `R0-1-R0-3-nueva-cita-nombre-ana.png` |
| ~~R0-2~~ | ~~Citas → Nueva cita~~ | ~~Nombre `<Nombre Apellido>`, `<tu número>`, mañana~~ | ~~Se crea. Esta cita se usa después en C2 y C3~~ | **OK**: "Ana Garza", lunes 23-nov, presencial, "Visit created." e invitación de Google con la dirección de Monterrey. Ojo: el panel dice 3:30 PM y Google 2:30 PM CST (ver hallazgos) |
| ~~R0-3~~ | ~~Citas → Nueva cita~~ | ~~Abrir el formulario~~ | ~~No aparece "Para otra persona"~~ | **OK**: el formulario no tiene la opción (misma captura) |
| ~~R0-4~~ | ~~Citas → Eliminadas~~ | ~~Eliminar la cita de R0-2 y ver la fila~~ | ~~"Recuperar" visible (es futura); recuperarla después~~ | **OK**: borrado suave ("Deleted by NewyAI"), Google mandó la cancelación, "Restore" visible y **"Visit restored."** La cita sigue para C2 y C3. `R0-4-eliminada-con-restaurar.png` |
| ~~R0-5~~ | ~~`/agendar` en una ventana sin sesión~~ | ~~Nombre `Ana`~~ | ~~Aviso antes de enviar~~ | **OK**: al pulsar sale "Enter the patient's first name and surname." y no se guardó nada (la revisión es al pulsar, `BookingFlow.tsx:160`) |
| ~~R0-6~~ | ~~WhatsApp, chat contigo mismo~~ | ~~Mandar `https://newy.newaigent.com/ubicacion`~~ | ~~Tarjeta con la descripción en español, sin "This page doesn't exist"~~ | **OK con nota**: ya no sale la tarjeta rota. No sale ninguna porque el enlace va directo a Google Maps. La tarjeta en español es de la página del negocio (R0-7). Tarjeta para `/ubicacion`: fuera de la ola |
| ~~R0-7~~ | ~~Lo hago yo~~ | ~~`curl -A "WhatsApp/2.0"` a la página de newy~~ | ~~`og:description` en español, con imagen y url~~ | **OK** (20-nov): descripción en español, `og:image`, `og:url`, `og:locale es_MX`. `/ubicacion)` → 307 a `/ubicacion` → 302 a Google Maps. Confirma que `2b89146` está desplegado |
| ~~R0-8~~ | ~~Citas, Servicios, FAQ, Carrusel, Equipo~~ | ~~Ver el botón de crear (claro y oscuro)~~ | ~~Mismo estilo; texto legible sobre el color de newy~~ | **Mismo estilo: OK** (los 5 usan `btn-primary`). **Legible: FALLA conocida**: texto blanco sobre `#ffaca3`, contraste **1.8:1** (lo mínimo es 4.5:1). Es la decisión de producto del 11-nov (`src/lib/theme-vars.ts:39`): `readableTextOn` existe pero no se aplica. Modo oscuro: el panel no cambia con el modo del sistema (`<html class="light">`). `R0-8-citas-boton-claro.png` |

### C1 · #128 apellido

| Caso | Dónde | Tú | Hoy | Después | Res. |
|---|---|---|---|---|---|
| [v4] C1-0 | Pruebas | — | — | `intakeNeeds` y `contextPatientView`: 4 pruebas nuevas y una de cableado. Suite: 1151 OK, 0 fallas; `tsc` limpio | **OK** |
| C1-F | Espejo (forzar) | Nada: yo pongo un nombre de una palabra a tu cita de prueba **solo en el espejo** | — | — | [v4] Consulta de solo lectura: newy tiene **1 paciente** (Ana Garza), con nombre completo. Falta forzar el caso |
| ~~C1-1~~ | ~~Lo hago yo: `curl` a `bot/context` local~~ | — | ~~`patient.name` = el nombre de una palabra, `askName: false`~~ | ~~`patient.name: null`, `askName: true`~~ | **OK** (20-nov). La cita de newy `…1960` se renombró a "Ana" (aprobado). Producción: `name: "Ana"`, `askName: false`. Local: `name: null`, `askName: true`. `C1/context-prod.json`, `C1/context-local.json` |
| ~~C1-2~~ | ~~Lo hago yo: `curl` a `bot/context` local con un nombre completo~~ | — | ~~Nombre completo~~ | ~~Igual (sin cambio)~~ | **OK por prueba unitaria** ("Ana Lopez", "Dra. Ana López", "María de la Luz" no se vuelven a pedir) |
| [v4] C1-R | Revisión y build | — | — | `/ecc:code-review`: 0 críticos, 0 altos, 1 medio (abajo). Pruebas 1151 OK, `tsc` limpio, `npm run build` OK. Lint: el repo no tiene ESLint configurado | **OK. Commit `c0ccd8c`** "fix: ask surname when the stored name has none (#128)" |
| C1-W (lunes) | WhatsApp | `Hola` → `Quiero agendar una consulta` → elegir día y hora → contestar el apellido cuando lo pida | A veces "No pude completar la acción…" (21885) | Pide el apellido **antes** de confirmar los datos; la cita queda con nombre y apellido. Repetir 3 veces (entre cada una: `Cancela mi cita`) | |

Para C1-W hace falta que en producción tu número tenga guardado un nombre de una sola palabra. Eso es una escritura en la base real y **te la pido aparte** el lunes.

### C2 · #127 zona horaria

| Caso | Dónde | Tú | Hoy | Después | Res. |
|---|---|---|---|---|---|
| C2-W1 | WhatsApp (hoy, n8n ya cambiado) | `¿A qué hora abren mañana?` | Horario con "hora de <zona de newy>" | — | |
| C2-W2 | WhatsApp (hoy) | Agendar una cita completa (`Quiero agendar…`, día y hora, `Sí`) | Esperado por el hallazgo: la confirmación del bot **no** dice la zona | Se corrige solo con el cambio del prompt (a mano), no con el código | |
| [v4] C2-0 | Pruebas | — | — | `time-zone-change` (sameClock y zoneShiftImpact, 6 pruebas), textos por defecto con zona, `renderTemplate` sin zona, 3 pruebas de cableado. Suite: 1159 OK, 0 fallas; `tsc` limpio | **OK** |
| C2-1 | `/admin/negocio` (local) | Anotar la zona actual de newy | — | — | [v4] Ya anotada en R0: **Cancún** (dirección en Monterrey) |
| ~~C2-2~~ | ~~`/admin/negocio` (local)~~ | ~~Elegir `Cancún` en la lista, **sin guardar**~~ | ~~Solo el aviso viejo ("no se mueven de hora")~~ | ~~Lista con la cita de R0-2: hora vieja y nueva; casilla de confirmación; Guardar pide la casilla~~ | **OK** (20-nov, sin guardar). newy ya estaba en Cancún, así que se probó al revés (Cancún → Monterrey): "Ana · Check Up Ginecológico: Mon, Nov 23 15:30 → 14:30 · outside your hours" y la casilla. `C2/C2-2-citas-que-cambian-de-hora.png` |
| ~~C2-3~~ | ~~Lo hago yo: `PATCH` local sin `confirmZoneShift`~~ | — | ~~Se guarda~~ | ~~409 `time_zone_shift_unconfirmed` con la cantidad~~ | **OK**: 409, `count: 1`, `toZone: America/Monterrey`; la zona siguió en Cancún |
| ~~C2-4~~ | ~~`/admin/negocio` (local)~~ | ~~Guardar `Cancún` con la casilla (**escritura real, te la pido**) y recargar~~ | — | ~~Aviso "tu zona no coincide con la de tu dirección" y el botón~~ | **OK sin escribir**: newy ya tenía la diferencia. "Your time zone (Cancun time) does not match the zone of your address (Monterrey time)" y el botón "Use the address zone", que cambia la lista a Monterrey y oculta el aviso. `C2/C2-4-aviso-zona-distinta.png` |
| ~~C2-5~~ | ~~`/admin/negocio` (local)~~ | ~~Botón "Usar la zona de la dirección" y Guardar~~ | — | ~~Regresa a la zona original; el aviso desaparece~~ | **OK** (aprobado): casilla marcada y guardado. newy queda en **America/Monterrey** (manual), sin aviso. En Citas la cita de Ana pasa a **02:30 PM**, igual que la invitación de Google. `C2/C2-5-casilla-marcada.png` |
| [v4] C2-R | Revisión y build | — | — | Revisión: 0 críticos, 0 altos. Las rutas nuevas son solo del dueño, toman el `tenantId` de la sesión y validan la zona. Se agregó `force-dynamic` (el build intentaba prerenderizarlas). El aviso también se oculta con una zona de la misma hora. 1162 OK, `tsc` limpio, build limpio | **OK. Commit `654e8f1`** "fix: confirm zone changes that shift booked visits (#127)" |
| C2-6 | Lo hago yo: textos por defecto | — | Sin zona | Con la zona (te muestro el texto antes del commit) | [v4] **Para revisar**: "*Hora:* 02:30 p.m. (hora de Ciudad de México)". Cambian el recordatorio, la cancelación, la respuesta al SI y la confirmación del dueño, solo donde el negocio no tiene texto propio. doctorgcenter usa la **cancelación por defecto**, así que la suya también cambia |

### C3 · #74 ubicación y `..`

| Caso | Dónde | Tú | Hoy | Después | Res. |
|---|---|---|---|---|---|
| ~~C3-1~~ | ~~Citas → cita de R0-2 (presencial) → Confirmar (local, **manda WhatsApp real**)~~ | ~~Clic en Confirmar~~ | ~~Mensaje sin ubicación~~ | ~~Mensaje con "Ubicación: <dirección> (<enlace>)"~~ | **OK** (aprobado, [v4] con **el número de prueba `…2968`**, no `…1960`): cita nueva "NewyTestIII PruebApellido", martes 24-nov 16:00, presencial. Confirmar: la cita pasa a Confirmed y en el outbox hay `TRANSACTIONAL` **SENT** a `***2968`. Falta tu captura del WhatsApp recibido |
| ~~C3-2~~ | ~~Lo hago yo: `curl` a `bot/confirm` local con `"text":"si"`~~ | — | ~~Respuesta sin ubicación~~ | ~~Con la ubicación~~ | **OK**: "…a las 04:00 p.m. (hora de Monterrey) queda confirmada." + "Ubicación: Ignacio Allende, Centro, 64000 Monterrey, N.L., México. Cómo llegar: https://newy.newaigent.com/ubicacion". `C3/bot-confirm-local.json` |
| [v4] C3-R | Revisión y build | — | — | 0 críticos, 0 altos. Bajo: `bot/confirm` importa `reminder-actions` solo por el select del lugar (acoplamiento; se puede mover a `location.ts` después). 1171 OK, `tsc` limpio, build limpio | **OK, listo para commit** |
| [v4] C3-D | Cita `…1960` de R0-2 | — | — | — | **Borrada (borrado suave, aprobado)**: así producción no le manda recordatorio el lunes. C1-W pasa al número `…2968` |
| ~~C3-3~~ | ~~Recordatorios y confirmación → texto de confirmación~~ | ~~Escribir `Confirma antes de las [Hora límite].. Si no, se libera.` **sin guardar**~~ | ~~No se marca~~ | ~~Se marca el `..` con la sugerencia de arreglo~~ | **OK** (local, sin guardar): "There are two periods right after a tag…", fragmento `[Deadline time]..`, botón **Keep one period** y Guardar desactivado; con un clic queda un punto. Al enviar, un texto guardado con `..` sale con un punto y **no** cae al texto por defecto. `C3/C3-3-doble-punto-marcado.png` |
| [v4] C3-0 | Pruebas | — | — | `template-double-period` (5), ubicación en la confirmación del dueño (2), 2 de cableado. Suite: 1171 OK; `tsc` limpio | **OK** |
| [v4] C3-N | Hallazgo en newy | — | — | El texto de cancelación guardado de newy **empieza con `[Zona horaria]` pegado a "Hola"** ("hora de MonterreyHola…"). Es un dato de newy: no se tocó | Para decidir |
| C3-4 | Cita en línea (si newy la permite) | Confirmar | Enlace de videollamada | Igual, **sin** ubicación | |
| C3-F | `/local-wa-test default texts, reply SI` (espejo) | Lo escribes tú | Recordatorio sin ubicación | Recordatorio y respuesta al SI con la ubicación | |

### C4 · #129 traspaso sin pedirlo

| Caso | Dónde | Tú | Hoy | Después | Res. |
|---|---|---|---|---|---|
| C4-W1 | WhatsApp (hoy, evidencia del antes) | `Quiero agendar una cita para mi hija` → `Se llama <Nombre> <Apellido>, tiene 8 años, su número es <tu número>` | A veces "Un miembro de nuestro equipo te dará seguimiento…" y el bot se pausa (21864) | — | |
| [v4] C4-0 | Pruebas | — | — | `help-person-check` (6): agendar para la hija con el mismo número no cuenta; una petición explícita sí; cuenta todo el lote del turno; una petición de un turno ya contestado no; sin mensaje que leer, se acepta. Prueba de cableado: la revisión va **antes** de pausar. Suite: 1178 OK, `tsc` limpio | **OK** |
| C4-1 | Lo hago yo: `curl` a `bot/help` local, `person_requested`, último mensaje = el de la hija | — | Pausa el bot y avisa | `raised: false`, `not_requested`; el bot sigue | [v4] **No se corrió.** En el chat de `…2968` la última línea es del bot, así que la regla no tiene mensaje del cliente que leer y acepta (por diseño): la llamada local **pausaría el bot y avisaría al dueño**. En el flujo real el agente llama la herramienta antes de guardar su respuesta. Se prueba el lunes con C4-W |
| C4-2 | WhatsApp, luego `curl` local | `Quiero hablar con una persona` | Pausa y aviso | Igual: pausa y aviso (petición real) | |
| C4-3 | `/admin/whatsapp` | Volver a encender el bot de tu chat después de C4-2 | — | Bot encendido | |
| C4-W (lunes) | WhatsApp | El guion de C4-W1 | — | Agenda a la hija, sin pausa ni aviso | |

## Lunes: envío y humo (cada paso con aprobación aparte)

1. Push de `fix/ola-23-nov` y `/ecc:pr` (un PR con los 6 commits).
2. Deploy a producción: lo apruebas y lo ejecutas tú.
3. Humo con WhatsApp real sobre newy (te aviso antes de cada mensaje):
   - #128: nombre de una sola palabra, 3 veces; las 3 piden el apellido.
   - #129: agendar para la hija con el mismo número; el bot no se pausa y nadie recibe aviso.
   - #74: respuesta al SI con ubicación.
   - #127: el texto con la zona.
   - #116: vista previa del enlace.
4. Mover los tickets en el tablero: lo hago solo si me lo pides.

## Acciones que pido aparte (no las cubre la aprobación del plan)

| Acción | Cuándo |
|---|---|
| Crear la rama `fix/ola-23-nov` | Al aprobar el plan |
| Agregar `.evidence-ola-23/` a `.git/info/exclude` | Al aprobar el plan (archivo local, no se sube) |
| Editar `local-utils/reminder-live.ts` y `.claude/commands/local-wa-test.md` (nombres de prueba) | Solo si usamos `/local-wa-test` |
| ~~Cada WhatsApp real (Confirmar, recordatorio, humo)~~ **[v3] WhatsApp a tu número: te aviso antes de cada uno; la aprobación es una por ronda** | Al empezar cada ronda |
| ~~Guardar el cambio de zona de newy, y regresarla~~ **[v3] Escrituras en datos de newy (citas, zona, textos, nombre de C1-W): una aprobación por ronda** | Al empezar cada ronda |
| **[v3] Cualquier escritura fuera de newy, esquema, n8n o deploy** | Cada una por separado |
| `/local-db-mirror refresh` (lo escribes tú) | Solo si hay que forzar un caso |
| Cada commit | Al terminar cada ronda |
| Push, PR, deploy | Lunes |

## Patrones a seguir

| Categoría | Fuente | Patrón |
|---|---|---|
| Lógica pura con pruebas | `src/lib/time-zone-choice.ts`, `tests/time-zone-choice.test.ts` | Comentario de cabecera con el ticket, sin I/O, `node:test` |
| Errores de API | `src/app/api/tenants/business/route.ts:159` | `apiError("<codigo>", status)` con texto en i18n |
| Errores del bot como datos | `src/app/api/internal/bot/book/route.ts:155` | `{ success: false, error, message }` que el agente lee |
| Pruebas de cableado | `tests/qa-2026-11-20-wiring.test.ts` | Leer el archivo fuente y comprobar que usa la regla |
| Mensajes | `withMeetingLink` / `withLocation` (`src/lib/reminder-messages.ts:151`) | Agregar líneas al final, solo cuando aplica |

## Validación (cada commit)

```bash
npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build                      # con el servidor de desarrollo apagado
git diff --cached --name-only      # nada de local-utils/
git diff --cached | grep -c TEMP-TEST   # 0
```

[v4] Mensaje de commit: título de **60 caracteres o menos** y cuerpo a 60 por línea (solo la línea `Claude-Session` puede pasar).

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Probar en local escribe en producción | Alta | ~~Solo newy, solo datos del usuario de prueba, aviso antes de cada escritura, restaurar la zona~~ **[v3] Sin riesgo dentro de newy (negocio de pruebas). Cada consulta lleva el `tenantId` de newy desde la sesión. Antes de cada escritura confirmo que el blanco es newy** |
| [v3] Una prueba en newy pega a doctorgcenter | Baja | Solo un cambio global (esquema, deploy, n8n, la configuración de la plataforma) lo haría, y esos se piden aparte |
| Los cambios del bot no se ven en WhatsApp hasta el deploy | Segura | `curl` al endpoint local ahora; humo con WhatsApp real el lunes |
| #129 rechaza una petición real por una carrera en n8n | Media | Revisar el orden de los nodos con `/n8n` en solo lectura; si no hay mensaje, aceptar la petición |
| El texto por defecto con la zona cambia lo que leen los clientes de doctorgcenter | Media | Te muestro el texto antes del commit; los textos propios del negocio no cambian |
| `2b89146` no está desplegado | Baja | R0 lo revela antes de empezar |
| Poco tiempo para el lunes | Media | Orden por prioridad (C1 y C2 son P1); C4 puede quedar fuera sin afectar a los demás |

## Calendario

| Día | Rondas |
|---|---|
| Vie 20 / Sáb 21 | R0, C1, C2 |
| Dom 22 | C3, C4, C5, C6 y revisión completa |
| Lun 23 | Push, PR, deploy y humo |

## Fuera de esta ola

#108 y #115 (cambios de esquema), #95, #131 y #133 (sin especificación), #77 (solo n8n), y el recálculo automático de citas de #127. [v4] También: la tarjeta de vista previa de `/ubicacion`, y el barrido de los ~29 `bg-primary text-white` viejos.
