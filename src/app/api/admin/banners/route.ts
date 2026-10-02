import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Banner from "@/models/Banner";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parseBanner } from "@/lib/banner-input";
import { logAudit } from "@/lib/audit";

// GET /api/admin/banners — list all banners
export async function GET() {
  try {
    const session = await checkAdmin("content", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const banners = await Banner.find().sort({ position: 1, sortOrder: 1 }).lean();
    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Banner list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/admin/banners — create a banner
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const parsed = parseBanner(await req.json().catch(() => null), true);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    await connectDB();

    const banner = await Banner.create(parsed.data);
    await logAudit(session, {
      action: "banner.create",
      entity: "banner",
      entityId: banner._id.toString(),
      summary: `Created banner "${banner.title}"`,
    });
    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    console.error("Banner create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
