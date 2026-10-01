import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { escapeRegex, istDateRange, pageMeta, parsePagination } from "@/lib/pagination";

/** GET /api/admin/audit?page=&limit=&entity=&q=&from=&to= — newest first. */
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    const sp = new URL(req.url).searchParams;
    const paging = parsePagination(sp, { defaultLimit: 30 });

    const filter: Record<string, unknown> = {};
    const entity = sp.get("entity");
    if (entity && entity !== "all") filter.entity = entity;

    const q = (sp.get("q") || "").trim().slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ summary: rx }, { action: rx }, { "actor.email": rx }, { "actor.name": rx }];
    }
    const range = istDateRange(sp.get("from"), sp.get("to"));
    if (range) filter.createdAt = range;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({ logs, ...pageMeta(total, paging) });
  } catch (error) {
    console.error("Admin audit list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
