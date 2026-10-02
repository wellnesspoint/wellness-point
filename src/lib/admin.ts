import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";
import { can, type Area, type Level } from "@/lib/permissions";

/**
 * Authenticate the admin and (when `area` is given) check their staff role may
 * use that area. Returns null for "not signed in" and for "not allowed", so
 * routes keep the single `if (!session) return unauthorizedResponse()` shape.
 * `level` defaults to "view"; pass "manage" for anything that changes data.
 */
export async function checkAdmin(area?: Area, level: Level = "view") {
  const admin = await verifyAdminToken();
  if (!admin) return null;
  if (area && !can(admin.adminRole, area, level)) return null;
  return { user: admin };
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized: Admin access required" },
    { status: 403 }
  );
}
