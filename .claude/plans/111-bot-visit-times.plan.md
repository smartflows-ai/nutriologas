# #111 (partes 1 y 2): el bot lee bien la hora de la cita y sabe si es en línea al reagendar

Estado (2026-11-17): plan **v2 aprobado** en el canvas (fb-141). No se ha escrito código; la implementación empieza en la siguiente sesión.
Ticket: https://github.com/smartflows-ai/nutriologas/issues/111 · Prioridad P0 · Capas: `App`
Alcance: **solo la app**. La parte 3 del ticket (envío fallido de WhatsApp) es de n8n y la toma otra persona.

## Cambios en v2

| Retroalimentación | Cambio |
|---|---|
| D1: "sí, siempre México" | `startsAt` se conserva con la zona de México (`-06:00`) |
| D2: español por ahora | `weekday` y `time` en español |
| D3: evaluar primero si hace falta n8n | ~~Sacar la parte 3 a su propio issue~~ **#111 sigue abierto; tras el deploy se evalúa con N5 si n8n necesita cambios y entonces se decide** |
| Formato de hora: ¿#114 es de n8n, app o db? | Respondido en Riesgos: la decisión vive en #114, el código en la app. **Se deja nota cruzada en #114 y #111** |
| Logo de Newy en las vistas previas | Verificado: causa encontrada. **Va a #116** (sección "Hallazgo relacionado") |
| Criterios de aceptación sin n8n | **Nuevo:** `.claude/local-test/qa-2026-11-13/criterios-111.md` (contrato app → bot y niveles de validación N1 a N6) |

## Qué pasa

1. **Hora en UTC.** Un paciente con cita el martes a las 19:30 pregunta "¿cuándo tengo cita?" y el bot responde "miércoles a las 01:30". Después reagenda partiendo de esa hora falsa.
2. **Cita en línea tratada como presencial.** Al reagendar una cita en línea, el bot manda la dirección del consultorio. Si el paciente aclara que es virtual, dice "el equipo te enviará el enlace", aunque el enlace ya existe.

Metáfora: el bot es un mensajero que lee una nota antes de hablar. Hoy la nota de "tus citas" trae la hora de Londres, y la de "cita movida" siempre dice "ven al consultorio". El mensajero lee bien; lo que hay que corregir es la nota.

## Qué hace el código hoy (verificado)

- `src/app/api/internal/bot/my-appointments/route.ts:50` devuelve `startsAt: a.appointmentDate.toISOString()`, por ejemplo `2026-11-18T01:30:00.000Z`. El modelo lee "18, 01:30". Ya devuelve bien `modality` y `meetLink` (enlace corto).
- `src/app/api/internal/bot/reschedule/route.ts:79-88` devuelve `date`, `time` y siempre `location: bot.locationText`. No devuelve `modality` ni `meetLink`.
- `src/app/api/internal/bot/book/route.ts:230-246` es el modelo correcto: `time` en hora de México (`formatSlotTime`), `modality`, `meetLink` solo si es en línea, y `location` solo si no lo es.
- Al reagendar, el evento de Google se actualiza con PATCH solo en inicio y fin (`src/lib/calendar-sync.ts:215`, `google-calendar.ts:145`). El Meet y `meetUrl` se conservan; no hay que tocar el calendario.
- n8n (leído, sin cambios): el prompt dice "Nunca calcules el día de la semana" y "Si book_appointment devuelve meetLink, compártelo". Ningún nodo nombra `startsAt`. La herramienta `reschedule_appointment` pide `date` y `time` "from list_my_appointments", así que hoy recibe la fecha UTC.

## Reglas

**R1. Toda cita que la app le describe al bot va en hora de México, con día de la semana.**
Metáfora: si le dices a un niño "tu fiesta es a las 01:30 en Londres", llega un día tarde. Dile "martes 17 a las 7:30 de la noche" y llega bien.
Ejemplo: una cita guardada como `2026-11-18T01:30Z` se describe como `date: 2026-11-17`, `time: 07:30 p.m.`, `weekday: martes`.

**R2. Una cita en línea lleva su enlace y nunca la dirección; una presencial lleva la dirección y nunca enlace.**
Metáfora: la invitación a una fiesta por videollamada trae el botón para entrar, no el mapa a una casa.
Ejemplo: al reagendar una cita en línea, la respuesta trae `modality: ONLINE`, `meetLink: https://<negocio>.newaigent.com/online/Ab12Cd34` y `location: null`.

