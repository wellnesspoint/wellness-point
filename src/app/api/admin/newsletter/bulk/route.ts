import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

const MAX_BULK = 500;

/** POST /api/admin/newsletter/bulk { ids, action: "delete"|"unsubscribe"|"resubscribe" } */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("marketing", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const ids = body?.ids;
    if (!["delete", "unsubscribe", "resubscribe"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK ||
      !ids.every((i) => typeof i === "string" && mongoose.isValidObjectId(i))
    ) {
      return NextResponse.json({ error: `Select 1-${MAX_BULK} valid subscribers` }, { status: 400 });
    }

    await connectDB();
    const affected =
      action === "delete"
        ? (await NewsletterSubscriber.deleteMany({ _id: { $in: ids } })).deletedCount ?? 0
        : (
            await NewsletterSubscriber.updateMany(
              { _id: { $in: ids } },
              { $set: { isActive: action === "resubscribe" } }
            )
          ).modifiedCount;

    await logAudit(session, {
      action: `subscriber.bulk_${action}`,
      entity: "subscriber",
      summary: `Bulk ${action} on ${ids.length} subscriber(s)`,
      meta: { ids },
    });
    return NextResponse.json({ affected });
  } catch (error) {
    console.error("Admin newsletter bulk error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
