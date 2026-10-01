import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import NewsletterCampaign from "@/models/NewsletterCampaign";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

const STALE_MS = 30 * 60 * 1000;

/** GET /api/admin/newsletter/campaigns — send history (latest 30) with live progress. */
export async function GET() {
  try {
    const session = await checkAdmin();
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
