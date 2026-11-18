# #111 (ampliación): cada negocio tiene su zona horaria

Estado (2026-11-18): plan v1 **aprobado** en el canvas (fb-142). No se ha escrito código de esta parte.
Ticket: https://github.com/smartflows-ai/nutriologas/issues/111 · Va en el **mismo PR** que las partes 1 y 2 (decisión del dueño) · Capas: `App`, `Database`, `UI`, `External service` (Google)

## Decisiones ya respondidas

| # | Pregunta | Respuesta |
|---|---|---|
| D1 | ¿Ticket aparte o en el PR del #111? | **Mismo PR.** Consecuencia: al terminar se repiten los bloques B y C |
| D2 | ¿Quién elige la zona? | **El dueño en `/admin/negocio`** |
| D3 | ¿El paciente ve su propia hora? | **Fase 2.** Ahora solo se nombra la zona del negocio |
| D4 | ¿Cómo se detecta? | **Google Time Zone API** al guardar la dirección, más una lista para corregir y para negocios sin local |
| D5 | ¿Qué trae la lista? | **México + EE. UU. + LatAm** (unas 15). Si Google detecta otra zona, se agrega como opción de ese negocio |
| D6 | ¿Negocios existentes? | **Ciudad de México por default.** Google se usa la próxima vez que el dueño guarde su dirección |
| D7 | ¿Dónde se nombra la zona? | **En todas las respuestas del bot que llevan hora** y en la nueva etiqueta **[Zona horaria]** / **[Time zone]** |
| D8 | ¿En qué textos se permite la etiqueta? | **Recordatorio, confirmación y cancelación** |

## Lo que encontré (verificado en el código el 2026-11-17)

| Hecho | Consecuencia |
|---|---|
| `appointmentDate` ya se guarda en UTC | Las citas guardadas **no cambian**. Solo cambia cómo se leen y se escriben |
| La zona está fija: `America/Mexico_City` en 12 archivos y `-06:00` en 3 constantes (`clinic-time.ts:5`, `bot.ts:14`, `google-calendar.ts:5`) | Tres copias de la misma regla |
| Solo México tiene 11 zonas IANA: Cancún es -05:00, Hermosillo -07:00 y Tijuana tiene horario de verano | Un consultorio en Cancún hoy agendaría corrido una hora |
| 23 archivos usan los helpers de reloj; tres pantallas los usan **en el navegador** (`BookingFlow.tsx:173`, `useAppointmentForm.ts:74,178`, `admin/citas/page.tsx:152`) | La zona tiene que llegar también como dato a la pantalla, no solo al servidor |
| `bot/availability` le manda al bot el texto fijo `timezone: "America/Mexico_City (UTC-06:00)"` (`availability/route.ts:63`) | Es el único campo de zona que n8n recibe hoy |
| Outlook ya manda horas en UTC (`microsoft-calendar.ts:6`); Google manda `timeZone: "America/Mexico_City"` fijo (`google-calendar.ts:107,151`) | Google debe recibir la zona del negocio |
| `upcomingCalendarText` y `todayKey` calculan "hoy" con la zona fija (`business-hours.ts:153`) | El calendario de 14 días del bot depende de la zona |
| Los nombres que trae `Intl` en español confunden: Cancún sale "hora estándar oriental" y CDMX "hora estándar central" | La etiqueta es nuestra: "hora de Cancún", "hora de Ciudad de México" |
| `GOOGLE_MAPS_API_KEY` está restringida solo a "Places API (New)" (CLAUDE.md) | **Tú** tienes que activar Time Zone API y agregarla a la restricción de la llave |
| Node 26 trae `Temporal`, pero no todos los navegadores | La conversión se hace con `Intl`, que funciona en el servidor y en el navegador, sin librería nueva |
| No hay columna de zona en `tenants` | Cambio en la base: `prisma/sql/28-tenant-time-zone` |

