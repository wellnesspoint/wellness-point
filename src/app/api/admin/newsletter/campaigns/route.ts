import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { logAudit } from "@/lib/audit";
import connectDB from "@/lib/db";
import NewsletterCampaign from "@/models/NewsletterCampaign";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

const STALE_MS = 30 * 60 * 1000;

/** GET /api/admin/newsletter/campaigns — send history (latest 30) with live progress. */
export async function GET() {
  try {
    const session = await checkAdmin("marketing", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();

    // A send that never finished (the function was killed) must not look "in progress" forever.
    await NewsletterCampaign.updateMany(
      { status: "sending", createdAt: { $lt: new Date(Date.now() - STALE_MS) } },
      { $set: { status: "failed", finishedAt: new Date() } }
    );

    const campaigns = await NewsletterCampaign.find()
      .select("-body")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Campaign list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PUT { id, action: "cancel" } — withdraw a scheduled newsletter before it is sent. */
export async function PUT(req: NextRequest) {
  try {
    const session = await checkAdmin("marketing", "manage");
    if (!session) return unauthorizedResponse();

    const { id, action } = await req.json().catch(() => ({}));
    if (action !== "cancel" || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "A valid campaign id and action are required" }, { status: 400 });
    }
    await connectDB();
    // Atomic: only a campaign that is still "scheduled" can be cancelled, so this
    // cannot race with the cron job that starts sending it.
    const cancelled = await NewsletterCampaign.findOneAndUpdate(
      { _id: id, status: "scheduled" },
      { $set: { status: "cancelled", finishedAt: new Date() } },
      { new: true }
    );
    if (!cancelled) {
      return NextResponse.json({ error: "That newsletter is no longer scheduled" }, { status: 409 });
    }
    await logAudit(session, {
      action: "newsletter.cancel",
      entity: "newsletter",
      entityId: id,
      summary: `Cancelled scheduled newsletter "${cancelled.subject.slice(0, 100)}"`,
    });
    return NextResponse.json({ message: "Cancelled" });
  } catch (error) {
    console.error("Campaign cancel error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
