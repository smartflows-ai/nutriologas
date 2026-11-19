# Plan: ronda de fallas conocidas del 18-nov (#113, #116, #120)

Rama única: `fix/qa-18-nov-round`, creada desde `main` (`c08a14b`). Un solo PR para todo, como se decidió.

Regla de la ronda: entra todo lo marcado "Falla conocida" que **no toque n8n ni el esquema de la base**. Lo demás queda fuera y se explica abajo.

## Lo que encontré

| Prueba | Qué pasa de verdad | Dónde |
|---|---|---|
| A8 | El panel ofrece "Para otra persona" y la API del panel la acepta | `AppointmentFormPanel.tsx:162`, `panel-appointments-core.ts:244` |
| A9 | "Recuperar" sale en toda cita eliminada; el servidor rechaza las que ya empezaron (`restoreCheck`) | `AppointmentCard.tsx:236`, `appointment-admin-rules.ts:300` |
| A10 | Ningún camino exige apellido; solo el prompt lo sugiere | `bot/book`, `api/appointments`, `parsePanelCreate` |
| A12 | "Nueva cita" usa clases propias; "Nuevo servicio" usa `btn-primary`. Además `btn-primary` pone **texto blanco** sobre el color del negocio: en newy (rosa claro `#ffaca3`) casi no se lee | `citas/page.tsx:407`, `globals.css:68` |
| A13 | La página sí responde a WhatsApp (200, etiquetas en el `<head>`), pero **no trae imagen ni dirección** (`og:image`, `og:url`) y la descripción sale en inglés ("Welcome to Newy") porque se toma del idioma de quien pide, no del negocio. Sin imagen, WhatsApp muchas veces no arma la tarjeta | `src/app/layout.tsx:46` |
| A14 | Ciudad y País del registro no siguen a la dirección; lada fija +52 y moneda fija MXN | ver ticket #120 |
| B14 | El enlace va entre paréntesis: `Dirección (https://newy.newaigent.com/ubicacion)`. WhatsApp se lleva el `)` y esa dirección da 404 | `src/lib/location.ts:46` |

### Lo que NO es falla (tu pregunta del calendario)

Eliminar una cita **sí borra** el evento de Google y Google avisa al correo invitado (`sendUpdates=all`). En newy, la cita que probaste se **eliminó a las 22:41 y se recuperó a las 22:42**. Recuperar vuelve a crear el evento y vuelve a mandar la invitación, por eso la ves en tu calendario.

> Metáfora: eliminar es tirar la invitación a la basura; recuperar es imprimir una nueva y volver a mandarla. Si tiras y luego recuperas, la invitación vuelve a llegar.

Prueba para mañana: elimina una cita y **no** la recuperes. El evento desaparece del calendario y el correo invitado recibe la cancelación.

### B10 (agendar a la hija) no es del servidor

