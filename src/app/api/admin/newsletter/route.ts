import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { parsePagination, escapeRegex, pageMeta } from "@/lib/pagination";

const EXPORT_CAP = 20000;

// GET /api/admin/newsletter?page=&limit=&status=all|active|unsubscribed&q=&all=1
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("marketing", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "all";
    const q = (sp.get("q") || "").trim().slice(0, 100);

    const filter: Record<string, unknown> = {};
    if (status === "active") filter.isActive = { $ne: false };
    if (status === "unsubscribed") filter.isActive = false;
    if (q) filter.email = new RegExp(escapeRegex(q), "i");

    const page = parsePagination(sp, { defaultLimit: 25, maxLimit: 100 });
    const query = NewsletterSubscriber.find(filter).sort({ createdAt: -1 });
    if (sp.get("all") === "1") query.limit(EXPORT_CAP);
    else query.skip(page.skip).limit(page.limit);

    const [subscribers, total, unsubscribed, all] = await Promise.all([
      query.lean(),
      NewsletterSubscriber.countDocuments(filter),
      NewsletterSubscriber.countDocuments({ isActive: false }),
      NewsletterSubscriber.estimatedDocumentCount(),
    ]);

    return NextResponse.json({
      subscribers,
      counts: { all, active: all - unsubscribed, unsubscribed },
      ...pageMeta(total, page),
    });
  } catch (error) {
    console.error("Admin newsletter list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await checkAdmin("marketing", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await req.json().catch(() => ({}));
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "A valid subscriber ID is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await NewsletterSubscriber.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }
    await logAudit(session, {
      action: "subscriber.delete",
      entity: "subscriber",
      entityId: id,
      summary: `Deleted subscriber ${deleted.email}`,
    });

    return NextResponse.json({ message: "Subscriber deleted" });
  } catch (error) {
    console.error("Admin newsletter delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
