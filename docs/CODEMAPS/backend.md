<!-- Generated: 2026-10-28 | Files scanned: 87 route.ts + 45 src/lib | Token estimate: ~950 -->
# Backend

## Route groups (src/app/api)
```
auth/[...nextauth], auth/register          NextAuth + signup
tenants/{business,check-slug,register,reminders}
products[/id|/categories]  orders[/id]  pedido/[id]  reviews[/id]  faqs[/id]  carousel[/id]  theme
appointments[/id|/id/history|/availability] -> lib/appointments-service.ts
admin/{historial[/key],pacientes}
checkout{,/confirm,/verify-payment}  webhooks/{conekta,social-campaign}
billing/{portal,prices,setup-intent,subscribe,webhook}   credits (GET status, POST Stripe recharge)
chat                                        Newy AI (stream, 402 credit_exhausted)
apps/[provider], apps/connect/whatsapp, apps/oauth/{google,microsoft,facebook}/{start,callback}
apps/facebook/{config,post,products,setup}
apps/whatsapp/{chats[/id[/send]],config,confirmations[/id],messages,status}
campaigns/social[/id|/id/context|/due|/history]
calendar/events   places/{search,details}   upload/cloudinary
```

## Internal (x-internal-key, called by n8n)
```
internal/bot/context        -> prompt data, greetingReply, calendarText, creditExhausted
internal/bot/{availability,book,cancel,reschedule,my-appointments,confirm,contact-status,pending,alert-failure}
internal/reminders/run      -> lib/reminders.ts + reminder-actions.ts (send, charge, release)
internal/{tokens/report,triage,tenant-context,render-post-banner,whatsapp/sync}
internal/calendar/{availability,create-event}   internal/campaigns/alert-failure
```

## Key flows
```
book:    bot/book | POST /api/appointments -> createAppointment (appointments-service.ts)
           -> business-hours check -> calendar-sync.getBusyPeriods -> tx: appointment (+findOrCreatePet)
           -> google-calendar|microsoft-calendar event (externalProvider/externalEventId)
remind:  reminders/run -> reminders.ts (pure) -> whatsapp.sendWhatsAppMessage -> credits.recordMessageCharge
release: reminder-actions.releaseVisit -> cancelAppointment -> delete calendar event -> cancel text
chat:    api/chat -> credits.getCreditStatus -> ai/openrouter cascade -> ai/tools(toolsFor vertical) -> ai/execute-tool
credits: credits.recordTokenUsage -> AiTokenLedger; pause -> campaigns pausedByCredits; notifyTenantOwner
```

## Key files (lines)
```
lib/ai/execute-tool.ts 453   lib/credits.ts 370    lib/ai/tools.ts 333    lib/calendar-sync.ts 248
lib/auth.ts 230              lib/appointments-service.ts 196  lib/business-hours.ts 170
lib/ai/openrouter.ts 142     lib/bot.ts 135 (resolveBotTenant, normalizeCustomerPhone)
lib/whatsapp.ts 118          lib/tenant.ts 75   lib/reminders.ts 63   lib/reminder-actions.ts 67
Also: patient-key, phone, location, pets, clinic-time, greeting, confirmation-words, rate-limit, trial, stripe, conekta, cloudinary
```

## Rules
- Import Prisma from `@/lib/db` (not `@/lib/prisma`).
- tenantId from session JWT or resolveBotTenant; never from request body.
- Validation: zod in src/lib/validations/index.ts.
