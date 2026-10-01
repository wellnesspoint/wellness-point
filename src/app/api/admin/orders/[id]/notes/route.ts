import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Order from "@/models/Order";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

/** POST /api/admin/orders/[id]/notes { text } — append an internal note (admin-only, never shown to the customer). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const { text } = await req.json().catch(() => ({}));
    const note = typeof text === "string" ? text.trim() : "";
    if (!note) return NextResponse.json({ error: "Note can't be empty" }, { status: 400 });
    if (note.length > 1000) {
      return NextResponse.json({ error: "Note is too long (max 1000 characters)" }, { status: 400 });
    }

    await connectDB();
    const entry = { text: note, by: session.user.name || session.user.email, at: new Date() };
    const order = await Order.findByIdAndUpdate(
      id,
      { $push: { internalNotes: entry } },
      { new: true }
    ).select("internalNotes");
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    await logAudit(session, {
      action: "order.note",
      entity: "order",
      entityId: id,
      summary: `Order #${id.slice(-8).toUpperCase()}: added a note`,
    });
    return NextResponse.json({ internalNotes: order.internalNotes });
  } catch (error) {
    console.error("Order note error:", error);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
