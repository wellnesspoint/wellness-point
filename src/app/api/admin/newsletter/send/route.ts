import { NextRequest, NextResponse, after } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import NewsletterCampaign from "@/models/NewsletterCampaign";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { AUDIENCES, AUDIENCE_LABELS, deliverCampaign, getTransporter, resolveAudience, type Audience } from "@/lib/newsletter";

// Large lists take a while to send — allow the background work to run long enough.
export const maxDuration = 300;

// A campaign still "sending" after this long is treated as dead (function killed).
const STALE_CAMPAIGN_MS = 30 * 60 * 1000;
const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * POST /api/admin/newsletter/send
 * Body: { subject, body, audience?: "all"|"customers"|"non_customers"|"recent", scheduledAt?: ISO date }
 *
 * Without `scheduledAt`: starts sending to the audience and returns right away (202);
 * sending continues in the background and progress is recorded on a NewsletterCampaign
 * the admin page polls. With `scheduledAt` (in the future): saves the campaign as
 * "scheduled"; the cron job (/api/cron/newsletter) sends it at its next run after that
 * time, resolving the audience then.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("marketing", "manage");
    if (!session) return unauthorizedResponse();

    const { subject, body, audience: rawAudience, scheduledAt: rawSchedule } = await req.json().catch(() => ({}));

    if (typeof subject !== "string" || typeof body !== "string" || !subject.trim() || !body.trim()) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }
    if (subject.length > 200 || body.length > 20000) {
      return NextResponse.json({ error: "Subject (200) or body (20000) is too long" }, { status: 400 });
    }
    const audience: Audience = (AUDIENCES as readonly string[]).includes(rawAudience) ? rawAudience : "all";

    let scheduledAt: Date | undefined;
    if (rawSchedule) {
      scheduledAt = new Date(rawSchedule);
      if (Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: "Invalid schedule time" }, { status: 400 });
      }
      if (scheduledAt.getTime() < Date.now() + 60 * 1000) {
        return NextResponse.json({ error: "Schedule time must be in the future" }, { status: 400 });
      }
      if (scheduledAt.getTime() > Date.now() + MAX_SCHEDULE_AHEAD_MS) {
        return NextResponse.json({ error: "You can schedule at most 90 days ahead" }, { status: 400 });
      }
    }

    // A double-click or retry would email every subscriber twice.
    const { success: withinLimit } = await rateLimit("admin-newsletter-send", {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!withinLimit) {
      return NextResponse.json(
        { error: "A newsletter was sent recently. You can send at most 3 per hour." },
        { status: 429 }
      );
    }

    if (!getTransporter()) {
      return NextResponse.json({ error: "SMTP is not configured" }, { status: 500 });
    }

    await connectDB();
    const createdBy = session.user.name || session.user.email;

    if (scheduledAt) {
      const campaign = await NewsletterCampaign.create({
        subject: subject.trim(),
        body,
        status: "scheduled",
        audience,
        scheduledAt,
        total: 0,
        createdBy,
      });
      await logAudit(session, {
        action: "newsletter.schedule",
        entity: "newsletter",
        entityId: String(campaign._id),
        summary: `Scheduled "${subject.trim().slice(0, 100)}" for ${scheduledAt.toISOString()} (${AUDIENCE_LABELS[audience]})`,
      });
      return NextResponse.json(
        { message: "Newsletter scheduled", campaignId: campaign._id, scheduledAt },
        { status: 201 }
      );
    }

    const running = await NewsletterCampaign.findOne({
      status: "sending",
      createdAt: { $gt: new Date(Date.now() - STALE_CAMPAIGN_MS) },
    }).lean();
    if (running) {
      return NextResponse.json({ error: "A newsletter is still being sent. Wait for it to finish." }, { status: 409 });
    }

    const emails = await resolveAudience(audience);
    if (emails.length === 0) {
      return NextResponse.json({ error: "No subscribers match that audience" }, { status: 400 });
    }

    const campaign = await NewsletterCampaign.create({
      subject: subject.trim(),
      body,
      status: "sending",
      audience,
      total: emails.length,
      createdBy,
    });

    // Runs after the response is sent; the platform keeps the function alive for it.
    after(() => deliverCampaign({ _id: campaign._id, subject: campaign.subject, body: campaign.body }, emails));

    await logAudit(session, {
      action: "newsletter.send",
      entity: "newsletter",
      entityId: String(campaign._id),
      summary: `Started sending "${subject.trim().slice(0, 100)}" to ${emails.length} subscribers (${AUDIENCE_LABELS[audience]})`,
    });

    return NextResponse.json(
      {
        message: `Sending to ${emails.length} subscriber${emails.length === 1 ? "" : "s"} in the background.`,
        campaignId: campaign._id,
        total: emails.length,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Newsletter send error:", error);
    return NextResponse.json({ error: "Failed to send newsletter" }, { status: 500 });
  }
}
