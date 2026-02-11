import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "admin") {
    return null;
  }
  return session;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized: Admin access required" },
    { status: 403 }
  );
}
