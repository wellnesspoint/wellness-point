import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { effectiveRole, ADMIN_ROLES, type AdminRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

/** GET /api/admin/team — everyone with admin access and their staff role. */
export async function GET() {
  try {
    const session = await checkAdmin("team", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const admins = await User.find({ role: "admin", anonymizedAt: { $exists: false } })
      .select("name email isActive adminRole twoFactorEnabled createdAt")
      .sort({ createdAt: 1 })
      .lean();

    return NextResponse.json({
      admins: admins.map((a) => ({
        _id: a._id,
        name: a.name,
        email: a.email,
        isActive: a.isActive !== false,
        twoFactorEnabled: !!a.twoFactorEnabled,
        adminRole: effectiveRole(a.adminRole),
        legacy: !a.adminRole,
        isYou: String(a._id) === session.user.id,
      })),
    });
  } catch (error) {
    console.error("Admin team list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/team { email, adminRole }
 * Gives an existing registered customer admin access with the chosen role.
 * (They sign in at /admin/login with their normal password, and set up 2FA there.)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("team", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const adminRole = body?.adminRole as AdminRole;
    if (!email || !ADMIN_ROLES.includes(adminRole)) {
      return NextResponse.json({ error: "A valid email and role are required" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email, anonymizedAt: { $exists: false } });
    if (!user) {
      return NextResponse.json(
        { error: "No customer account with that email. Ask them to register first." },
        { status: 404 }
      );
    }
    if (user.role === "admin") {
      return NextResponse.json({ error: "That person is already an admin" }, { status: 409 });
    }
    if (user.isActive === false) {
      return NextResponse.json({ error: "That account is blocked" }, { status: 400 });
    }

    user.role = "admin";
    user.adminRole = adminRole;
    await user.save();
    await logAudit(session, {
      action: "team.add",
      entity: "user",
      entityId: String(user._id),
      summary: `Gave ${user.email} admin access as ${adminRole}`,
    });
    return NextResponse.json({ message: "Admin added" }, { status: 201 });
  } catch (error) {
    console.error("Admin team add error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
