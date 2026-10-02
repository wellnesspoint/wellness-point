import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Contact from "@/models/Contact";
import User from "@/models/User";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parsePagination, escapeRegex, pageMeta, istDateRange } from "@/lib/pagination";

const EXPORT_CAP = 5000;
const STATUSES = ["new", "read", "replied", "archived"];

// GET /api/admin/contacts?page=&limit=&status=&q=&from=&to=&all=1
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("contacts", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "all";
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const assignee = sp.get("assignee") || "";
    const priority = sp.get("priority") || "";

    const filter: Record<string, unknown> = {};
    if (STATUSES.includes(status)) filter.status = status;
    if (assignee === "me") filter["assignedTo.id"] = session.user.id;
    else if (assignee === "unassigned") filter["assignedTo.id"] = { $exists: false };
    else if (assignee && /^[a-f0-9]{24}$/i.test(assignee)) filter["assignedTo.id"] = assignee;
    // Messages from before priorities existed have none: they count as "normal".
    if (["low", "normal", "high", "urgent"].includes(priority)) {
      filter.priority = priority === "normal" ? { $in: ["normal", null] } : priority;
    }
    const range = istDateRange(sp.get("from"), sp.get("to"));
    if (range) filter.createdAt = range;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { subject: rx }, { message: rx }];
    }

    const page = parsePagination(sp, { defaultLimit: 20, maxLimit: 100 });
    const query = Contact.find(filter).sort({ createdAt: -1 });
    if (sp.get("all") === "1") query.limit(EXPORT_CAP);
    else query.skip(page.skip).limit(page.limit);

    const [contacts, total, grouped, assignees] = await Promise.all([
      query.lean(),
      Contact.countDocuments(filter),
      Contact.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      // teammates a message can be assigned to
      User.find({ role: "admin", isActive: { $ne: false } }).select("name email").limit(50).lean(),
    ]);
    const counts: Record<string, number> = { new: 0, read: 0, replied: 0, archived: 0, all: 0 };
    for (const g of grouped) {
      counts[g._id] = g.n;
      counts.all += g.n;
    }

    return NextResponse.json({
      contacts,
      counts,
      assignees: assignees.map((a) => ({ _id: String(a._id), name: a.name, email: a.email })),
      me: session.user.id,
      ...pageMeta(total, page),
    });
  } catch (error) {
    console.error("Admin contacts list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
