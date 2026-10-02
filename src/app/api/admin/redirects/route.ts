import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Redirect from "@/models/Redirect";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parseRedirect } from "@/lib/redirects";
import { clearSiteStatusCache } from "@/lib/site-status";
import { logAudit } from "@/lib/audit";

const MAX_REDIRECTS = 1000;

export async function GET() {
  try {
    const session = await checkAdmin("content", "view");
    if (!session) return unauthorizedResponse();
    await connectDB();
    const redirects = await Redirect.find().sort({ createdAt: -1 }).limit(MAX_REDIRECTS).lean();
    return NextResponse.json({ redirects });
  } catch (error) {
    console.error("Admin redirects list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const parsed = parseRedirect(await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await connectDB();
    if ((await Redirect.countDocuments()) >= MAX_REDIRECTS) {
      return NextResponse.json({ error: `You can have at most ${MAX_REDIRECTS} redirects` }, { status: 400 });
    }
    if (await Redirect.findOne({ from: parsed.from })) {
      return NextResponse.json({ error: `${parsed.from} already redirects somewhere` }, { status: 409 });
    }
    // Reject a one-step loop: the target is itself redirected back to the source.
    const back = await Redirect.findOne({ from: parsed.to.toLowerCase(), to: parsed.from, isActive: true });
    if (back) {
      return NextResponse.json({ error: "That would create a redirect loop" }, { status: 400 });
    }

    const redirect = await Redirect.create({ from: parsed.from, to: parsed.to, permanent: parsed.permanent });
    clearSiteStatusCache();
    await logAudit(session, {
      action: "redirect.create",
      entity: "redirect",
      entityId: String(redirect._id),
      summary: `Redirect ${parsed.from} → ${parsed.to} (${parsed.permanent ? "301" : "302"})`,
    });
    return NextResponse.json({ redirect }, { status: 201 });
  } catch (error) {
    console.error("Admin redirect create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
