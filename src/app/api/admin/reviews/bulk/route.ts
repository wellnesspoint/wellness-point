import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Review from "@/models/Review";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { recalculateProductRating } from "@/lib/review-rating";
import { logAudit } from "@/lib/audit";

const MAX_BULK = 200;
const ACTIONS = ["approve", "unapprove", "delete"] as const;

/** POST /api/admin/reviews/bulk  { ids: string[], action: "approve"|"unapprove"|"delete" } */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("reviews", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;
    const action = body?.action;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK) {
      return NextResponse.json(
        { error: `Select between 1 and ${MAX_BULK} reviews` },
        { status: 400 }
      );
    }
    const validIds = ids.filter(
      (i): i is string => typeof i === "string" && mongoose.isValidObjectId(i)
    );
    if (validIds.length !== ids.length) {
      return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
    }

    await connectDB();
    const products = await Review.distinct("product", { _id: { $in: validIds } });

    let affected: number;
    if (action === "delete") {
      affected = (await Review.deleteMany({ _id: { $in: validIds } })).deletedCount ?? 0;
    } else {
      affected = (
        await Review.updateMany(
          { _id: { $in: validIds } },
          { $set: { isApproved: action === "approve" } }
        )
      ).modifiedCount;
    }

    await Promise.all(products.map((p) => recalculateProductRating(String(p))));
    await logAudit(session, {
      action: `review.bulk_${action}`,
      entity: "review",
      summary: `Bulk ${action} on ${validIds.length} review(s)`,
      meta: { ids: validIds },
    });

    return NextResponse.json({ affected });
  } catch (error) {
    console.error("Admin reviews bulk error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
