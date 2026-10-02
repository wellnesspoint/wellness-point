import { NextResponse } from "next/server";
import { getSiteStatus } from "@/lib/site-status";

/**
 * GET /api/site-status — public, tiny: whether maintenance mode is on and the active
 * redirect rules. Read by proxy.ts (cached 30 s) so storefront pages stay static.
 */
export async function GET() {
  const status = await getSiteStatus();
  const res = NextResponse.json(status);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
