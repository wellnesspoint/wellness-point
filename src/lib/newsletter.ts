import nodemailer from "nodemailer";
import connectDB from "./db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import NewsletterCampaign from "@/models/NewsletterCampaign";
import Order from "@/models/Order";
import User from "@/models/User";
import { escapeHtml } from "./utils";
import { buildUnsubscribeUrl } from "./unsubscribe";
import type { Audience } from "./newsletter-audiences";

export { AUDIENCES, AUDIENCE_LABELS, type Audience } from "./newsletter-audiences";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_SUPPORT_USER;
  const pass = process.env.SMTP_SUPPORT_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

/** Emails of active subscribers in the chosen audience. "Bought" = a user with a paid order. */
export async function resolveAudience(audience: Audience): Promise<string[]> {
  await connectDB();
  const base = { isActive: true };

  if (audience === "recent") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const subs = await NewsletterSubscriber.find({ ...base, createdAt: { $gte: since } }).select("email").lean();
    return subs.map((s) => s.email);
  }

  const subs = await NewsletterSubscriber.find(base).select("email").lean();
  if (audience === "all") return subs.map((s) => s.email);

  const buyerIds = await Order.distinct("user", { paymentStatus: "paid" });
  const buyers = await User.find({ _id: { $in: buyerIds } }).select("email").lean();
  const buyerEmails = new Set(buyers.map((u) => (u.email || "").toLowerCase()));
  return subs
    .map((s) => s.email)
    .filter((e) => (audience === "customers" ? buyerEmails.has(e.toLowerCase()) : !buyerEmails.has(e.toLowerCase())));
}

function renderHtml(subject: string, body: string, unsubscribeUrl: string, baseUrl: string) {
  // Escape admin-entered text before it goes into the HTML template.
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(body).replace(/\r?\n/g, "<br />");
  return `
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
}

/**
 * Sends a campaign that is already in "sending" state to `emails`, in small batches,
 * recording progress on the campaign. Never throws: failures end up on the campaign.
 */
export async function deliverCampaign(
  campaign: { _id: unknown; subject: string; body: string },
  emails: string[]
): Promise<void> {
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM_SUPPORT || "Wellness Point <support@wellness-point.in>";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in";
  const subject = campaign.subject.trim();
  let sent = 0;
  let failed = 0;

  try {
    if (!transporter) throw new Error("SMTP is not configured");

    const sendTo = async (email: string): Promise<boolean> => {
      const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, email);
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject: `${subject} | Wellness Point`,
          html: renderHtml(subject, campaign.body, unsubscribeUrl, baseUrl),
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        });
        return true;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        return false;
      }
    };

    // Small concurrent batches with a pause between them, to stay under SMTP rate limits.
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const results = await Promise.all(emails.slice(i, i + BATCH_SIZE).map(sendTo));
      const ok = results.filter(Boolean).length;
      sent += ok;
      failed += results.length - ok;
      await NewsletterCampaign.updateOne({ _id: campaign._id }, { $set: { sent, failed } });
      if (i + BATCH_SIZE < emails.length) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
    await NewsletterCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: sent === 0 ? "failed" : "done", sent, failed, finishedAt: new Date() } }
    );
  } catch (err) {
    console.error("Newsletter background send crashed:", err);
    await NewsletterCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: "failed", sent, failed, finishedAt: new Date() } }
    ).catch(() => {});
  }
}
