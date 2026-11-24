# QA #146: sesión de un negocio en el subdominio de otro

Prueba manual en producción. Negocios: **newy** (de prueba, se puede escribir) y **doctorgcenter** (real: SOLO LEER, no guardar, no enviar, no cambiar nada).
Usa una ventana normal de Chrome (la sesión es una sola por navegador).

## Antes
1. Cierra sesión en todos los subdominios.

## Casos
| # | Pasos | Resultado esperado |
|---|---|---|
| 1 | Inicia sesión en `newy.newaigent.com/login` y entra a `/admin/citas`. | Ves la agenda de newy (sin cambios). |
| 2 | Con esa sesión abre `doctorgcenter.newaigent.com/admin/citas`. | El navegador te lleva a `newy.newaigent.com/admin`. No aparece nada de doctorgcenter con datos de newy. |
| 3 | Abre `doctorgcenter.newaigent.com/admin/whatsapp`. | Igual que el 2: termina en `newy.newaigent.com/admin`. No hay bucle de redirecciones. |
| 4 | En `doctorgcenter.newaigent.com/mis-citas` y `/mis-pedidos`. | Pide iniciar sesión (no muestra citas ni pedidos de newy). |
| 5 | En `doctorgcenter.newaigent.com/carrito` y `/checkout`. | Se comporta como visitante sin sesión (el menú no muestra tu nombre). |
| 6 | En la consola del navegador de `doctorgcenter.newaigent.com`: `fetch('/api/auth/session').then(r=>r.json())`. | Responde `{}`. |
| 7 | En la misma consola: `fetch('/api/appointments').then(r=>r.status)` y `fetch('/api/apps/whatsapp/chats').then(r=>r.status)`. | La primera responde 401 (sin citas de newy); la segunda responde 403. |
| 8 | Vuelve a `newy.newaigent.com/admin`. | Sigue funcionando con la misma sesión. |
| 9 | Abre `newaigent.com` (raíz). | La página de marketing carga normal. |
| 10 | Conecta Google Calendar desde newy (solo si hace falta). | El regreso por la raíz sigue funcionando. |
| 11 | Dominio propio, si algún negocio lo tiene: abre `/admin` en ese dominio con sesión de otro negocio. | Te lleva al subdominio de tu negocio; no hay bucle. |

## Si algo falla
Dime el número de caso, la URL final y lo que viste. No sigas probando en doctorgcenter.
