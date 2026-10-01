import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/utils";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

// Large lists take a while to send — allow the function to run long enough.
export const maxDuration = 300;

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

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
 * Sends a newsletter email to all active subscribers.
 * Body: { subject: string, body: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { subject, body } = await req.json();

    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: "Subject and body are required" },
        { status: 400 }
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

    const subscribers = await NewsletterSubscriber.find({ isActive: true })
      .select("email")
      .lean();

    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: "No active subscribers" },
        { status: 400 }
      );
    }

    const fromAddress =
      process.env.SMTP_FROM_SUPPORT || "Wellness Point <support@wellness-point.in>";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in";

    // Escape admin-entered text before it goes into the HTML template.
    const safeSubject = escapeHtml(subject.trim());
    const safeBody = escapeHtml(body).replace(/\r?\n/g, "<br />");

    let sent = 0;
    let failed = 0;

    const sendTo = async (email: string) => {
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
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        failed++;
      }
    };

    // Small concurrent batches with a pause between them, to stay under SMTP
    // rate limits without sending one-by-one (which times out on big lists).
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((sub) => sendTo(sub.email)));
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    return NextResponse.json({
      message: `Newsletter sent! ${sent} delivered, ${failed} failed.`,
      sent,
      failed,
      total: subscribers.length,
    });
  } catch (error) {
    console.error("Newsletter send error:", error);
    return NextResponse.json(
      { error: "Failed to send newsletter" },
      { status: 500 }
    );
  }
}
