import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import ShippingSettings from "@/models/ShippingSettings";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

// GET /api/admin/shipping — get shipping settings
export async function GET() {
  try {
    const session = await checkAdmin("shipping", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    let settings = await ShippingSettings.findOne();

    // Create default if none exists
    if (!settings) {
      settings = await ShippingSettings.create({
        flatRate: 50,
        freeShippingThreshold: 499,
        enableFreeShipping: true,
        estimatedDays: 5,
        estimatedDaysMax: 7,
        shippingNote: "Ships within 2-3 business days",
        zones: [],
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Shipping settings GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

/** Whitelist + validate the settings body (was a raw Object.assign). */
function parseSettings(body: any): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = {};

  for (const key of ["flatRate", "freeShippingThreshold"] as const) {
    if (body[key] === undefined) continue;
    const n = num(body[key]);
    if (!Number.isFinite(n) || n < 0) return { error: `${key} must be 0 or more` };
    data[key] = n;
  }
  for (const key of ["estimatedDays", "estimatedDaysMax"] as const) {
    if (body[key] === undefined) continue;
    const n = num(body[key]);
    if (!Number.isInteger(n) || n < 1) return { error: `${key} must be a whole number, 1 or more` };
    data[key] = n;
  }
  if (body.enableFreeShipping !== undefined) {
    if (typeof body.enableFreeShipping !== "boolean") {
      return { error: "enableFreeShipping must be true or false" };
    }
    data.enableFreeShipping = body.enableFreeShipping;
  }
  if (body.shippingNote !== undefined) {
    data.shippingNote = String(body.shippingNote).slice(0, 300);
  }
  if (body.zones !== undefined) {
    if (!Array.isArray(body.zones) || body.zones.length > 50) {
      return { error: "zones must be a list of at most 50 zones" };
    }
    const zones = [];
    for (const z of body.zones) {
      const rate = num(z?.rate);
      const days = num(z?.estimatedDays ?? 7);
      if (!String(z?.name || "").trim()) return { error: "Every zone needs a name" };
      if (!Number.isFinite(rate) || rate < 0) return { error: "Zone rate must be 0 or more" };
      if (!Number.isInteger(days) || days < 1) return { error: "Zone delivery days must be 1 or more" };
      zones.push({
        name: String(z.name).trim().slice(0, 100),
        states: Array.isArray(z.states) ? z.states.map((s: unknown) => String(s).trim()).filter(Boolean) : [],
        rate,
        estimatedDays: days,
      });
    }
    data.zones = zones;
  }
  return { data };
}

// PUT /api/admin/shipping — update shipping settings
export async function PUT(req: NextRequest) {
  try {
    const session = await checkAdmin("shipping", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = parseSettings(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();

    let settings = await ShippingSettings.findOne();
    const next = { ...(settings ? settings.toObject() : {}), ...parsed.data } as any;
    if (next.estimatedDaysMax !== undefined && next.estimatedDays !== undefined && next.estimatedDaysMax < next.estimatedDays) {
      return NextResponse.json(
        { error: "Maximum delivery days can't be lower than minimum delivery days" },
        { status: 400 }
      );
    }

    if (!settings) {
      settings = await ShippingSettings.create(parsed.data);
    } else {
      Object.assign(settings, parsed.data);
      await settings.save();
    }

    await logAudit(session, {
      action: "shipping.update",
      entity: "shipping",
      summary: `Updated shipping settings (${Object.keys(parsed.data).join(", ") || "no changes"})`,
      meta: { changes: parsed.data },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Shipping settings PUT error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
