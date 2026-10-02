import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Redirect from "@/models/Redirect";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parseRedirect } from "@/lib/redirects";
import { clearSiteStatusCache } from "@/lib/site-status";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

/** PUT — edit a redirect or switch it on/off ({ isActive } alone toggles). */
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    await connectDB();
    const existing = await Redirect.findById(id);
    if (!existing) return NextResponse.json({ error: "Redirect not found" }, { status: 404 });

    if (body.from !== undefined || body.to !== undefined || body.permanent !== undefined) {
      const parsed = parseRedirect({
        from: body.from ?? existing.from,
        to: body.to ?? existing.to,
        permanent: body.permanent ?? existing.permanent,
      });
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      if (parsed.from !== existing.from && (await Redirect.findOne({ from: parsed.from, _id: { $ne: id } }))) {
        return NextResponse.json({ error: `${parsed.from} already redirects somewhere` }, { status: 409 });
      }
      existing.from = parsed.from;
      existing.to = parsed.to;
      existing.permanent = parsed.permanent;
    }
    if (body.isActive !== undefined) existing.isActive = Boolean(body.isActive);
    await existing.save();

    clearSiteStatusCache();
    await logAudit(session, {
      action: "redirect.update",
      entity: "redirect",
      entityId: id,
      summary: `Redirect ${existing.from} → ${existing.to} (${existing.isActive ? "on" : "off"})`,
    });
    return NextResponse.json({ redirect: existing });
  } catch (error) {
    console.error("Admin redirect update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    await connectDB();
    const removed = await Redirect.findByIdAndDelete(id);
    if (!removed) return NextResponse.json({ error: "Redirect not found" }, { status: 404 });

    clearSiteStatusCache();
    await logAudit(session, {
      action: "redirect.delete",
      entity: "redirect",
      entityId: id,
      summary: `Deleted redirect ${removed.from} → ${removed.to}`,
    });
    return NextResponse.json({ message: "Redirect deleted" });
  } catch (error) {
    console.error("Admin redirect delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
