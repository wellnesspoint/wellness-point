import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Wishlist from "@/models/Wishlist";
import Review from "@/models/Review";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

const MAX_BULK_DELETE = 100;

export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users — bulk-delete customers.
 * Body: { ids: string[] }
 *
 * Admin accounts (and the caller's own account) are never deleted; they are
 * reported back as `skipped`. Wishlists and reviews of deleted users are
 * removed, matching the single-user delete.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Select at least one customer" }, { status: 400 });
    }
    if (ids.length > MAX_BULK_DELETE) {
      return NextResponse.json(
        { error: `You can delete at most ${MAX_BULK_DELETE} customers at a time` },
        { status: 400 }
      );
    }
    if (!ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    await connectDB();

    const uniqueIds = Array.from(new Set(ids as string[])).filter(
      (id) => id !== session.user.id
    );

    // Only non-admin accounts are deletable.
    const deletable = await User.find({ _id: { $in: uniqueIds }, role: { $ne: "admin" } })
      .select("_id")
      .lean();
    const deletableIds = deletable.map((u) => u._id.toString());

    if (deletableIds.length > 0) {
      await Promise.all([
        Wishlist.deleteMany({ user: { $in: deletableIds } }),
        Review.deleteMany({ user: { $in: deletableIds } }),
      ]);
      await User.deleteMany({ _id: { $in: deletableIds }, role: { $ne: "admin" } });
    }

    const deletedSet = new Set(deletableIds);
    const skipped = (ids as string[]).filter((id) => !deletedSet.has(id));

    return NextResponse.json({
      message: `${deletableIds.length} customer(s) deleted`,
      deleted: deletableIds,
      skipped: Array.from(new Set(skipped)),
    });
  } catch (error) {
    console.error("Bulk delete users error:", error);
    return NextResponse.json({ error: "Failed to delete customers" }, { status: 500 });
  }
}
