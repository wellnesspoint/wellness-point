import { NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { getAdminCookieName } from "@/lib/admin-auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/auth/logout-all
 * Signs this admin out on EVERY device. Admin tokens issued before
 * `passwordChangedAt` are rejected by verifyAdminToken, so moving that timestamp
 * to now invalidates all of them (including this one, whose cookie is cleared).
 * Use after losing a device or signing in on a shared computer.
 */
export async function POST() {
  try {
    const session = await checkAdmin("self", "manage");
    if (!session) return unauthorizedResponse();

    await connectDB();
    await User.updateOne({ _id: session.user.id }, { $set: { passwordChangedAt: new Date() } });
    await logAudit(session, {
      action: "admin.logout_all",
      entity: "admin",
      entityId: session.user.id,
      summary: `${session.user.email} signed out of all devices`,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set(getAdminCookieName(), "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error("Admin logout-all error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
