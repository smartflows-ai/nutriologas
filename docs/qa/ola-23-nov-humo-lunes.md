# Guía del humo con WhatsApp: ola del 23-nov (PR #137)

**Rama:** `fix/ola-23-nov` · **Negocio de prueba:** `newy` · **Número de prueba:** `…2968` (el único que se usa; nunca la línea del propio negocio) · **Cuándo:** lunes 23-nov, **después** del deploy y de pegar los cambios de n8n.

> Esta guía es solo un guion. Escribirla no manda mensajes, no toca la base de datos ni n8n. Cada paso que sí lo hace lo ejecuta una persona el lunes, con su aprobación.

## Regla de oro: nadie toca el chat del panel hasta guardar la prueba de la base de datos

Metáfora: es una **escena del crimen**. Si alguien entra a mover cosas antes de la foto, la foto ya no cuenta lo que pasó.

En una prueba del 21-nov un traspaso se limpió solo 9 segundos después (alguien lo marcó como atendido o encendió el bot) y la evidencia pareció un error del código. Por eso:

1. Mientras corre un caso, **nadie** abre ese chat en el panel (`/admin/whatsapp`), ni marca "atendido", ni enciende el bot, ni responde desde el panel.
2. Primero se guarda la **evidencia (b)**: la consulta de solo lectura de la base de datos, con su hora.
3. Solo después se hace la limpieza del caso.
4. Si alguien tocó el chat antes de tiempo, se anota en "Resultado" y el caso se repite.

## Cómo se guarda la evidencia (igual en todos los casos)

Cada caso necesita las **tres** cosas. Sin las tres, el caso no cuenta como probado.

| Letra | Qué | Cómo |
|---|---|---|
| **a** | Captura de WhatsApp, recortada, **sin teléfono ni nombre** | Archivo `docs/screenshots/ola-23-nov/lunes/<ticket>-<caso>.png` (el nombre exacto está en cada caso). Se recorta con `sips -c H W --cropOffset Y X`. Se tapa cualquier número o nombre. |
| **b** | Consulta de **solo lectura** a la base de datos | Se pega el resultado en "Resultado" con la hora. Solo `select`; nunca `update`, `insert` ni `delete`. Ver las plantillas abajo. |
| **c** | Ejecución de n8n | El **id de la ejecución** (Executions en n8n), la herramienta que llamó el agente y lo que contestó la app. En #129: `raised` (true o false) y `reason`. |

**Cuidado con los datos:** en capturas y notas solo se escribe `…2968`. Nada de nombres reales, otros teléfonos, correos ni llaves. Las capturas viven primero en `.evidence-ola-23/` (fuera de git) y solo el recorte elegido pasa a `docs/screenshots/ola-23-nov/lunes/`.

### Plantillas de consulta (solo lectura)

Se ejecutan contra la base real, así que **solo `select`** y siempre filtradas por el negocio `newy` y por el final `2968`.

Chat (casos 4 a 7):

```sql
select c."botEnabled", c."botPausedReason", c."helpReason", c."helpPriority",
       c."helpRequestedAt", c."helpOwnerNotifiedAt", c."optedOutAt",
       c."messagingReactivatedAt", now() as consultado_a
from whatsapp_chats c
join tenants t on t.id = c."tenantId"
where t.slug = 'newy' and c."remoteJid" like '%2968@%';
```

Cita (casos 1 a 4):

```sql
select a.id, a.status, a."customerName", a."appointmentDate", a."durationMinutes",
       a."customerPhone" is not null as tiene_telefono, a."createdAt", now() as consultado_a
from appointments a
join tenants t on t.id = a."tenantId"
where t.slug = 'newy' and a."deletedAt" is null
  and a."createdAt" > now() - interval '1 hour'
order by a."createdAt" desc;
```

Usuario (solo caso 1, nombre guardado de una palabra):

```sql
select u.id, u.name, length(trim(u.name)) - length(replace(trim(u.name), ' ', '')) + 1 as palabras
from users u join tenants t on t.id = u."tenantId"
where t.slug = 'newy' and u.role = 'CUSTOMER' and u.name is not null
  and u.id in (select a."userId" from appointments a where a."customerPhone" like '%2968');
```

