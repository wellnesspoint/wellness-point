import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/admin-auth";

export async function checkAdmin() {
  const admin = await verifyAdminToken();
  if (!admin) return null;
  return { user: admin };
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized: Admin access required" },
    { status: 403 }
  );
}
