import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Contact from "@/models/Contact";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

const MAX_BULK = 200;
const STATUSES = ["new", "read", "archived"]; // "replied" is only set by sending a reply

/** POST /api/admin/contacts/bulk { ids, action: "read"|"new"|"archived"|"delete" } */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("contacts", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const ids = body?.ids;
    if (action !== "delete" && !STATUSES.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK ||
      !ids.every((i) => typeof i === "string" && mongoose.isValidObjectId(i))
    ) {
      return NextResponse.json({ error: `Select 1-${MAX_BULK} valid messages` }, { status: 400 });
    }

    await connectDB();
    const affected =
      action === "delete"
        ? (await Contact.deleteMany({ _id: { $in: ids } })).deletedCount ?? 0
        : (await Contact.updateMany({ _id: { $in: ids } }, { $set: { status: action } })).modifiedCount;

    await logAudit(session, {
      action: `contact.bulk_${action}`,
      entity: "contact",
      summary: `Bulk ${action} on ${ids.length} contact message(s)`,
      meta: { ids },
    });
    return NextResponse.json({ affected });
  } catch (error) {
    console.error("Admin contacts bulk error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