> Antes de tomar la captura (b) de una cita, **cubre `customerPhone`** si aparece completo: en esta guía solo se muestra `tiene_telefono` (sí o no).

## Antes de empezar (una sola vez)

| # | Precondición | Quién | Estado |
|---|---|---|---|
| P1 | El deploy de `main` con el PR #137 ya está en producción | Tú | ☐ |
| P2 | Los cambios de n8n 1, 2 y 3 de `n8n/docs/cambios-n8n-2026-11-23.md` están pegados (con respaldo en `~/.n8n-backups/`) | Tú | ☐ |
| P3 | El bot está **encendido** para `…2968` en `newy` (consulta del chat: `botEnabled = true`, sin `helpReason`) | Tú | ☐ |
| P4 | La casilla nueva de "Reactivar mensajes" llegó con el deploy (caso 7) | Tú | ☐ |
| P5 | Nombre guardado de **una sola palabra** para `…2968` (lo necesita el caso 1). **Es una escritura en la base de `newy`: necesita aprobación aparte**, no se hace sin ella | Tú, con aprobación | ☐ |
| P6 | Para el caso 3: `newy` tiene una cita con recordatorio o confirmación disponible para responder "SI", y el negocio tiene dirección (ver caso 3) | Tú | ☐ |

---

## Caso 1: #128, el bot pide el apellido antes de agendar

**Metáfora:** es el portero de una fiesta que no te deja pasar con un solo nombre en la lista. Antes de darte la mesa (la cita) te pregunta "¿y tu apellido?". Si te deja pasar con una sola palabra, el portero está dormido.

**Se hace 3 veces**, con "Cancela mi cita" entre una y otra, para comprobar que no es casualidad.

**Precondición:** P1, P2, P3 y P5 (nombre guardado de una palabra para `…2968`). Sin P5 el bot ya conoce un apellido y el caso no prueba nada.

**Mensajes, en orden (desde `…2968` a `newy`), en cada corrida:**
1. `Hola, quiero agendar una cita`
2. Elegir el servicio y un horario libre que ofrezca el bot (una opción cualquiera).
3. Cuando el bot pida el apellido: `Pérez` (un apellido inventado) .
4. Al terminar la corrida (después de guardar la evidencia): `Cancela mi cita`

**Resultado esperado:** antes de crear la cita el bot **pide el apellido**; tras responderlo, la cita se crea con nombre y apellido. No crea la cita con una sola palabra.

**Cuenta como falla si:** el bot agenda con el nombre de una palabra sin pedir apellido; si pide el apellido pero la cita no se crea; o si falla una de las 3 corridas.

**Evidencia obligatoria (por corrida):**
- **a)** `docs/screenshots/ola-23-nov/lunes/128-apellido-corrida1.png` (y `…corrida2.png`, `…corrida3.png`): la pregunta del apellido y la confirmación.
- **b)** Consulta de **cita**: `customerName` con nombre y apellido, `status`, la hora; `tiene_telefono` = sí.
- **c)** Id de la ejecución de n8n, la herramienta de reservar (`book`) y lo que contestó la app (la primera vez con la instrucción de pedir apellido; la segunda con la cita creada).

**Limpieza:** `Cancela mi cita` entre corridas; al final comprobar con la consulta de cita que no queda ninguna cita de prueba activa de este caso. Si queda alguna, cancelarla desde el panel (cancelar, no borrar datos).

**Resultado (lunes):** corrida 1 ______ · corrida 2 ______ · corrida 3 ______ · hora ______ · persona ______

---

## Caso 2: #127, la confirmación del bot dice la zona horaria

**Metáfora:** es dar una cita por teléfono con alguien de otro país. Decir "a las cuatro" no basta; hay que decir "a las cuatro, hora de Monterrey". Si el bot omite la zona, el paciente podría llegar a otra hora.

**Precondición:** P1, P2 (el **cambio 1 de n8n** es el que hace esto; sin él el caso falla por una razón conocida) y P3.

**Mensajes, en orden:**
1. `Hola, quiero agendar una cita`
2. Elegir un servicio y un horario libre.
3. Dar el nombre y apellido si el bot los pide.

