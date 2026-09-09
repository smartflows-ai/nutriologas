import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Middleware-like check for internal API key
function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  return key === process.env.INTERNAL_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const remoteJid = searchParams.get("remoteJid");
  const tenantId = searchParams.get("tenantId");

  if (!remoteJid || !tenantId) {
    return NextResponse.json({ error: "Missing remoteJid or tenantId" }, { status: 400 });
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isTriageEnabled: true }
    });

    if (!tenant?.isTriageEnabled) {
      // If disabled, tell n8n triage is "complete" so it bypasses the agent
      return NextResponse.json({ exists: false, isTriageComplete: true, isTriageEnabled: false });
    }

    const profile = await prisma.patientProfile.findFirst({
      where: {
        tenantId,
        remoteJid,
      },
      include: {
        user: true
      }
    });

    if (!profile) {
      return NextResponse.json({ exists: false, isTriageComplete: false });
    }

    return NextResponse.json({
      exists: true,
      isTriageComplete: profile.isTriageComplete,
      profile,
    });
  } catch (error: any) {
    console.error("[Triage GET Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, remoteJid, name, age, heightCm, weightKg, goals, allergies, medicalHistory, medications } = body;

    if (!tenantId || !remoteJid) {
      return NextResponse.json({ error: "Missing tenantId or remoteJid" }, { status: 400 });
    }

    // Upsert User
    // Find if user already exists with this phone/remoteJid in PatientProfile
    let existingProfile = await prisma.patientProfile.findFirst({
      where: { tenantId, remoteJid },
      include: { user: true }
    });

    let userId = existingProfile?.userId;

    if (!userId) {
      // Create a new guest user since we don't have one
      const newUser = await prisma.user.create({
        data: {
          tenantId,
          email: `${remoteJid.replace("@s.whatsapp.net", "")}@wa.guest.local`, // Dummy email for guest
          name: name || "Paciente WhatsApp",
          role: "CUSTOMER",
        }
      });
      userId = newUser.id;
    }

    // Upsert PatientProfile
    const profile = await prisma.patientProfile.upsert({
      where: { userId: userId! },
      create: {
        userId: userId!,
        tenantId,
        remoteJid,
        age: age ? parseInt(age.toString()) : null,
        heightCm: heightCm ? parseFloat(heightCm.toString()) : null,
        weightKg: weightKg ? parseFloat(weightKg.toString()) : null,
        goals,
        allergies,
        medicalHistory,
        medications,
        isTriageComplete: true,
      },
      update: {
        remoteJid,
        age: age ? parseInt(age.toString()) : undefined,
        heightCm: heightCm ? parseFloat(heightCm.toString()) : undefined,
        weightKg: weightKg ? parseFloat(weightKg.toString()) : undefined,
        goals: goals !== undefined ? goals : undefined,
        allergies: allergies !== undefined ? allergies : undefined,
        medicalHistory: medicalHistory !== undefined ? medicalHistory : undefined,
        medications: medications !== undefined ? medications : undefined,
        isTriageComplete: true,
      }
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("[Triage POST Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
