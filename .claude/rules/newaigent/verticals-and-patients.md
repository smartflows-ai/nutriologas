---
paths:
  - "src/lib/vertical-profile.ts"
  - "src/lib/pets.ts"
  - "src/lib/product-*.ts"
  - "src/app/admin/historial/**"
  - "src/app/admin/pacientes/**"
  - "src/app/api/admin/**"
  - "src/app/*/productos/**"
  - "src/app/*/producto/**"
  - "src/app/*/agendar/**"
  - "src/app/*/mis-citas/**"
  - "src/app/*/page.tsx"
  - "src/components/admin/AdminSidebar.tsx"
---

> Moved from `CLAUDE.md` on 2026-11-20. Loads only when a matching file is read.

## Triage / Patients Module (feature-flagged)

- **Toggle**: `Tenant.isTriageEnabled = true` enables the module (default: `false`).
- **CRM**: `/admin/pacientes` — lists `PatientProfile` cards with data collected by the WhatsApp agent.
- **Internal API**: `GET/POST /api/internal/triage` — authenticated with `x-internal-key`. The WhatsApp AI agent checks whether a patient already has a complete triage (`isTriageComplete`) and saves the data when it finishes.
- **Data flow**: WhatsApp AI (n8n) → `POST /api/internal/triage` → creates/updates `PatientProfile` → visible in `/admin/pacientes`.
- If `isTriageEnabled = false`, the endpoint returns `{ isTriageComplete: true }` so n8n skips the triage flow without errors.
- **Note**: This module was **NOT removed**. It is active and functional, only hidden in the sidebar when `isTriageEnabled = false`.

---


## Business Verticals and Service Adaptation

- **DB model (`Tenant.vertical`)**: Enum `BusinessVertical` (`ECOMMERCE`, `HEALTH`, `VETERINARY`, `TOURISM`, `SERVICES`, `PET_CARE`, `TRAVEL`, `GENERAL`). Unknown or null values use the store profile (`ECOMMERCE`).
- **Single source per vertical ("giro")**: `src/lib/vertical-profile.ts` (`getVerticalProfile(vertical, isBookingEnabled)`). Sidebar, storefront, the Newy AI assistant, chat and the product form read from there; do not compare the vertical's name by hand.

| Vertical | Orders | Catalog first (services) | Customer group | Pets | Newy AI sales tools |
|---|---|---|---|---|---|
| ECOMMERCE, GENERAL | yes | no | Customers | no | yes |
| HEALTH | no | yes | Patients | no | no |
| VETERINARY, PET_CARE | no | yes | Pets | yes | no |
| TOURISM, TRAVEL | no | yes | Travelers | no | no |
| SERVICES | no | yes | Customers | no | no |

- History and appointments only appear with `isBookingEnabled`. Newy AI's appointment tools also depend on that switch (`toolsFor()` in `src/lib/ai/tools.ts`), and `POST /api/chat` rejects any tool outside the vertical's set even if the model requests it.
- In the sidebar, the products section changes to "Servicios" (Services) for verticals that sell by appointment (`serviceFirst`).
- **Pets** (`VETERINARY`, `PET_CARE`): the web booking (`BookingFlow`) and the bot ask for the pet's name and species. Without a name, `POST /api/appointments` and `bot/book` answer `pet_required` (400). The history groups by owner, shows the pets under each owner, filters by pet (`GET /api/admin/historial/[key]?petId=`) and shows the pet in each visit. `/admin/citas` shows "Mascotas: nombre" (Pets: name) under the owner. Other verticals do not query the `pets` table.
- The history uses the customer group's label (`t.crm.history.subjects`): Patient history, pet history, traveler history or customer history.
- **Dynamic adaptation**:
  - For verticals not focused on physical e-commerce (doctors/gynecologists, veterinary clinics with pet hotels, travel agencies/tours), products are configured as services with duration (`durationMinutes`) and interactive scheduling (`isBookingEnabled: true`).
  - In the sidebar, the products section automatically changes to "Servicios" for health professionals (`isHealth`).
  - The storefront adapts the main purchase button to "Agendar Cita / Servicio" (Book Appointment / Service), routing to `/agendar/[slug]`.
- **Patient appointment portal**: Customers can view their booked appointments or cancel them at `/mis-citas`.
- **Guest booking**: The `POST /api/appointments` endpoint allows booking appointments without requiring a prior account. It stores the patient's name and phone both in the relational fields (`customerName`, `customerPhone`) and in `notes` as a redundant backup.

---