**R3. Las tres respuestas (agendar, ver citas, reagendar) describen la cita con la misma pieza de código.**
Metáfora: tres maestros que leen la misma lista no se contradicen; si cada uno copia la lista a mano, uno se equivoca.
Ejemplo: si mañana cambia el formato de hora (decisión pendiente en #114), se cambia en un solo lugar.

## Diseño

### 1. Helpers de hora (`src/lib/clinic-time.ts`, sin código de servidor)
- `clinicTimeLabel(date)`: la hora como hoy la escribe `formatSlotTime` (`es-MX`, 12 horas, zona de México). `formatSlotTime` (`src/lib/bot.ts:134`) pasa a llamar a esta función, para que haya una sola fuente.
- `clinicWeekdayOf(date)`: el día de la semana en español, en la zona de México ("martes").
- Se ponen aquí porque `bot.ts` importa la base de datos y el helper nuevo debe poder probarse sin ella.

### 2. Vista de la cita para el bot (`src/lib/bot-visit-view.ts`, nuevo, función pura)
```ts
botVisitView(
  visit: { appointmentDate: Date; modality: "IN_PERSON" | "ONLINE" | null; meetUrl: string | null; meetShortCode: string | null },
  place: { shortLinkTenant: { slug: string; customDomain: string | null }; locationText: string }
) => {
  startsAt: string;      // ISO con la zona de México: "2026-11-17T19:30:00-06:00"
  date: string;          // "2026-11-17", fecha en México
  time: string;          // "07:30 p.m.", igual que book
  weekday: string;       // "martes"
  modality: "IN_PERSON" | "ONLINE" | null;
  meetLink: string | null;   // solo ONLINE: enlace corto, o el real si la cita no tiene código; null si no hay enlace
  location: string | null;   // solo si no es ONLINE (null = cita antigua, cuenta como presencial)
}
```
- `startsAt` se queda (mismo nombre, por si algo lo lee), pero con la zona de México en vez de UTC.
- `meetLink` usa `customerMeetUrl` (`src/lib/short-links.ts:35`), igual que hoy.

### 3. Rutas
- `my-appointments`: cada cita usa `...botVisitView(...)`. Se quita la consulta extra del negocio, porque `bot.shortLinkTenant` y `bot.locationText` ya vienen de `resolveBotTenant`. Se conservan `appointmentId`, `serviceName`, `petName`, `durationMinutes`, `status`, `forOtherPerson` y `patientName`.
- `reschedule`: la respuesta de éxito usa `...botVisitView(result.appointment, ...)` con la cita ya movida. Se conservan `success`, `appointmentId`, `serviceName` y `durationMinutes`. La respuesta de horario ocupado (409) no cambia.
- `book`: solo agrega `weekday` (`clinicWeekdayOf(slot.start)`). Sus demás campos ya cumplen R1 y R2. No se refactoriza más para no mover una ruta que funciona.

### Lo que no cambia
- Base de datos: nada. Sin migración.
- n8n: nada obligatorio. Las herramientas pasan la respuesta completa al modelo, así que los campos nuevos le llegan solos.
- Calendario: nada (ver hallazgos).

### Sugerencia para quien lleve n8n (no bloquea este PR)
- En el prompt, "Si book_appointment **o reschedule_appointment** devuelve meetLink, compártelo".
- Que la descripción de `reschedule_appointment` diga "date y time tal como los devuelve list_my_appointments (hora de México)".
- Se anota como comentario en #111 para la parte 3.

## Casos borde

| Caso | Resultado esperado |
|---|---|
| Cita a las 19:30 en México (01:30 UTC del día siguiente) | `date` del mismo día, `weekday` correcto |
| Cita a las 23:59 y a las 00:00 en México | El día no se corre |
| Cita en línea con código corto | `meetLink` corto, `location` null |
| Cita en línea antigua sin código | `meetLink` real (`https://meet...`), `location` null |
| Cita en línea sin enlace (negocio sin Google) | `meetLink` null, `location` null; el prompt ya dice "el consultorio te enviará el enlace" |
| Cita presencial | `location` con dirección, `meetLink` null |
| Cita antigua sin `modality` | Se trata como presencial (igual que `book` y los recordatorios) |
| Negocio sin dirección física | `location` null |
| Cita para otra persona | `forOtherPerson` y `patientName` siguen igual |

## Pruebas (TDD, sin base de datos)

1. `tests/clinic-time.test.ts` (nuevo): `clinicTimeLabel` y `clinicWeekdayOf` con 19:30, 23:59, 00:00 y 12:00; `formatSlotTime` da lo mismo que `clinicTimeLabel`.
2. `tests/bot-visit-view.test.ts` (nuevo): todos los casos de la tabla de arriba. Primero en rojo.
3. `tests/bot-visit-routes-wiring.test.ts` (nuevo, lectura del código fuente, como los `*-wiring` existentes): `my-appointments` y `reschedule` usan `botVisitView` y ninguna ruta del bot devuelve `toISOString()` de una cita.
4. Suite completa: `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`.

## Verificación manual

- Local, solo lectura: llamar `my-appointments` con un número de prueba que tenga una cita por la tarde. **Antes te aviso el número que voy a usar.**
- Reagendar escribe en la base real (local y producción comparten base). No lo hago yo: lo pruebas tú, o lo dejamos para WhatsApp real después del deploy.
- Después del deploy, por WhatsApp real: agendar una cita en línea a las 19:30, preguntar "¿cuándo es mi cita?", reagendarla y revisar la hora, el día y el enlace.

## Documentación (mismo PR)
- CLAUDE.md, "WhatsApp Bot with AI (n8n)": `my-appointments` y `reschedule` devuelven `date`, `time`, `weekday`, `modality`, `meetLink` y `location` en hora de México (`botVisitView`).
- `n8n/docs/N8N_WHATSAPP_BOT_DOCUMENTATION.md`: los mismos campos en las herramientas.

## Despliegue
- Solo código: rama `fix/111-bot-visit-times`, PR, revisión y merge (el merge despliega). No hay paso de base de datos ni de n8n.
- Si algo sale mal, se revierte el PR; ningún dato cambia.

## Decisiones [v2: respondidas]
- [x] **D1. `startsAt`:** se conserva, siempre en hora de México.
- [x] **D2. Idioma:** español por ahora (día de la semana y hora).
- [x] **D3. Parte 3 de #111:** ~~sacarla a su propio issue~~ **#111 queda abierto. Después del deploy se corre N5 (WhatsApp real sin tocar n8n); con ese resultado se decide si n8n necesita cambios y cuándo.** El PR dice "Refs #111", no "Closes #111".

## Criterios de aceptación [v2]
En `.claude/local-test/qa-2026-11-13/criterios-111.md` (local, git lo excluye):
- **Contrato app → bot:** cada campo, de qué columna de la base sale, cómo se transforma y quién lo usa en n8n. Más 4 invariantes que el flujo puede dar por hechos.
- **Niveles de validación:** N1 pruebas, N2 base en solo lectura, N3 API local en solo lectura, N4 reagendar (lo hace el dueño), N5 WhatsApp real sin n8n, N6 cuando se toque n8n.
- Metáfora: es el recibo que la app le entrega al mensajero. Si el recibo dice "martes 7:30 p.m." y la libreta de la base dice lo mismo, el error ya no puede estar en la app.

## Hallazgo relacionado [v2]: el logo de Newy en las vistas previas (va a #116)
- **Qué pasa:** al compartir un enlace del negocio por WhatsApp, la miniatura muestra la flor de loto de Newy y no el logo del doctor.
- **Causa (verificada):** `generateMetadata` en `src/app/layout.tsx` declara para **todos** los negocios los íconos de la plataforma (`/favicon/favicon-32x32.png`, `/favicon/apple-touch-icon.png`) y ninguna `og:image`. WhatsApp usa ese ícono como miniatura. El negocio sí tiene `tenants.logoUrl`, pero no se usa en los metadatos. También rompe la regla de marca blanca.
- **Solución propuesta:** en páginas de negocio, `icons` y `openGraph.images` con `logoUrl` (Cloudinary); sin logo, nada de la plataforma. Junto con la descripción en el idioma del negocio, que ya está en #116.
- No entra en este PR: se agrega como comentario en #116.

## Riesgos
- **Formato de hora:** "07:30 p.m." sigue igual que en `book`. [v2] **¿De quién es?** La **decisión** (18:00 o 6:00 p.m.) vive en #114 porque es una regla del bot. El **código** es de la app: `clinicTimeLabel` en `src/lib/clinic-time.ts`, que este plan vuelve la única fuente. Cuando se decida, se cambia esa función y cambian juntos el bot y los recordatorios y confirmaciones en español (ya usan `formatSlotTime` vía `clinicTime` en `src/lib/reminder-messages.ts`); n8n y la base no se tocan. Se deja una nota en #114 apuntando a esa función y otra en #111.
- **Fuera de alcance, ya existía:** `rescheduleAppointment` ignora si falla la actualización del calendario (`syncCalendarUpdate` devuelve false y nadie lo revisa). La cita se mueve en la app pero el evento puede quedar a la hora vieja. Se anota en #111 como hallazgo; no se arregla aquí.
