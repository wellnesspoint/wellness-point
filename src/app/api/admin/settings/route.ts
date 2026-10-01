import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import SiteSettings from "@/models/SiteSettings";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { getCompany, clearCompanyCache } from "@/lib/site-settings";
import { COMPANY } from "@/lib/invoice-core";
import { isValidEmail } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

// 15-character Indian GSTIN: 2 digits state, 10 char PAN, entity no, Z, checksum
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

/** GET /api/admin/settings — the effective store details (saved values over built-in defaults). */
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();
    return NextResponse.json({ settings: await getCompany(), defaults: COMPANY });
  } catch (error) {
    console.error("Admin settings GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PUT /api/admin/settings — store name, tagline, address, GSTIN, support email, website, phone. */
export async function PUT(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
    const update = {
      storeName: text(body.name, 80),
      tagline: text(body.tagline, 160),
      location: text(body.location, 200),
      gstNo: text(body.gstNo, 15).toUpperCase(),
      supportEmail: text(body.supportEmail, 120).toLowerCase(),
      website: text(body.website, 100),
      phone: text(body.phone, 20),
    };

    if (!update.storeName) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 });
    }
    if (update.gstNo && !GSTIN_RE.test(update.gstNo)) {
      return NextResponse.json({ error: "GST number must be a valid 15-character GSTIN" }, { status: 400 });
    }
    if (update.supportEmail && !isValidEmail(update.supportEmail)) {
      return NextResponse.json({ error: "Support email is not valid" }, { status: 400 });
    }
    if (update.phone && !/^[0-9+\-\s()]{6,20}$/.test(update.phone)) {
      return NextResponse.json({ error: "Phone number is not valid" }, { status: 400 });
    }

    await connectDB();
    await SiteSettings.findOneAndUpdate({}, { $set: update }, { upsert: true, new: true, runValidators: true });
    clearCompanyCache();

    await logAudit(session, {
      action: "settings.update",
      entity: "settings",
      summary: "Updated store details (invoices & emails)",
      meta: { changes: update },
    });

    return NextResponse.json({ settings: await getCompany() });
  } catch (error) {
    console.error("Admin settings PUT error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