El bot pidió confirmar los datos y, en el mismo mensaje, entregó el chat al equipo ("Un miembro de nuestro equipo te dará seguimiento"). Eso lo decide el agente de n8n al llamar a su herramienta de entrega. El patrón nuevo de "pide una persona" (#123) no coincide con ese mensaje. Para saber por qué el agente lo hizo hay que ver esa ejecución en n8n (solo lectura con `/n8n`). Queda fuera de esta rama.

## Fuera de esta ronda

| Prueba | Por qué |
|---|---|
| A11 (#115, horizonte) | Necesita una columna nueva en `Tenant` |
| B9 (#112, a.m. o p.m.) | Es del prompt de n8n |
| B10 (#113, hija) | Decisión del agente en n8n; se investiga aparte |
| B11 y B12 (#114) | Prompt y evento de mensaje editado, ambos en n8n |
| "Familiar con el mismo número" y "citas duplicadas" (#113) | No probados hoy; tienen decisiones abiertas en el ticket |

## Cambios

### 1. Nombre y apellido siempre (#113, A10)

**Regla:** toda cita nueva lleva nombre y apellido, en el panel, en `/agendar` y en el bot.

> Metáfora: es como la lista de la escuela. "Ana" no basta porque puede haber tres Anas; "Ana López" sí.

- Función pura `isPlausibleFullName(name)` en `src/lib/patient-intake.ts`:
  - al menos 2 palabras de 2 letras o más (las partículas "de", "la", "del", "los", "y" cuentan como parte del nombre, no como palabra);
  - solo letras (con acentos y ñ), apóstrofo o guion; cada palabra con al menos una vocal;
  - rechaza teclazos (`asd`, `qwe`), letras repetidas (`aaa`) y relleno (`desconocido`, `n/a`, `test`, `prueba`, `paciente`, `sin nombre`, `cliente`).
- Error `full_name_required`:
  - `POST /api/appointments` (web): 400.
  - Panel (`parsePanelCreate` y `parsePanelEdit` cuando cambia el nombre): 400 con el campo marcado en el formulario.
  - `bot/book`: respuesta con un mensaje claro para el agente ("Pide nombre y apellido"). Los errores del bot llegan al modelo como texto (`neverError`), así que el bot vuelve a preguntar **sin tocar n8n**.
- **Paciente registrado con una sola palabra** (decisión de hoy): se le pide el apellido. Si `bot/book` llega sin `customerName` y el nombre guardado no pasa la regla, responde `full_name_required`. Ejemplo: Ana ya tenía citas como "Ana"; en su siguiente cita el bot le pide el apellido una vez.
- El nombre de la mascota no lleva esta regla; el del dueño sí.
- Citas viejas: no se tocan. Editar una cita vieja sin cambiar el nombre no pide apellido.
- Formularios del panel y de `/agendar`: aviso en la pantalla al salir del campo, con i18n (`es.ts`, `en.ts`).

### 2. Panel sin "Para otra persona" (#113, A8)

- `AppointmentFormPanel.tsx`: el bloque queda comentado, no borrado, en todas las verticales.
- La API del panel ya no acepta `patientPhone` ni campos de otra persona: responde 400 `field_not_allowed`.
- El bot sigue agendando para otras personas igual que hoy.

### 3. "Recuperar" y "Reabrir" solo cuando se puede (#113, A9)

> Metáfora: un boleto de cine. Antes de la función lo puedes recuperar; cuando la película ya empezó, el botón desaparece.

- La tarjeta usa la misma regla del servidor (`restoreCheck` y `reopenPlanFor` de `appointment-admin-rules.ts`), no una copia.
- Pruebas: un minuto antes de la hora se ve; a la hora en punto y después, no.

### 4. Un solo botón principal en el CRM (#116, A12)

- `btn-primary` (`globals.css`) cambia `text-white` por `text-[color:var(--on-primary)]`, así se lee en colores muy claros y muy oscuros. Esto arregla todos los botones que ya usan la clase.
- "Nueva cita" pasa a `btn-primary` con ícono de 18, igual que "Nuevo servicio". Reviso FAQ, carrusel y equipo y los igualo si usan clases propias.
- Revisión: `audit.js` y `theme-colors.js`, modo oscuro, color claro (newy) y uno muy oscuro.

### 5. Vista previa del enlace del negocio (#116, A13)

- `generateMetadata` (solo en el subdominio de un negocio):
  - idioma del negocio (`Tenant.messageLanguage`), no el de quien pide;
  - descripción: el inicio de la descripción del negocio (`businessInfo`), si no hay, "Bienvenido a [negocio]";
  - `og:image`: el logo del negocio; si no tiene, la primera imagen del carrusel o de un servicio;
  - `og:url` con la dirección del negocio y `og:locale` (`es_MX` o `en_US`);
  - `<html lang>` en el idioma del negocio.
- La página 404 del negocio en su idioma.
- Prueba local: `curl -A "WhatsApp/2.23"` muestra las etiquetas en español con imagen. La tarjeta real en WhatsApp solo se ve después del despliegue (WhatsApp guarda en caché las vistas previas; para probar, usa un enlace con `?v=2`).

### 6. Enlace de ubicación sin paréntesis (#116, B14)

- `locationTextForBot` deja de usar paréntesis: `Dirección. Cómo llegar: https://…/ubicacion` (en inglés "Directions:", según `messageLanguage`).
- `/ubicacion` tolera signos pegados al final (`)`, `.`, `,`, `;`): una redirección en `next.config` los manda a `/ubicacion`. Cubre también al modelo cuando él mismo pone paréntesis.
- Se aplica igual al bot y a los recordatorios (los dos usan la misma función).

### 7. Ciudad, país, lada y moneda (#120, A14)

Las decisiones del ticket ya están cerradas y no se reabren:

- `/api/places/details` pide `addressComponents` en la misma llamada y devuelve además `city`, `region` y `countryCode`.
- El registro llena Ciudad y País con el lugar elegido; la lada sigue al país mientras el dueño no la toque. Si no hay datos, todo queda como hoy. Nada de esto se guarda.
- Una función pura `countryForTimeZone(zone)` da el país de la zona del negocio. De ahí salen la lada inicial (Negocio, `/agendar`, Nueva cita, WhatsApp del equipo) y la moneda de `bot/context` (MX→MXN, US→USD, CO→COP, PE→PEN, CL→CLP, AR→ARS, ES→EUR; desconocido→MXN).
- Un negocio con zona `America/Mexico_City` y sin dirección se comporta exactamente como hoy.

## Pruebas (antes del código, `tests/`)

| Archivo | Qué prueba |
|---|---|
| `full-name.test.ts` | Nombres reales mexicanos ("María de la Luz Pérez", "José Ángel Núñez", "O'Connor Ruiz"), basura y relleno |
| `restore-visibility.test.ts` | El botón sale antes de la hora y desaparece a la hora |
| `panel-no-other-person.test.ts` | La API del panel rechaza `patientPhone`; el formulario no tiene el bloque activo |
| `location-text.test.ts` | Sin paréntesis, en los dos idiomas, vacío sin local |
| `tenant-metadata.test.ts` | Idioma, descripción, imagen y URL del negocio |
| `address-components.test.ts`, `country-by-zone.test.ts` | Las del ticket #120 |

Luego: `npx tsx --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run build`, `/ecc:code-review`.

## Riesgos

- **Nombre completo en el bot:** si el agente no entiende el error, puede repetir la llamada. El texto del error dice exactamente qué pedir. Se revisa en la ronda de pruebas de mañana; si se cicla, el ajuste va al prompt (n8n, aparte).
- **`btn-primary`:** cambia el color del texto de todos los botones que la usan. En un negocio con color oscuro se ve igual que hoy (blanco); en uno claro pasa a casi negro.
- **Vista previa:** WhatsApp guarda en caché las tarjetas viejas; puede tardar en verse el cambio.

## Orden

1. Pruebas en rojo, código, verde (pasos 1 a 7 en ese orden).
2. Revisión de código y auditorías de UI.
3. Te muestro el resultado. Commit, push y PR **solo cuando lo digas**. Merge despliega: también lo decides tú.

## Resultado (18-nov, sin commit)

Los 7 pasos están hechos en la rama `fix/qa-18-nov-round`. Pruebas: 930 pasan, 0 fallan. `tsc` y `npm run build` sin errores. Revisión de código independiente: sin críticos; los 2 altos que encontró ya están corregidos.

| Cambio respecto al plan | Por qué |
|---|---|
| `btn-primary` con `--on-primary` **no** mejora la lectura en colores claros | `--on-primary` es blanco fijo por la decisión de producto del 11-nov (`src/lib/theme-vars.ts:39`). El botón se ve igual que hoy; queda listo si esa decisión cambia |
| `<html lang>` sigue el idioma de la pantalla, no el del negocio | Una pantalla en inglés marcada como español es mala para accesibilidad. La vista previa ya va en el idioma del negocio con `og:locale` |
| La regla de nombre acepta "Ma. Guadalupe Pérez", "J. Carlos López", "Mtra. Ana Ruiz", "Juan Pérez Jr." y acentos que llegan sueltos | La revisión mostró que la primera versión los rechazaba |
| Un paciente guardado como "Paciente" o "Desconocido" ya no choca con la regla de #72 | Sin esto el bot pedía el nombre y luego lo rechazaba como de otra persona: se ciclaba |

Probado en local (build de producción, puerto 3005, solo lectura):
- La página de newy para el lector de WhatsApp: descripción en español, `og:image` (jpg de 11 KB, carga 200), `og:url` y `og:locale es_MX`. La 404 del negocio en español.
- `/ubicacion)` redirige a `/ubicacion`, que abre el mapa.

No verificado: la tarjeta real en WhatsApp (necesita despliegue) y las auditorías `minimal-ui` (los scripts no existen en esta copia).