Metáfora: hoy todos los relojes de la app están pegados a la pared de la Ciudad de México. Si un consultorio abre en Cancún, su reloj sigue marcando la hora de la CDMX. El plan le da a cada consultorio su propio reloj, con su nombre escrito abajo.

## Reglas

**R1. Lo guardado es un instante universal (UTC); la zona solo se usa al entrar y al salir.**
En palabras simples: todos miran el mismo reloj grande; cada quien traduce a su hora solo cuando lee o escribe.
Ejemplo: la cita de Ana en Cancún a las 10:00 se guarda como `15:00Z`. La lista del bot dice "10:00 a.m., hora de Cancún".

**R2. Cada negocio tiene una sola zona con nombre (`Tenant.timeZone`, IANA). Todo lo del negocio la usa:** horario semanal, horas libres, recordatorios, bot, calendario, panel, `/agendar` y `/mis-citas`.
En palabras simples: la tienda tiene un reloj en la pared y todos los empleados lo miran a él, no al de su celular.
Ejemplo: el horario "lunes 09:00-18:00" de un negocio en Tijuana se lee en la hora de Tijuana, con o sin horario de verano.

**R3. Un solo módulo convierte (`src/lib/clinic-time.ts`) y recibe la zona como dato. No queda ningún `-06:00` ni `America/Mexico_City` fuera de ese módulo**, salvo el default.
En palabras simples: un solo traductor oficial; si hay dos, un día dicen cosas distintas.
Ejemplo: una prueba falla si aparece `"-06:00"` o `America/Mexico_City` en otro archivo de `src/`.

**R4. La zona sale de la dirección cuando existe, y el dueño siempre la puede corregir.**
En palabras simples: el cartero sabe en qué zona está tu casa; si no tienes casa (solo atiendes en línea), tú se lo dices.
Ejemplo: Beto guarda su dirección en Hermosillo y la zona se pone sola en `America/Hermosillo`. Carla atiende solo en línea y elige "Ciudad de México" en la lista.

**R5. Siempre que el bot dice una hora, sabe nombrar la zona; los textos del negocio la nombran solo si usan [Zona horaria].**
En palabras simples: el bot lleva la etiqueta "hora de Cancún" lista en la mano; el dueño decide si la pone en su recordatorio.
Ejemplo: `my-appointments` trae `timeZone: "America/Cancun"` y `timeZoneLabel: "hora de Cancún"`. El recordatorio "Tu cita es a las [Hora] ([Zona horaria])" llega como "Tu cita es a las 10:00 a.m. (hora de Cancún)".

## Diseño

### 1. Base de datos (primero la base, después el código)
- `prisma/sql/28-tenant-time-zone/up.sql`:
  - `ALTER TABLE "tenants" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Mexico_City';`
  - `ALTER TABLE "tenants" ADD COLUMN "timeZoneSource" TEXT NOT NULL DEFAULT 'default';` con los valores `default`, `google` o `manual`. Sirve para saber si una dirección nueva debe volver a detectar la zona: `Tenant` no tiene un campo JSON libre donde guardarlo.
  - Es aditivo: el código viejo ignora ambas columnas y todos los negocios quedan como hoy.
- `down.sql`: `DROP COLUMN "timeZoneSource"` y `DROP COLUMN "timeZone"`.
- `schema.prisma`: `timeZone String @default("America/Mexico_City")` y `timeZoneSource String @default("default")` en `Tenant`.
- Se prueba en el espejo con `/local-db-mirror test-sql` (diff antes, después de up y después de down). Para aplicarlo en producción hace falta un respaldo verificado y tu aprobación, y debe ir **antes del merge**.

