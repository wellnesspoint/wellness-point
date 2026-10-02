import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { effectiveRole, ADMIN_ROLES, type AdminRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

/** Active owners other than `exceptId` (legacy admins without a role count as owners). */
async function otherActiveOwners(exceptId: string) {
  return User.countDocuments({
    role: "admin",
    isActive: { $ne: false },
    _id: { $ne: exceptId },
    $or: [{ adminRole: "owner" }, { adminRole: { $exists: false } }, { adminRole: null }],
  });
}

/**
 * PUT /api/admin/team/[id] { adminRole?, isActive? }
 * Change a teammate's role or block them. The store must always keep an active
 * owner, and you cannot change your own role (so you can't lock yourself out).
 */
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("team", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    const update: Record<string, unknown> = {};

    if (body?.adminRole !== undefined) {
      if (!ADMIN_ROLES.includes(body.adminRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      update.adminRole = body.adminRole as AdminRole;
    }
    if (body?.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
      }
      update.isActive = body.isActive;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot change your own role or access" }, { status: 400 });
    }

    await connectDB();
    const target = await User.findOne({ _id: id, role: "admin" }).select("email adminRole isActive");
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const losingOwner =
      effectiveRole(target.adminRole) === "owner" &&
      ((update.adminRole && update.adminRole !== "owner") || update.isActive === false);
    if (losingOwner && (await otherActiveOwners(id)) === 0) {
      return NextResponse.json({ error: "There must always be at least one active owner" }, { status: 400 });
    }

    const before = { adminRole: effectiveRole(target.adminRole), isActive: target.isActive !== false };
    await User.updateOne({ _id: id }, { $set: update });
    await logAudit(session, {
      action: "team.update",
      entity: "user",
      entityId: id,
      summary: `${target.email}: ${Object.entries(update).map(([k, v]) => `${k} ${String((before as Record<string, unknown>)[k])} → ${String(v)}`).join(", ")}`,
    });
    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("Admin team update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/admin/team/[id] — remove admin access (account stays as a normal customer). */
export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("team", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot remove your own admin access" }, { status: 400 });
    }

    await connectDB();
    const target = await User.findOne({ _id: id, role: "admin" }).select("email adminRole");
    if (!target) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }
    if (effectiveRole(target.adminRole) === "owner" && (await otherActiveOwners(id)) === 0) {
      return NextResponse.json({ error: "There must always be at least one active owner" }, { status: 400 });
    }

    await User.updateOne(
      { _id: id },
      { $set: { role: "user", passwordChangedAt: new Date() }, $unset: { adminRole: "" } }
    );
    await logAudit(session, {
      action: "team.remove",
      entity: "user",
      entityId: id,
      summary: `Removed admin access for ${target.email}`,
    });
    return NextResponse.json({ message: "Admin access removed" });
  } catch (error) {
    console.error("Admin team remove error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