**Resultado esperado:** el mensaje de confirmación del bot trae la hora **y la zona**, por ejemplo `… a las 4:00 PM, hora de Monterrey`.

**Cuenta como falla si:** la confirmación trae la hora sin zona; o trae una zona distinta a la del negocio.

**Evidencia obligatoria:**
- **a)** `docs/screenshots/ola-23-nov/lunes/127-zona-confirmacion.png`: el mensaje de confirmación con la zona.
- **b)** Consulta de **cita**: la hora guardada (`appointmentDate`) coincide con la hora que dijo el bot, leída en la zona del negocio.
- **c)** Id de la ejecución de n8n, la herramienta `book` y la respuesta de la app.

**Limpieza:** cancelar la cita de prueba (`Cancela mi cita`) y comprobar con la consulta de cita que quedó cancelada.

**Resultado (lunes):** ____________________ · hora ______ · persona ______

---

## Caso 3: #74, responder SI trae la ubicación

**Metáfora:** es pedir "¿y dónde queda?" en cuanto dices que sí. Con el "sí" te llega el mapa, sin tener que preguntarlo otra vez.

**Precondición:** P1, P3, P6, y `newy` con dirección guardada. La app solo contesta el `SI` si la cita futura de `…2968` tiene **recordatorio enviado** (`reminderSentAt` lleno) y **todavía no la confirmó el paciente** (`customerConfirmedAt` vacío); si no, el `SI` no encuentra cita y lo contesta el agente.

> **Ojo (revisado el 21-nov, solo lectura):** la cita de prueba del martes 24-nov 16:00 ya tiene `customerConfirmedAt` (21-nov 03:10Z, de la prueba local C3-2). **No sirve para este caso.** Opciones: (1) agendar el lunes una cita nueva para el martes o miércoles y responder `SI` cuando llegue su recordatorio; o (2) con aprobación aparte (escritura en datos de newy), vaciar `customerConfirmedAt` de esa cita.

**Mensajes:**
1. Ante el recordatorio o la confirmación que le llegó a `…2968`, responder: `SI`

**Resultado esperado:** la respuesta dice "Tu cita de <servicio> el <día> a las <hora> (hora de <zona>) queda confirmada" y, en un párrafo aparte, `Ubicación: <dirección>. Cómo llegar: https://newy.newaigent.com/ubicacion` (la dirección y el enlace van en la misma línea, como en la prueba local del 20-nov). Una sola vez, con un solo punto después de cada etiqueta (sin `..`).

**Cuenta como falla si:** no trae la ubicación; trae el enlace roto o sin `/ubicacion`; repite la ubicación dos veces; o la manda como dato de otro negocio.

**Evidencia obligatoria:**
- **a)** `docs/screenshots/ola-23-nov/lunes/074-si-ubicacion.png`: el `SI` y la respuesta con `Ubicación` y `Cómo llegar`.
- **b)** Consulta de **cita**: queda en `CONFIRMED` y con `customerConfirmedAt` lleno (la hora del `SI`). Si ya estaba `CONFIRMED` por el dueño, lo que cambia es `customerConfirmedAt`.
- **c)** Id de la ejecución de n8n (si el `SI` pasó por el bot) y lo que contestó la app.

**Limpieza:** si la cita de prueba ya no se necesita, cancelarla. El recordatorio del martes ~13:00 manda un mensaje real al `…2968`: cancelar o dejarla a propósito, y anotarlo.

**Resultado (lunes):** ____________________ · hora ______ · persona ______

---

## Caso 4: #129, agendar para su hija **no** pasa a una persona

**Metáfora:** es una mamá que llama al consultorio y dice "quiero una cita para mi hija". La recepcionista no debería gritar "¡que venga el doctor!". Solo anota a la niña y le da su horario.

**Precondición:** P1, P2 (el **cambio 3 de n8n**, el que pide no prometer a una persona tras `not_requested`) y P3.

**Mensajes, en orden:**
1. `Quiero agendar una cita para mi hija`
2. `Se llama <Nombre> <Apellido>, tiene 8 años, su número es <el mismo número …2968>` (nombre inventado de prueba, el mismo número de prueba).

