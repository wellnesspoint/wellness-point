import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import connectDB from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import { calcOrderTotal } from "@/lib/order-math";
import { removeUsers } from "@/lib/user-deletion";
import { logAudit } from "@/lib/audit";
import { can, ADMIN_ROLES } from "@/lib/permissions";
import { USER_PUBLIC_FIELDS } from "@/lib/user-fields";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin("customers", "view");
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const user = await User.findById(id).select(USER_PUBLIC_FIELDS).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Abandoned checkouts ("pending") aren't orders; keep them out of the history and counts.
    const orders = await Order.find({ user: id, paymentStatus: { $ne: "pending" } })
      .sort({ createdAt: -1 })
      .lean();

    const totalSpent = orders
      .filter((o: any) => o.paymentStatus === "paid")
      .reduce((sum: number, o: any) => sum + calcOrderTotal(o) - (o.refundedAmount || 0), 0);

    return NextResponse.json({
      user: { ...user, orderCount: orders.length, totalSpent },
      orders,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin("customers", "manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const body = await request.json();
    const updateFields: any = {};

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
      }
      updateFields.isActive = body.isActive;
      // Blocking an admin account is a team action, not a customer-support one.
      if (!can(session.user.adminRole, "team", "manage")) {
        const target = await User.findById(id).select("role").lean();
        if (target?.role === "admin") {
          return NextResponse.json({ error: "Only an owner can block an admin account" }, { status: 403 });
        }
      }
    }

    if (body.role !== undefined) {
      if (body.role !== "user" && body.role !== "admin") {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      // Granting or removing admin access is a team-management action.
      if (!can(session.user.adminRole, "team", "manage")) {
        return NextResponse.json({ error: "Only an owner can change admin access" }, { status: 403 });
      }
      updateFields.role = body.role;
      // New admins start with the least-privileged staff role; an owner can raise it on the Team page.
      if (body.role === "admin") {
        const current = await User.findById(id).select("role adminRole").lean();
        if (current?.role !== "admin") updateFields.adminRole = "support";
      }
    }

    // An admin must not lock themselves out (deactivate or demote their own
    // account) — that would leave the store with no way back in.
    if (
      id === session.user.id &&
      (updateFields.isActive === false || (updateFields.role && updateFields.role !== "admin"))
    ) {
      return NextResponse.json(
        { error: "You cannot deactivate or demote your own account" },
        { status: 400 }
      );
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    ).select(USER_PUBLIC_FIELDS);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAudit(session, {
      action: updateFields.role !== undefined ? "user.role" : "user.access",
      entity: "user",
      entityId: id,
      summary: `${user.email}: ${Object.entries(updateFields)
        .map(([k, v]) => `${k} → ${v}`)
        .join(", ")}`,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdmin("customers", "manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  await connectDB();

  try {
    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "admin") {
      return NextResponse.json(
        { error: "Cannot delete admin users" },
        { status: 403 }
      );
    }

    const { anonymized } = await removeUsers([id]);

    await logAudit(session, {
      action: "user.delete",
      entity: "user",
      entityId: id,
      summary: `${anonymized.length ? "Anonymised" : "Deleted"} customer ${user.email}`,
    });

    return NextResponse.json({
      message: anonymized.length
        ? "User has past orders, so the account was anonymised instead of deleted"
        : "User deleted",
      anonymized: anonymized.length > 0,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
