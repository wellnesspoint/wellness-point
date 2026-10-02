import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Coupon from "@/models/Coupon";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

const MAX_BULK = 100;

/** POST /api/admin/coupons/bulk { ids, action: "enable"|"disable"|"delete" } */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("coupons", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const ids = body?.ids;
    if (!["enable", "disable", "delete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK ||
      !ids.every((i) => typeof i === "string" && mongoose.isValidObjectId(i))
    ) {
      return NextResponse.json({ error: `Select 1-${MAX_BULK} valid coupons` }, { status: 400 });
    }

    await connectDB();
    const codes = (await Coupon.find({ _id: { $in: ids } }).select("code").lean()).map((c) => c.code);
    // Past orders keep their discount (usage is counted from orders), so deleting is safe.
    const affected =
      action === "delete"
        ? (await Coupon.deleteMany({ _id: { $in: ids } })).deletedCount ?? 0
        : (await Coupon.updateMany({ _id: { $in: ids } }, { $set: { isActive: action === "enable" } })).modifiedCount;

    await logAudit(session, {
      action: `coupon.bulk_${action}`,
      entity: "coupon",
      summary: `Bulk ${action} on ${codes.length} coupon(s): ${codes.join(", ").slice(0, 300)}`,
      meta: { ids },
    });
    return NextResponse.json({ affected });
  } catch (error) {
    console.error("Admin coupons bulk error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