**Resultado esperado:** el bot agenda la cita de la niña; el chat **no se pausa** y **nadie recibe aviso**.

**Cuenta como falla si:** el chat queda con el bot apagado; hay un aviso a una persona (`helpOwnerNotifiedAt` con fecha); el bot dice que "le pasará con alguien"; o no agenda.

**Evidencia obligatoria:**
- **a)** `docs/screenshots/ola-23-nov/lunes/129-hija-agenda.png`: la conversación hasta la confirmación, sin teléfono ni nombre.
- **b)** Consulta de **chat**: `botEnabled = true`, `botPausedReason` vacío, `helpReason` vacío, `helpOwnerNotifiedAt` vacío. Consulta de **cita**: el nombre y la hora de la niña.
- **c)** Id de la ejecución de n8n. Si el agente llamó a `request_human_help`, anotar la respuesta de la app: debe ser `raised: false, reason: "not_requested"`. Si no la llamó, anotarlo.

**Limpieza:** cancelar la cita de la niña (`Cancela mi cita`) y comprobarlo con la consulta de cita.

**Resultado (lunes):** ____________________ · hora ______ · persona ______

---

## Caso 5: #129, una clienta molesta **sí** pasa a una persona

**Metáfora:** es el cliente que levanta la voz en la tienda. Ahí sí se llama al gerente, y rápido. El arreglo del caso 4 no debe quitarle esa puerta.

**Precondición:** P1, P2, P3. El bot encendido y el chat sin `helpReason` (consulta del chat limpia).

**Mensajes:**
1. `Estoy molesta porque no me estás generando una cita`

**Resultado esperado:** el bot **pasa el chat a una persona**: el chat queda pausado y el dueño recibe el aviso.

**Cuenta como falla si:** el bot sigue conversando como si nada; el chat no queda pausado; o no hay aviso al dueño.

**Evidencia obligatoria:**
- **a)** `docs/screenshots/ola-23-nov/lunes/129-molesta-traspaso.png`: la respuesta del bot, sin teléfono ni nombre.
- **b)** Consulta de **chat**: `botEnabled = false`, `botPausedReason` con el motivo, `helpReason` con el motivo del traspaso, `helpOwnerNotifiedAt` con fecha. **Se toma antes de abrir el chat en el panel.**
- **c)** Id de la ejecución de n8n, herramienta `request_human_help` y la respuesta de la app: `raised: true` y el `reason`.

**Limpieza (después de guardar la evidencia b):** encender el bot otra vez para `…2968` (marcar como atendido en el panel, que también lo enciende) y comprobar con la consulta de chat que `botEnabled = true` y `helpReason` vacío.

**Resultado (lunes):** ____________________ · hora ______ · persona ______

---

## Caso 6: #129, pedir a alguien del equipo por su nombre **sí** pasa a una persona

**Metáfora:** es preguntar en la recepción "¿me comunica con la doctora fulana?". Si pides a alguien por su nombre, la recepcionista te la pasa. El arreglo del caso 4 tampoco debe tapar esta puerta.

**Precondición:** P1, P2, P3. Chat limpio (si venías del caso 5, haber hecho su limpieza). El nombre de la persona es el de **alguien del equipo de prueba**, no un nombre real de pacientes.

**Mensajes:**
1. `Hola, me puedes comunicar con <nombre de alguien del equipo>`

**Resultado esperado:** el bot **pasa el chat a una persona** (pausa y aviso al dueño).

**Cuenta como falla si:** el bot ignora la petición o intenta agendar en lugar de pasar el chat; no hay pausa; o no hay aviso al dueño.

**Evidencia obligatoria:**
- **a)** `docs/screenshots/ola-23-nov/lunes/129-nombre-traspaso.png`
- **b)** Consulta de **chat**: `botEnabled = false`, `helpReason`, `botPausedReason`, `helpOwnerNotifiedAt` con fecha. **Antes de tocar el panel.**
- **c)** Id de la ejecución de n8n, herramienta `request_human_help` y la app: `raised: true` y el `reason` (`person_requested`).

