import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import Coupon from "@/models/Coupon";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { abandonedFilter, sendAbandonedReminders } from "@/lib/abandoned";
import { calcOrderTotal } from "@/lib/order-math";
import { logAudit } from "@/lib/audit";
import { pageMeta, parsePagination } from "@/lib/pagination";
import { rateLimit } from "@/lib/rate-limit";

/** GET /api/admin/abandoned?page= — recoverable abandoned checkouts (1 hour – 7 days old). */
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const paging = parsePagination(new URL(req.url).searchParams, { defaultLimit: 25 });
    const filter = abandonedFilter();

    const [orders, total, notReminded] = await Promise.all([
      Order.find(filter)
        .select("user items shipping discount shippingAddress createdAt reminderSentAt")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(paging.skip)
        .limit(paging.limit)
        .lean(),
      Order.countDocuments(filter),
      Order.countDocuments({ ...filter, reminderSentAt: { $exists: false } }),
    ]);

    return NextResponse.json({
      orders: orders.map((o: any) => ({ ...o, total: calcOrderTotal(o) })),
      notReminded,
      ...pageMeta(total, paging),
    });
  } catch (error) {
    console.error("Admin abandoned list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/abandoned  { ids?: string[], couponCode?: string }
 * Sends reminder emails (to the given orders, or every not-yet-reminded one).
 * An optional coupon code is validated and included in the email.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    let ids: string[] | undefined;
    if (body.ids !== undefined) {
      if (
        !Array.isArray(body.ids) ||
        body.ids.length === 0 ||
        body.ids.length > 200 ||
        !body.ids.every((id: unknown) => typeof id === "string" && mongoose.isValidObjectId(id))
      ) {
        return NextResponse.json({ error: "Invalid order selection" }, { status: 400 });
      }
      ids = body.ids;
    }

    // Emails real customers — guard against repeated clicks.
    const { success } = await rateLimit(`admin-abandoned-send:${session.user.id}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!success) {
      return NextResponse.json({ error: "Too many sends. Please try again later." }, { status: 429 });
    }

    await connectDB();

    let couponCode: string | undefined;
    if (body.couponCode) {
      const code = String(body.couponCode).trim().toUpperCase();
      const coupon = await Coupon.findOne({ code, isActive: true }).lean();
      if (!coupon) {
        return NextResponse.json({ error: `Coupon ${code} doesn't exist or isn't active` }, { status: 400 });
      }
      couponCode = coupon.code;
    }

    const result = await sendAbandonedReminders({ ids, couponCode });

    await logAudit(session, {
      action: "abandoned.remind",
      entity: "order",
      summary: `Sent ${result.sent} abandoned-cart reminder(s)${couponCode ? ` with coupon ${couponCode}` : ""} (${result.skipped} skipped, ${result.failed} failed)`,
      meta: { ...result, couponCode },
    });

    return NextResponse.json({
      ...result,
      message: `${result.sent} reminder${result.sent === 1 ? "" : "s"} sent${result.skipped ? `, ${result.skipped} skipped (already paid or duplicate customer)` : ""}${result.failed ? `, ${result.failed} failed` : ""}.`,
    });
  } catch (error) {
    console.error("Admin abandoned send error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
