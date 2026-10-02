import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { removeUsers } from "@/lib/user-deletion";
import { logAudit } from "@/lib/audit";
import { USER_PUBLIC_FIELDS } from "@/lib/user-fields";
import { getCustomerStats } from "@/lib/customer-stats";
import { escapeRegex, pageMeta, parsePagination } from "@/lib/pagination";

import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

const MAX_BULK_DELETE = 100;
const EXPORT_LIMIT = 5000;

/**
 * GET /api/admin/users?page=&limit=&q=&status=active|blocked&role=user|admin&all=1
 * `all=1` is export mode (up to 5000 rows, no paging).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("customers", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();

    const sp = new URL(req.url).searchParams;
    const paging = parsePagination(sp);
    const exportAll = sp.get("all") === "1";

    const filter: Record<string, unknown> = { anonymizedAt: { $exists: false } };
    const q = (sp.get("q") || "").trim().slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }
    const status = sp.get("status");
    if (status === "active") filter.isActive = { $ne: false };
    else if (status === "blocked") filter.isActive = false;
    const role = sp.get("role");
    if (role === "user" || role === "admin") filter.role = role;

    const query = User.find(filter).select(USER_PUBLIC_FIELDS).sort({ createdAt: -1 });
    if (exportAll) query.limit(EXPORT_LIMIT);
    else query.skip(paging.skip).limit(paging.limit);

    const [users, total] = await Promise.all([query.lean(), User.countDocuments(filter)]);

    // Lifetime stats for just these customers, in one aggregation.
    const stats = await getCustomerStats(users.map((u) => u._id));
    const withStats = users.map((u) => {
      const s = stats.get(String(u._id));
      return { ...u, orderCount: s?.orderCount ?? 0, totalSpent: s?.totalSpent ?? 0, lastOrderAt: s?.lastOrderAt };
    });

    return NextResponse.json({ users: withStats, ...pageMeta(total, paging) });
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
 * removed, matching the single-user delete. Customers with past orders are
 * anonymised rather than removed so order history stays intact.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await checkAdmin("customers", "manage");
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

    const { deleted, anonymized } = await removeUsers(deletableIds);

    if (deletableIds.length > 0) {
      await logAudit(session, {
        action: "user.bulk_delete",
        entity: "user",
        summary: `Bulk-removed ${deletableIds.length} customer(s) (${anonymized.length} anonymised)`,
        meta: { ids: deletableIds },
      });
    }

    const deletedSet = new Set(deletableIds);
    const skipped = (ids as string[]).filter((id) => !deletedSet.has(id));

    return NextResponse.json({
      message: `${deletableIds.length} customer(s) deleted`,
      deleted: deletableIds,
      // Subset of `deleted` that had orders and was anonymised, not removed.
      anonymized,
      removed: deleted,
      skipped: Array.from(new Set(skipped)),
    });
  } catch (error) {
    console.error("Bulk delete users error:", error);
    return NextResponse.json({ error: "Failed to delete customers" }, { status: 500 });
  }
}