**Limpieza (después de la evidencia b):** encender el bot otra vez y comprobarlo con la consulta de chat (`botEnabled = true`, sin `helpReason`).

**Resultado (lunes):** ____________________ · hora ______ · persona ______

---

## Caso 7: la casilla de "Reactivar mensajes" (llega con el deploy)

**Metáfora:** es el guardia que, antes de abrirte el portón otra vez, te pide firmar "confirmo que el paciente sí quiere que le escriban". Sin firma, el portón no se abre.

**Precondición:** P1 y un chat de `newy` con la baja registrada (`optedOutAt` con fecha). Para conseguirla, desde `…2968` se manda una palabra de baja que reconoce el bot, por ejemplo `baja` (**es un mensaje real**; solo se manda con tu aprobación). Verificarlo con la consulta de chat: `optedOutAt` con fecha.

**Pasos (en el panel, no en WhatsApp):**
1. Abrir el chat de `…2968` en `/admin/whatsapp` y pulsar "Reactivar mensajes".
2. Comprobar que el botón de confirmar **no se activa** mientras la casilla "Confirmé con el paciente que quiere volver a recibir mensajes por WhatsApp…" no esté marcada.
3. Marcar la casilla y confirmar.

**Resultado esperado:** no aparece ningún cuadro gris del navegador ("… says"); el botón queda apagado hasta marcar la casilla; al confirmar, el chat vuelve a recibir mensajes.

**Cuenta como falla si:** aparece el diálogo nativo del navegador; el botón funciona sin marcar la casilla; o tras confirmar `optedOutAt` sigue con fecha.

**Evidencia obligatoria:**
- **a)** `docs/screenshots/ola-23-nov/lunes/reactivar-casilla.png`: la casilla visible y el botón (sin teléfono ni nombre).
- **b)** Consulta de **chat**: antes, `optedOutAt` con fecha; después, `optedOutAt` vacío y `messagingReactivatedAt` con fecha.
- **c)** No aplica (no pasa por n8n). Anotar "sin n8n".

**Limpieza:** ninguna; el chat queda reactivado.

**Resultado (lunes):** ____________________ · hora ______ · persona ______

---

## Tabla final de resultados

Se llena el lunes. Estado: `pendiente`, `OK` o `FALLA` (con el número de ejecución).

| Caso | Ticket | Evidencia a (captura) | Evidencia b (base de datos) | Evidencia c (n8n) | Estado |
|---|---|---|---|---|---|
| 1 | #128 | ☐☐☐ `128-apellido-corrida1/2/3.png` | ☐☐☐ cita con apellido | ☐☐☐ id + `book` | pendiente |
| 2 | #127 | ☐ `127-zona-confirmacion.png` | ☐ cita y hora | ☐ id + `book` | pendiente |
| 3 | #74 | ☐ `074-si-ubicacion.png` | ☐ cita | ☐ id | pendiente |
| 4 | #129 | ☐ `129-hija-agenda.png` | ☐ chat limpio + cita | ☐ id + `not_requested` | pendiente |
| 5 | #129 | ☐ `129-molesta-traspaso.png` | ☐ chat pausado y avisado | ☐ id + `raised: true` | pendiente |
| 6 | #129 | ☐ `129-nombre-traspaso.png` | ☐ chat pausado y avisado | ☐ id + `raised: true` | pendiente |
| 7 | #138 (casilla) | ☐ `reactivar-casilla.png` | ☐ `optedOutAt` y `messagingReactivatedAt` | sin n8n | pendiente |

## Limpieza final (todo junto)

- [ ] Bot encendido otra vez para `…2968` después de los casos 5 y 6 (consulta de chat: `botEnabled = true`, sin `helpReason`).
- [ ] Citas de prueba canceladas (casos 1, 2, 3, 4) y comprobadas con la consulta de cita.
- [ ] El recordatorio real del martes ~13:00 para `…2968` decidido: se deja o se cancela esa cita.
- [ ] Las capturas de `docs/screenshots/ola-23-nov/lunes/` están recortadas, sin teléfono ni nombre, y se agregan al PR #137.
- [ ] Los datos de prueba (cliente, citas, pedido, banner de `newy`) **no se borran**: se reportan y decide el equipo.