### 2. Módulo de reloj (`src/lib/clinic-time.ts`, sin código de servidor)
- `DEFAULT_TIME_ZONE = "America/Mexico_City"` y `isValidTimeZone(zone)` (con `Intl`).
- Todas las funciones reciben `zone` como último parámetro: `clinicDateTime(date, time, zone)` (de hora de pared a instante, con el offset correcto de **ese** día, así cubre el horario de verano), `clinicDateKeyOf`, `clinicTimeOf`, `clinicTimeLabel`, `clinicWeekdayOf`, `addClinicDays` (no cambia) y una nueva `clinicOffsetOf(date, zone)`.
- La conversión de hora de pared a instante usa `Intl.DateTimeFormat(...).formatToParts` en dos pasadas (se calcula el offset y se corrige), sin librería nueva.
- `CLINIC_TIME_OFFSET` desaparece. `BOT_TIMEZONE_OFFSET` (`bot.ts:14`) y `TIMEZONE_OFFSET` (`google-calendar.ts:5`) también.

### 3. Zonas y etiquetas (`src/lib/time-zones.ts`, nuevo, puro)
- `TIME_ZONE_OPTIONS`: unas 15 opciones con valor IANA, etiqueta para el dueño y etiqueta para el paciente, en es y en:
  - México: Centro (`America/Mexico_City`: CDMX, Guadalajara, Monterrey), Quintana Roo (`America/Cancun`), Pacífico y Sonora (`America/Mazatlan` y `America/Hermosillo`), Baja California (`America/Tijuana`).
  - EE. UU.: Este (`America/New_York`), Centro (`America/Chicago`), Montaña (`America/Denver`), Pacífico (`America/Los_Angeles`).
  - LatAm y España: Bogotá, Lima, Santiago, Buenos Aires, Madrid.
- `timeZoneLabel(zone, language)`: "hora de Cancún" / "Cancun time". Para una zona fuera de la lista (detectada por Google) se arma con el último tramo del nombre IANA ("hora de Bahia Banderas").
- `suggestTimeZoneForPhone(phone)`: la propuesta inicial por lada cuando no hay dirección (+52 → CDMX, +1 → Este de EE. UU., +57 → Bogotá, etc.; si no se conoce, CDMX).

### 4. Google Time Zone API (`src/lib/time-zone-lookup.ts`, nuevo, con la red inyectada)
- `lookupTimeZone(lat, lng, deps)` llama a `https://maps.googleapis.com/maps/api/timezone/json?location=<lat>,<lng>&timestamp=<ahora>&key=<GOOGLE_MAPS_API_KEY>` (solo en el servidor). Devuelve `timeZoneId` si `status = "OK"` y la zona es válida, y `null` en cualquier otro caso (sin llave, cuota, error o tiempo agotado a los 5 s).
- Se llama solo cuando se guarda una dirección con coordenadas: en `PUT /api/tenants/business` y en `POST /api/tenants/register`.
- Si devuelve `null`, la zona no cambia (registro: la propuesta por lada) y el guardado de la dirección **no falla**.
- Nunca se registra la llave ni la respuesta completa en el log (solo el `status`).

### 5. Pantalla `/admin/negocio` (tarjeta "Ubicación y responsable")
- Nuevo campo "Zona horaria": un select con `TIME_ZONE_OPTIONS`, más la zona actual si no está en la lista.
- Al elegir una dirección, después de guardar se muestra la zona detectada: "Detectamos: hora de Cancún. Puedes cambiarla".
- Si el dueño cambia la zona y hay citas futuras: aviso "Tus citas ya agendadas no se mueven; tu horario semanal se leerá en la nueva zona".
- `PUT /api/tenants/business` acepta `timeZone` (validado con `isValidTimeZone`, error `time_zone_invalid`). Si el dueño la eligió a mano, se respeta aunque cambie la dirección: la columna `timeZoneSource` guarda `manual`. Una dirección nueva solo vuelve a detectar la zona si el origen es `default` o `google`.
- Tokens de tema y sin colores fijos; se corren `audit.js` y `theme-colors.js` sobre los archivos tocados.

