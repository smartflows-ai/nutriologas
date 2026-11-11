<!-- Generated: 2026-11-10 | Files scanned: prisma/schema.prisma (665 lines) + prisma/sql | Token estimate: ~1000 -->
# Data (Prisma, PostgreSQL)

Every table carries tenantId. No Prisma migration history. Schema changes are manual SQL in `prisma/sql/<change>/{up,down}.sql` (verified on a throwaway DB, backup first, DB before code).
`npm run db:push` is NOT safe against the real DB: it would drop `whatsapp_bot_memory` (n8n bot memory, table unknown to Prisma).

## Models
```
Tenant ─┬ ThemeConfig (1:1)
        ├ User ──< Account, Session; VerificationToken      @@unique(tenantId,email)  isActive, mustChangePassword, sessionVersion
        ├ ConnectedApp (GOOGLE|MICROSOFT|FACEBOOK|WHATSAPP) @@unique(tenantId,provider)
        ├ WhatsAppChat (botEnabled,botPausedReason) ──< WhatsAppMessage   @@unique(tenantId,remoteJid)
        ├ PatientProfile (1:1 User, triage)
        ├ Product (itemType, durationMinutes, requiresBooking, capacity, deletedAt) @@unique(tenantId,slug)
        ├ Order ──< OrderItem >── Product        status PENDING|PAID|SHIPPED|DELIVERED|CANCELLED
        ├ Review, FAQ, CarouselImage
        ├ SocialCampaign ──< SocialPost          frequency, pausedByCredits, selectedImageUrl
        ├ Subscription (STARTER|PRO|ENTERPRISE; trialEndsAt)
        ├ AiTokenLedger  @@unique(tenantId,periodStart)  total/realProvider/netMargin, reminderCount
        ├ Appointment ──> User?, Product, Pet?  status PENDING|CONFIRMED|COMPLETED|CANCELLED|NO_SHOW
        ├ Pet  @@unique(tenantId,patientKey,nameKey)
        └ AppointmentNote (history by patientKey, appointmentId)
```

## Enums
BusinessVertical (ECOMMERCE HEALTH VETERINARY TOURISM SERVICES PET_CARE TRAVEL GENERAL) · UserRole · AppProvider · ItemType · OrderStatus · PaymentMethod · CampaignFrequency · SocialPlatform · PlanId · SubscriptionStatus · AppointmentStatus · AppointmentModality (IN_PERSON ONLINE) · ServiceModes (IN_PERSON ONLINE BOTH)

## Appointment (lines 558-603)
Fields: appointmentDate, durationMinutes, notes, internalNotes, customerName/Phone/Email, patientKey (52+10 digits), petId, externalProvider+externalEventId, reminderSentAt, customerConfirmedAt, autoReleasedAt.
Failed sends: reminderAttempts (Int, default 0), reminderLastError (safe text, never sent to the browser), reminderLastAttemptAt. Cleared by a good send or a reschedule (reminder-state.ts). Added by prisma/sql/16-reminder-attempts.
Patient intake (prisma/sql/21-patient-intake, applied 2026-11-06): customerAge (Int?, CHECK 0..120, copied forward from the latest visit), modality (AppointmentModality?, null in older visits), meetUrl (Meet link of an online visit). customerEmail is optional; a patient without email logs in as `<patientKey>@wa.guest.local`.
Recommended by (prisma/sql/22-referred-by, applied 2026-11-06): referredByKey (patientKey of who booked the visit for someone else), referredByName (their name then); index (tenantId, referredByKey). Null for visits booked for oneself.
A "known patient" = a number with an earlier appointment (latest visit by patientKey); there is no patients table.
Legacy: googleEventId, remindersSent.
Indexes: (tenantId), (tenantId,appointmentDate), (tenantId,patientKey), (tenantId,petId).

## User access (prisma/sql/23-user-access, ticket #22, NOT applied to production)
isActive (default true): false blocks sign-in and ends an open session on its next request. mustChangePassword (default false): true after the owner creates a user or resets a password; only the change screen works. sessionVersion (default 0): goes up on an owner reset, a deactivation and a /recuperar reset; a session only works for the version it was issued for.
Both are read on every session check (account-state-data.ts). Additive: apply the up.sql before deploying the code that reads them.

## Tenant config groups
- Identity: slug, customDomain, logoUrl, whatsappNumber, businessInfo, ownerName, address/placeId/lat/lng
- Flags: vertical, isBookingEnabled, isAssistantEnabled, isTriageEnabled, serviceModes (default IN_PERSON; BOTH = bot and web ask each visit)
- Hours: businessHours (JSON blocks per day)
- Reminders: remindersEnabled, reminderLeadMinutes, confirmationRequired, confirmationDeadlineMinutes, templates, messageLanguage
- Credits: aiCreditLimitUsd, botFailureAlertedAt

## Pending
- Schema and DB in sync (checked 2026-11-02) except `whatsapp_bot_memory` (declare or exclude before any db:push).
- No test database: local dev and production share one DB. Mirror DB, periodic backups and prisma migrate adoption are separate tasks.
- Row Level Security not enabled; isolation is app-level only.
- 23-user-access: backup and owner approval, then up.sql in one transaction, before the team code is merged.
