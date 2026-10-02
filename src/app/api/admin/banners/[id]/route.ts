import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Banner from "@/models/Banner";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parseBanner } from "@/lib/banner-input";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/banners/[id] — update banner
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const parsed = parseBanner(await req.json().catch(() => null), false);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    await connectDB();
    const banner = await Banner.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true, runValidators: true }
    );

    if (!banner) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    await logAudit(session, {
      action: "banner.update",
      entity: "banner",
      entityId: id,
      summary: `Updated banner "${banner.title}" (${Object.keys(parsed.data).join(", ")})`,
    });
    return NextResponse.json({ banner });
  } catch (error) {
    console.error("Banner update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/banners/[id] — delete banner
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    await connectDB();
    const banner = await Banner.findByIdAndDelete(id);

    if (!banner) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    await logAudit(session, {
      action: "banner.delete",
      entity: "banner",
      entityId: id,
      summary: `Deleted banner "${banner.title}"`,
    });
    return NextResponse.json({ message: "Banner deleted" });
  } catch (error) {
    console.error("Banner delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