### 6. Toda la app usa la zona del negocio
- **Servidor:** `resolveBotTenant` y `loadReminderVisits` seleccionan `timeZone`; `buildSlot`, `free-slots`, `business-hours` (`todayKey`, `upcomingCalendarText`), `calendar-sync`, `appointments-service` (`dateKeyInClinicZone`), `panel-appointments*`, `api/appointments*`, `execute-tool` (Newy AI), `reminder-messages` (`clinicLongDate`, `clinicTime`), `reminder-run`, `reminder-actions`, `bot/confirm` y `historial` reciben la zona del negocio que ya cargan.
- **Navegador:** la página pasa `timeZone` como dato a `BookingFlow`, `useAppointmentForm`, `AppointmentFormPanel`, `admin/citas`, `PendingConfirmations`, `VisitNoteDialog` y `CustomerAppointmentsList` (`/mis-citas`). Hoy esta última usa la zona del navegador: con el cambio usa la del negocio y la nombra.
- **Google Calendar:** `timeZone` del evento = zona del negocio.

### 7. Bot (lo que recibe n8n)
- `botVisitTime` y `botVisitView` reciben la zona: `startsAt` lleva el offset real de ese día y se agregan `timeZone` y `timeZoneLabel`.
- `my-appointments`, `reschedule`, `cancel` y `book` agregan `timeZone` y `timeZoneLabel`.
- `availability`: `timezone` deja de ser fijo y pasa a `"<IANA> (UTC<offset>)"` (mismo formato de hoy), más `timeZoneLabel`.
- `context`: agrega `timeZone` y `timeZoneLabel`. `calendarText` se calcula en la zona del negocio.

### 8. Etiqueta [Zona horaria] / [Time zone]
- `reminder-template-rules.ts`: nueva etiqueta `zona` con `labelKey: "tokenTimeZone"`, válida en los tres textos.
- `renderTemplate` la llena con `timeZoneLabel(zone, messageLanguage)`.
- i18n: `crm.business.tokenTimeZone` ("Zona horaria" / "Time zone") y el botón en la tarjeta "Mensajes al cliente" de los tres campos.
- No hace falta `unfilledFields`: la zona siempre existe (default).

## Lo que no cambia
- Las citas guardadas, los textos propios de cada negocio (salvo que el dueño agregue la etiqueta) y los recordatorios de los negocios existentes, que siguen en Ciudad de México.
- Outlook, que ya manda UTC.
- **n8n: nada obligatorio.** El bot ya recibe la hora resuelta y ahora también la etiqueta de la zona. Después del código se hace una **revisión en modo lectura** del prompt del chat (`N4DNdKbCnkxEqZFl`) para ver si dice "hora de México" o usa `timezone`. Si conviene cambiar algo, se te propone aparte con su respaldo y tu aprobación.

## Casos borde

| Caso | Resultado esperado |
|---|---|
| Negocio existente sin tocar nada | `America/Mexico_City`; todo igual que hoy (bloques B y C pasan iguales) |
| Negocio en Cancún, cita a las 10:00 | Se guarda `15:00Z`; el bot y el recordatorio dicen "10:00 a.m." y "hora de Cancún" |
| Tijuana en verano y en invierno | El offset cambia solo (-07:00 / -08:00); "09:00" sigue siendo las 09:00 locales |
| Día del cambio de horario en Tijuana | La hora que no existe (02:30 el día del adelanto) no se ofrece; la que se repite usa el primer instante |
| Cita a las 23:30 en Cancún | `date` del mismo día en Cancún, no el siguiente |
| Google sin llave o sin la API activada | La dirección se guarda; la zona queda igual; la pantalla dice "No pudimos detectar la zona, elígela de la lista" |
| Google detecta una zona fuera de la lista | Se guarda y aparece como opción extra de ese negocio |
| Dueño eligió la zona a mano y luego cambia la dirección | Se respeta la manual (`timeZoneSource = manual`) |
| Negocio solo en línea | Elige de la lista; al registrarse se propone por lada |
| Texto con [Zona horaria] en inglés | "Cancun time" |
| Zona inválida enviada a la API | 400 `time_zone_invalid` |

