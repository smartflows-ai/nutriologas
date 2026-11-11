// src/app/api/internal/bot/context/route.ts
// POST: Tenant context for the WhatsApp agent, resolved from the Evolution instance name.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isInternalKeyValid, resolveBotTenant } from "@/lib/bot";
import { isBookable } from "@/lib/bookable";
import { getCreditStatus } from "@/lib/credits";
import { INTRO_WINDOW_HOURS, buildGreetingReply, introRequired } from "@/lib/greeting";
import { effectiveModes, intakeNeeds, modalityModeFor, modalityModeOf } from "@/lib/patient-intake";
import { patientKeyOf } from "@/lib/patient-key";
import { getKnownPatient } from "@/lib/patients";

export async function POST(req: NextRequest) {
  if (!isInternalKeyValid(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const { instance, text, customerPhone, remoteJid, remoteJidAlt } = await req.json().catch(() => ({}));
  const bot = await resolveBotTenant(instance);
  if (!bot) return Response.json({ error: "Instancia de WhatsApp no encontrada" }, { status: 404 });

  // Every JID this contact may be stored under (phone JID, and the chat's own or alternative JID).
  const contactJids = [
    typeof customerPhone === "string" && customerPhone ? `${customerPhone}@s.whatsapp.net` : null,
    remoteJid,
    remoteJidAlt,
  ].filter((jid, index, all): jid is string => typeof jid === "string" && jid.includes("@") && all.indexOf(jid) === index);

  // The bot and the owner both store their messages as outgoing (fromMe) messages: any of them counts as an introduction.
  const lastOutgoing = contactJids.length
    ? await prisma.whatsAppMessage.findFirst({
        where: {
          tenantId: bot.tenantId,
          remoteJid: { in: contactJids },
          fromMe: true,
          timestamp: { gte: new Date(Date.now() - INTRO_WINDOW_HOURS * 60 * 60 * 1000) },
        },
        select: { timestamp: true },
      })
    : null;
  const needsIntro = introRequired(lastOutgoing?.timestamp ?? null);
  const greetingReply =
    typeof text === "string" && text
      ? buildGreetingReply({ text, businessName: bot.tenantName, language: bot.messageLanguage, privacyUrl: bot.privacyUrl })
      : null;

  // Is this number already a patient? A known patient is never asked name, age or email again.
  const known = bot.isBookingEnabled
    ? await getKnownPatient(bot.tenantId, patientKeyOf(typeof customerPhone === "string" ? customerPhone : null))
    : null;

  const [products, faqs, creditStatus] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: bot.tenantId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        price: true,
        description: true,
        category: true,
        durationMinutes: true,
        requiresBooking: true,
        visitModes: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.fAQ.findMany({
      where: { tenantId: bot.tenantId, isActive: true },
      select: { question: true, answer: true },
      orderBy: { sortOrder: "asc" },
    }),
    getCreditStatus(bot.tenantId),
  ]);

  return Response.json({
    tenantId: bot.tenantId,
    tenantName: bot.tenantName,
    businessInfo: bot.businessInfo,
    ownerName: bot.ownerName,
    locationText: bot.locationText,
    usesPets: bot.usesPets,
    waContext: bot.waContext,
    waTemperature: bot.waTemperature,
    businessHoursText: bot.businessHoursText,
    calendarText: bot.calendarText,
    creditExhausted: creditStatus.isExhausted,
    // Plain greeting: the reply to send without the model (null otherwise). introRequired tells the agent
    // whether it must introduce itself in this reply.
    greetingReply,
    introRequired: needsIntro,
    privacyUrl: bot.privacyUrl,
    // Patient registry for this number: what to ask (intake) and how the business sees patients (modalityMode:
    // IN_PERSON, ONLINE, or ASK when the patient chooses). The stored name, age and email are shown to the patient
    // (it is their own number) so they confirm them before booking; email is null when they gave none.
    patient: known ? { known: true, name: known.name, age: known.age, email: known.email } : { known: false },
    intake: intakeNeeds(known),
    modalityMode: modalityModeOf(bot.serviceModes),
    // Read-only catalog: the agent may quote these prices but cannot change them.
    // bookable = sold by appointment; false means information only (no date, no booking tools).
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency: "MXN",
      description: p.description,
      category: p.category,
      durationMinutes: p.durationMinutes ?? 30,
      bookable: isBookable(p, bot),
      // How this service is delivered. IN_PERSON or ONLINE: do not ask, but tell the customer. ASK: the customer chooses.
      modalityMode: isBookable(p, bot) ? modalityModeFor(bot.serviceModes, p.visitModes) : null,
      modalities: isBookable(p, bot) ? effectiveModes(bot.serviceModes, p.visitModes) : [],
    })),
    faqs,
  });
}
