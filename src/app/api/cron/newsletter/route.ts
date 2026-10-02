import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import NewsletterCampaign from "@/models/NewsletterCampaign";
import { deliverCampaign, resolveAudience, type Audience } from "@/lib/newsletter";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * GET /api/cron/newsletter — sends scheduled newsletters that are due.
 *
 * Opt-in like the other cron: needs CRON_SECRET and `Authorization: Bearer <secret>`
 * (Vercel Cron sends it automatically). Each due campaign is claimed atomically
 * (scheduled -> sending), so overlapping runs cannot send it twice. The audience is
 * resolved at send time. Schedule precision is the cron frequency (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!safeEqual(req.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const results: { campaign: string; total: number; status: string }[] = [];

    // One at a time: SMTP limits are per account, so campaigns must not overlap.
    for (;;) {
      const campaign = await NewsletterCampaign.findOneAndUpdate(
        { status: "scheduled", scheduledAt: { $lte: new Date() } },
        { $set: { status: "sending" } },
        { sort: { scheduledAt: 1 }, new: true }
      );
      if (!campaign) break;

      const emails = await resolveAudience((campaign.audience || "all") as Audience);
      if (emails.length === 0) {
        await NewsletterCampaign.updateOne(
          { _id: campaign._id },
          { $set: { status: "failed", total: 0, finishedAt: new Date() } }
        );
        results.push({ campaign: String(campaign._id), total: 0, status: "failed (no subscribers match)" });
        continue;
      }
      await NewsletterCampaign.updateOne({ _id: campaign._id }, { $set: { total: emails.length } });
      await deliverCampaign({ _id: campaign._id, subject: campaign.subject, body: campaign.body }, emails);
      const after = await NewsletterCampaign.findById(campaign._id).select("status").lean();
      results.push({ campaign: String(campaign._id), total: emails.length, status: after?.status ?? "unknown" });
      await logAudit(null, {
        action: "newsletter.cron",
        entity: "newsletter",
        entityId: String(campaign._id),
        summary: `Scheduled newsletter "${campaign.subject.slice(0, 100)}" sent to ${emails.length} subscriber(s)`,
      });
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("Newsletter cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
