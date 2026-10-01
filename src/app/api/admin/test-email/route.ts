import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import nodemailer from "nodemailer";

/**
 * POST /api/admin/test-email
 *
 * Sends a test email from both SMTP accounts to diagnose email issues.
 * Admin-only endpoint.
 *
 * Body: { to?: string }  — defaults to admin email
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    // A test mail only ever goes to the signed-in admin; accepting an
    // arbitrary `to` made this endpoint an open relay for the store's SMTP.
    const testTo = (session.user as any)?.email as string | undefined;
    if (!testTo) {
      return NextResponse.json({ error: "Admin account has no email" }, { status: 400 });
    }

    const results: Record<string, any> = {};

    // ─── Test Support SMTP ───────────────────────────────────────
    const supportConfig = {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_SUPPORT_USER,
      pass: process.env.SMTP_SUPPORT_PASS,
      from: process.env.SMTP_FROM_SUPPORT || "Wellness Point <support@wellness-point.in>",
    };

    results.support = { configured: !!(supportConfig.host && supportConfig.user && supportConfig.pass) };

    if (results.support.configured) {
      try {
        const transporter = nodemailer.createTransport({
          host: supportConfig.host,
          port: supportConfig.port,
          secure: supportConfig.port === 465,
          auth: { user: supportConfig.user, pass: supportConfig.pass },
        });

        // Verify SMTP connection
        await transporter.verify();
        results.support.smtpConnection = "OK";

        // Send test email
        await transporter.sendMail({
          from: supportConfig.from,
          to: testTo,
          subject: "✅ Wellness Point — Support Email Test",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px">
              <div style="text-align:center;padding:16px;background:#065f46;border-radius:8px 8px 0 0">
                <h2 style="color:#fff;margin:0">Wellness Point</h2>
              </div>
              <div style="padding:20px;background:#f9fafb;border:1px solid #e5e7eb">
                <p>✅ <strong>Support email is working!</strong></p>
                <p style="color:#6b7280;font-size:13px">
                  Sent from: <code>${supportConfig.user}</code><br/>
                  To: <code>${testTo}</code><br/>
                  Time: ${new Date().toISOString()}
                </p>
              </div>
            </div>
          `,
        });
        results.support.emailSent = true;
        results.support.sentTo = testTo;
      } catch (err: any) {
        results.support.error = err.message || String(err);
        results.support.code = err.code;
        results.support.emailSent = false;
      }
    } else {
      results.support.missing = {
        SMTP_HOST: !supportConfig.host,
        SMTP_SUPPORT_USER: !supportConfig.user,
        SMTP_SUPPORT_PASS: !supportConfig.pass,
      };
    }

    // ─── Test Orders SMTP ────────────────────────────────────────
    const ordersConfig = {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_ORDERS_USER,
      pass: process.env.SMTP_ORDERS_PASS,
      from: process.env.SMTP_FROM_ORDERS || "Wellness Point <orders@wellness-point.in>",
    };

    results.orders = { configured: !!(ordersConfig.host && ordersConfig.user && ordersConfig.pass) };

    if (results.orders.configured) {
      try {
        const transporter = nodemailer.createTransport({
          host: ordersConfig.host,
          port: ordersConfig.port,
          secure: ordersConfig.port === 465,
          auth: { user: ordersConfig.user, pass: ordersConfig.pass },
        });

        // Verify SMTP connection
        await transporter.verify();
        results.orders.smtpConnection = "OK";

        // Send test email
        await transporter.sendMail({
          from: ordersConfig.from,
          to: testTo,
          subject: "✅ Wellness Point — Orders Email Test",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px">
              <div style="text-align:center;padding:16px;background:#065f46;border-radius:8px 8px 0 0">
                <h2 style="color:#fff;margin:0">Wellness Point</h2>
              </div>
              <div style="padding:20px;background:#f9fafb;border:1px solid #e5e7eb">
                <p>✅ <strong>Orders email is working!</strong></p>
                <p style="color:#6b7280;font-size:13px">
                  Sent from: <code>${ordersConfig.user}</code><br/>
                  To: <code>${testTo}</code><br/>
                  Time: ${new Date().toISOString()}
                </p>
              </div>
            </div>
          `,
        });
        results.orders.emailSent = true;
        results.orders.sentTo = testTo;
      } catch (err: any) {
        results.orders.error = err.message || String(err);
        results.orders.code = err.code;
        results.orders.emailSent = false;
      }
    } else {
      results.orders.missing = {
        SMTP_HOST: !ordersConfig.host,
        SMTP_ORDERS_USER: !ordersConfig.user,
        SMTP_ORDERS_PASS: !ordersConfig.pass,
      };
    }

    // ─── Summary ─────────────────────────────────────────────────
    const allWorking = results.support.emailSent && results.orders.emailSent;

    return NextResponse.json({
      success: allWorking,
      message: allWorking
        ? "Both email accounts are working! Check your inbox."
        : "One or more email accounts failed. See details below.",
      testSentTo: testTo,
      results,
    });
  } catch (error: any) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: "Test email failed", details: error.message },
      { status: 500 }
    );
  }
}