## Pruebas (TDD, sin base de datos ni red)
1. `tests/clinic-time.test.ts` (se amplía): las mismas horas en CDMX, Cancún, Hermosillo y Tijuana (verano e invierno), la medianoche, el día del cambio de horario y la ida y vuelta (`clinicDateTime` → instante → `clinicDateKeyOf`/`clinicTimeOf`).
2. `tests/time-zones.test.ts` (nuevo): todas las opciones son IANA válidas, etiquetas en es y en, zona fuera de la lista y propuesta por lada.
3. `tests/time-zone-lookup.test.ts` (nuevo, `fetch` falso): OK, `ZERO_RESULTS`, `REQUEST_DENIED`, tiempo agotado, zona inválida y sin llave; la llave nunca aparece en el log.
4. `tests/bot-visit-view.test.ts` (se amplía): Cancún y Tijuana más `timeZone` y `timeZoneLabel`.
5. `tests/reminder-messages.test.ts` y `reminder-template-rules` (se amplían): [Zona horaria] válida en los tres textos, llenada en es y en, y aceptada en cualquier idioma.
6. `tests/time-zone-guard.test.ts` (nuevo, lee el código fuente): ningún `"-06:00"` ni `America/Mexico_City` fuera de `clinic-time.ts` y `time-zones.ts`.
7. Pruebas de conexión (lectura del código): `business` y `register` llaman a `lookupTimeZone` solo con coordenadas; las rutas del bot mandan `timeZoneLabel`.
8. Suite completa, `npx tsc --noEmit` y `npm run build`.

## Validación local (espejo, como hoy)
- `test-sql` de la migración 28 en el espejo.
- Repetir **B1-B11** con doctorgcenter en CDMX: el resultado debe ser idéntico al de hoy, más `timeZone` y `timeZoneLabel`.
- **B12:** en el espejo, doctorgcenter pasa a `America/Cancun`: la cita de las 19:30 CDMX se lee 20:30 "hora de Cancún", y una cita nueva a las 10:00 Cancún se guarda `15:00Z`.
- **B13:** `/admin/negocio` en el espejo: guardar la dirección detecta la zona con Google (requiere que hayas activado la API; antes te aviso, porque es una llamada real a Google con tu llave).
- **C2:** recordatorio real con un texto que use [Zona horaria] (WhatsApp a ...2968, con tu aprobación antes de enviar).
- N5 después del deploy, como estaba.

## Documentación (mismo PR)
- CLAUDE.md: `Tenant.timeZone`, la regla R1-R5, la etiqueta nueva y la sección "Patient times" (hoy dice "always Mexico time").
- `n8n/docs/N8N_WHATSAPP_BOT_DOCUMENTATION.md`: `timeZone` y `timeZoneLabel` en las herramientas y en `context`.
- CLAUDE.md, sección `GOOGLE_MAPS_API_KEY`: activar **Time Zone API** y agregarla a la restricción de la llave.

## Despliegue
1. Tú: activar Time Zone API en Google Cloud y agregarla a la restricción de la llave (en local y en Vercel es la misma llave).
2. `up.sql` de la 28 en producción, con respaldo verificado y tu aprobación, **antes** del merge.
3. PR "Refs #111" con las partes 1 y 2 y esta ampliación. El merge despliega.
4. N5 por WhatsApp real y revisión del prompt en n8n (solo lectura).
- Para revertir: se revierte el PR. La columna puede quedarse (el código viejo la ignora); `down.sql` solo se corre si se decide quitarla.

## Riesgos
- **PR grande:** junta un P0 probado con más de 30 archivos y un cambio de base. Mitigación: commits separados (partes 1-2, zona horaria) y repetir B y C completos.
- **Pantallas del navegador:** si alguna sigue usando su propio reloj, mostraría la hora del celular del paciente. La prueba de R3 y la revisión de los 38 `toLocale*` sin zona lo cubren; los que son de citas pasan a la zona del negocio.
- **Costo de Google:** una llamada por cada dirección guardada. Mínimo, pero conviene la alerta de presupuesto que ya pide CLAUDE.md.
- **Cambio de zona con citas futuras:** las citas no se mueven, pero un horario semanal mal elegido deja horas raras. Por eso el aviso al guardar.
