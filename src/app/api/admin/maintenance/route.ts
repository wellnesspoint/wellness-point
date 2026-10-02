import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import SiteSettings from "@/models/SiteSettings";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { clearSiteStatusCache, DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/site-status";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const session = await checkAdmin("settings", "view");
    if (!session) return unauthorizedResponse();
    await connectDB();
    const s = await SiteSettings.findOne().select("maintenanceMode maintenanceMessage").lean();
    return NextResponse.json({
      on: !!s?.maintenanceMode,
      message: s?.maintenanceMessage || "",
      defaultMessage: DEFAULT_MAINTENANCE_MESSAGE,
    });
  } catch (error) {
    console.error("Admin maintenance GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PUT { on: boolean, message?: string } — turn maintenance mode on/off. Takes effect within ~30 s. */
export async function PUT(req: NextRequest) {
  try {
    const session = await checkAdmin("settings", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    if (!body || typeof body.on !== "boolean") {
      return NextResponse.json({ error: "on must be true or false" }, { status: 400 });
    }
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : undefined;

    await connectDB();
    const update: Record<string, unknown> = { maintenanceMode: body.on };
    if (message !== undefined) update.maintenanceMessage = message;
    // upsert: a store that never saved settings has no SiteSettings document yet
    await SiteSettings.findOneAndUpdate({}, { $set: update }, { upsert: true });

    clearSiteStatusCache();
    await logAudit(session, {
      action: "site.maintenance",
      entity: "settings",
      summary: `Maintenance mode turned ${body.on ? "ON" : "OFF"}`,
    });
    return NextResponse.json({ on: body.on, message: message ?? "" });
  } catch (error) {
    console.error("Admin maintenance PUT error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
