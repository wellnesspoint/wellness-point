import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { sendCustomerMessage } from "@/lib/email";

/** POST /api/admin/users/[id]/email { subject, message } — email a customer from the support address. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }
    if (subject.length > 150 || message.length > 5000) {
      return NextResponse.json({ error: "Subject (150) or message (5000) is too long" }, { status: 400 });
    }

    const { success } = await rateLimit(`admin-email-customer:${session.user.id}`, {
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!success) {
      return NextResponse.json({ error: "Too many emails sent. Try again later." }, { status: 429 });
    }

    await connectDB();
    const user = await User.findById(id).select("name email role isActive anonymizedAt");
    if (!user || user.anonymizedAt) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    try {
      await sendCustomerMessage({ customerName: user.name, customerEmail: user.email, subject, message });
    } catch (err) {
      console.error("Customer email failed:", err);
      return NextResponse.json({ error: "Email could not be sent. Check the SMTP settings." }, { status: 502 });
    }

    await logAudit(session, {
      action: "user.email",
      entity: "user",
      entityId: id,
      summary: `Emailed ${user.email}: "${subject.slice(0, 80)}"`,
    });
    return NextResponse.json({ message: "Email sent" });
  } catch (error) {
    console.error("Email customer error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
