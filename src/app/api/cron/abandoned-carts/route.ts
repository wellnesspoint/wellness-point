import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Coupon from "@/models/Coupon";
import { sendAbandonedReminders } from "@/lib/abandoned";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * GET /api/cron/abandoned-carts — daily abandoned-checkout reminders.
 *
 * Opt-in: does nothing unless CRON_SECRET is set, and requires
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically
 * when the env var exists). Set ABANDONED_CART_COUPON to include a code in the
 * emails. See vercel.json for the schedule.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") || "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    let couponCode: string | undefined;
    const configured = process.env.ABANDONED_CART_COUPON?.trim().toUpperCase();
    if (configured) {
      const coupon = await Coupon.findOne({ code: configured, isActive: true }).lean();
      if (coupon) couponCode = coupon.code;
      else console.warn(`ABANDONED_CART_COUPON ${configured} not found/active — sending without it`);
    }

    const result = await sendAbandonedReminders({ couponCode });
    await logAudit(null, {
      action: "abandoned.cron",
      entity: "order",
      summary: `Automatic run: ${result.sent} reminder(s) sent, ${result.skipped} skipped, ${result.failed} failed`,
      meta: { ...result, couponCode },
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Abandoned-cart cron error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
