import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import nodemailer from "nodemailer";

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

    let sent = 0;
    let failed = 0;

    // Send emails in batches to avoid SMTP limits
    for (const sub of subscribers) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
          <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0">Wellness Point</h1>
          </div>
          <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
            <h2 style="color:#065f46;margin-top:0">${subject}</h2>
            <div style="color:#374151;line-height:1.6">${body.replace(/\n/g, "<br />")}</div>
          </div>
          <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
            © ${new Date().getFullYear()} Wellness Point. All rights reserved.<br />
            <a href="${baseUrl}" style="color:#065f46">Visit our store</a>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: sub.email,
          subject: `${subject} | Wellness Point`,
          html,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send to ${sub.email}:`, err);
        failed++;
      }

      // Small delay between emails to avoid rate limits
      if (sent % 10 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
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
