import { NextRequest, NextResponse, after } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import NewsletterCampaign from "@/models/NewsletterCampaign";
import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

// Large lists take a while to send — allow the background work to run long enough.
export const maxDuration = 300;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
// A campaign still "sending" after this long is treated as dead (function killed).
const STALE_CAMPAIGN_MS = 30 * 60 * 1000;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_SUPPORT_USER;
  const pass = process.env.SMTP_SUPPORT_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * POST /api/admin/newsletter/send
 * Starts sending a newsletter to all active subscribers and returns right away
 * (202). The sending itself continues in the background; progress is recorded on
 * a NewsletterCampaign document that the admin page polls.
 * Body: { subject: string, body: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { subject, body } = await req.json().catch(() => ({}));

    if (typeof subject !== "string" || typeof body !== "string" || !subject.trim() || !body.trim()) {
      return NextResponse.json(
        { error: "Subject and body are required" },
        { status: 400 }
      );
    }
    if (subject.length > 200 || body.length > 20000) {
      return NextResponse.json({ error: "Subject (200) or body (20000) is too long" }, { status: 400 });
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

    const transporter = getTransporter();
    if (!transporter) {
      return NextResponse.json(
        { error: "SMTP is not configured" },
        { status: 500 }
      );
    }

    await connectDB();

    const running = await NewsletterCampaign.findOne({
      status: "sending",
      createdAt: { $gt: new Date(Date.now() - STALE_CAMPAIGN_MS) },
    }).lean();
    if (running) {
      return NextResponse.json(
        { error: "A newsletter is still being sent. Wait for it to finish." },
        { status: 409 }
      );
    }

    const subscribers = await NewsletterSubscriber.find({ isActive: true })
      .select("email")
      .lean();

    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: "No active subscribers" },
        { status: 400 }
      );
    }

    const campaign = await NewsletterCampaign.create({
      subject: subject.trim(),
      body,
      status: "sending",
      total: subscribers.length,
      createdBy: session.user.name || session.user.email,
    });

    const fromAddress =
      process.env.SMTP_FROM_SUPPORT || "Wellness Point <support@wellness-point.in>";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in";

    // Escape admin-entered text before it goes into the HTML template.
    const safeSubject = escapeHtml(subject.trim());
    const safeBody = escapeHtml(body).replace(/\r?\n/g, "<br />");

    const sendTo = async (email: string): Promise<boolean> => {
      const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, email);

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
          <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0">Wellness Point</h1>
          </div>
          <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
            <h2 style="color:#065f46;margin-top:0">${safeSubject}</h2>
            <div style="color:#374151;line-height:1.6">${safeBody}</div>
          </div>
          <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
            &copy; ${new Date().getFullYear()} Wellness Point. All rights reserved.<br />
            <a href="${baseUrl}" style="color:#065f46">Visit our store</a><br /><br />
            <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline">Unsubscribe from newsletter</a>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject: `${subject.trim()} | Wellness Point`,
          html,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        });
        return true;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        return false;
      }
    };

    const campaignId = campaign._id;

    // Runs after the response is sent; the platform keeps the function alive for it.
    after(async () => {
      let sent = 0;
      let failed = 0;
      try {
        // Small concurrent batches with a pause between them, to stay under SMTP rate limits.
        for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
          const batch = subscribers.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(batch.map((sub) => sendTo(sub.email)));
          const ok = results.filter(Boolean).length;
          sent += ok;
          failed += results.length - ok;
          await NewsletterCampaign.updateOne({ _id: campaignId }, { $set: { sent, failed } });
          if (i + BATCH_SIZE < subscribers.length) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
          }
        }
        await NewsletterCampaign.updateOne(
          { _id: campaignId },
          { $set: { status: sent === 0 ? "failed" : "done", sent, failed, finishedAt: new Date() } }
        );
      } catch (err) {
        console.error("Newsletter background send crashed:", err);
        await NewsletterCampaign.updateOne(
          { _id: campaignId },
          { $set: { status: "failed", sent, failed, finishedAt: new Date() } }
        ).catch(() => {});
      }
    });

    await logAudit(session, {
      action: "newsletter.send",
      entity: "newsletter",
      entityId: campaignId.toString(),
      summary: `Started sending "${subject.trim().slice(0, 100)}" to ${subscribers.length} subscribers`,
    });

    return NextResponse.json(
      {
        message: `Sending to ${subscribers.length} subscriber${subscribers.length === 1 ? "" : "s"} in the background.`,
        campaignId,
        total: subscribers.length,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Newsletter send error:", error);
    return NextResponse.json(
      { error: "Failed to send newsletter" },
      { status: 500 }
    );
  }
}
