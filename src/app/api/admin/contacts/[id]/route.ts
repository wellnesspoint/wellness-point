import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Contact from "@/models/Contact";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { sendContactReply } from "@/lib/email";
import mongoose from "mongoose";
import User from "@/models/User";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/contacts/[id] — update status or reply
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("contacts", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    const unsetData: Record<string, ""> = {};
    const pushData: Record<string, unknown> = {};
    const actorName = session.user.name || session.user.email;
    const audit: string[] = [];

    if (body.status) {
      if (!["new", "read", "replied", "archived"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = body.status;
    }

    if (body.priority !== undefined) {
      if (!["low", "normal", "high", "urgent"].includes(body.priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      updateData.priority = body.priority;
      audit.push(`priority ${body.priority}`);
    }

    // Assign to a teammate (or null/"" to unassign). Only active admins can be assigned.
    if (body.assignedTo !== undefined) {
      if (!body.assignedTo) {
        unsetData.assignedTo = "";
        audit.push("unassigned");
      } else {
        const assignee =
          typeof body.assignedTo === "string" && mongoose.isValidObjectId(body.assignedTo)
            ? await User.findOne({ _id: body.assignedTo, role: "admin", isActive: { $ne: false } }).select("name email")
            : null;
        if (!assignee) {
          return NextResponse.json({ error: "That person is not an active admin" }, { status: 400 });
        }
        updateData.assignedTo = { id: assignee._id, name: assignee.name, email: assignee.email };
        audit.push(`assigned to ${assignee.email}`);
      }
    }

    // Staff-only note appended to the thread
    if (body.note !== undefined) {
      const text = typeof body.note === "string" ? body.note.trim() : "";
      if (!text || text.length > 1000) {
        return NextResponse.json({ error: "A note must be 1-1000 characters" }, { status: 400 });
      }
      pushData.internalNotes = { text, by: actorName, at: new Date() };
      audit.push("added a note");
    }

    let adminReply = "";
    if (body.adminReply !== undefined) {
      adminReply = typeof body.adminReply === "string" ? body.adminReply.trim() : "";
      if (body.adminReply && !adminReply) {
        return NextResponse.json({ error: "Reply can't be empty" }, { status: 400 });
      }
      if (adminReply.length > 5000) {
        return NextResponse.json({ error: "Reply is too long (max 5000 characters)" }, { status: 400 });
      }
    }
    if (adminReply) {
      updateData.adminReply = adminReply;
      updateData.adminRepliedAt = new Date();
      updateData.status = "replied";
    }

    if (
      Object.keys(updateData).length === 0 &&
      Object.keys(unsetData).length === 0 &&
      Object.keys(pushData).length === 0
    ) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();

    const contact = await Contact.findByIdAndUpdate(
      id,
      {
        ...(Object.keys(updateData).length > 0 && { $set: updateData }),
        ...(Object.keys(unsetData).length > 0 && { $unset: unsetData }),
        ...(Object.keys(pushData).length > 0 && { $push: pushData }),
      },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Send reply email if admin replied (MUST await — Vercel kills the function after response)
    if (adminReply && contact.email) {
      try {
        await sendContactReply({
          customerName: contact.name,
          customerEmail: contact.email,
          originalSubject: contact.subject,
          originalMessage: contact.message,
          adminReply,
        });
        console.log("Contact reply email sent to:", contact.email);
      } catch (emailErr) {
        console.error("Contact reply email failed:", emailErr);
        // Don't fail the update — email is best-effort
      }
    }

    if (audit.length > 0) {
      await logAudit(session, {
        action: "contact.update",
        entity: "contact",
        entityId: id,
        summary: `Message from ${contact.name}: ${audit.join(", ")}`,
      });
    }
    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Admin contact update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/contacts/[id] — delete a query
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("contacts", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    await connectDB();
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    await logAudit(session, {
      action: "contact.delete",
      entity: "contact",
      entityId: id,
      summary: `Deleted message "${contact.subject.slice(0, 80)}" from ${contact.name}`,
    });
    return NextResponse.json({ message: "Contact deleted" });
  } catch (error) {
    console.error("Admin contact delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
