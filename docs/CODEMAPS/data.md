<!-- Generated: 2026-10-28 | Files scanned: prisma/schema.prisma (638 lines) | Token estimate: ~750 -->
# Data (Prisma, PostgreSQL)

Every table carries tenantId. No migrations folder: schema applied with `npm run db:push`.

## Models
```
Tenant ─┬ ThemeConfig (1:1)
        ├ User ──< Account, Session; VerificationToken      @@unique(tenantId,email)
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
BusinessVertical (ECOMMERCE HEALTH VETERINARY TOURISM SERVICES PET_CARE TRAVEL GENERAL) · UserRole · AppProvider · ItemType · OrderStatus · PaymentMethod · CampaignFrequency · SocialPlatform · PlanId · SubscriptionStatus · AppointmentStatus

## Appointment (lines 558-603)
Fields: appointmentDate, durationMinutes, notes, internalNotes, customerName/Phone/Email, patientKey (52+10 digits), petId, externalProvider+externalEventId, reminderSentAt, customerConfirmedAt, autoReleasedAt. Legacy: googleEventId, remindersSent.
Indexes: (tenantId), (tenantId,appointmentDate), (tenantId,patientKey), (tenantId,petId).

## Tenant config groups
- Identity: slug, customDomain, logoUrl, whatsappNumber, businessInfo, ownerName, address/placeId/lat/lng
- Flags: vertical, isBookingEnabled, isAssistantEnabled, isTriageEnabled
- Hours: businessHours (JSON blocks per day)
- Reminders: remindersEnabled, reminderLeadMinutes, confirmationRequired, confirmationDeadlineMinutes, templates, messageLanguage
- Credits: aiCreditLimitUsd, botFailureAlertedAt

## Pending
- db:push not run for WhatsAppChat.botEnabled/botPausedReason (per CLAUDE.md); confirm before applying.
- Row Level Security not enabled; isolation is app-level only.
