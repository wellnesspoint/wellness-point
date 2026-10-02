import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AuditLog from "@/models/AuditLog";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { escapeRegex, istDateRange, pageMeta, parsePagination } from "@/lib/pagination";

/** GET /api/admin/audit?page=&limit=&entity=&actor=<email>&q=&from=&to=&all=1 — newest first. ?all=1 is the CSV-export mode (capped at 5000). */
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("audit", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();

    const sp = new URL(req.url).searchParams;
    const paging = parsePagination(sp, { defaultLimit: 30 });

    const filter: Record<string, unknown> = {};
    const entity = sp.get("entity");
    if (entity && entity !== "all") filter.entity = entity;

    const actor = (sp.get("actor") || "").trim().toLowerCase().slice(0, 120);
    if (actor === "system") filter["actor.email"] = { $exists: false };
    else if (actor) filter["actor.email"] = actor;

    const q = (sp.get("q") || "").trim().slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ summary: rx }, { action: rx }, { "actor.email": rx }, { "actor.name": rx }];
    }
    const range = istDateRange(sp.get("from"), sp.get("to"));
    if (range) filter.createdAt = range;

    const exportAll = sp.get("all") === "1";
    const listQuery = AuditLog.find(filter).sort({ createdAt: -1 });
    if (exportAll) listQuery.limit(5000);
    else listQuery.skip(paging.skip).limit(paging.limit);

    const [logs, total, actors] = await Promise.all([
      listQuery.lean(),
      AuditLog.countDocuments(filter),
      exportAll ? Promise.resolve([]) : AuditLog.distinct("actor.email"),
    ]);

    return NextResponse.json({
      logs,
      actors: (actors as string[]).filter(Boolean).sort().slice(0, 100),
      ...pageMeta(total, paging),
    });
  } catch (error) {
    console.error("Admin audit list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
