import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Contact from "@/models/Contact";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { sendContactReply } from "@/lib/email";

interface Props {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/contacts/[id] — update status or reply
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    const updateData: any = {};

    if (body.status) {
      if (!["new", "read", "replied", "archived"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = body.status;
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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();

    const contact = await Contact.findByIdAndUpdate(
      id,
      { $set: updateData },
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

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Admin contact update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/contacts/[id] — delete a query
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin();
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

    return NextResponse.json({ message: "Contact deleted" });
  } catch (error) {
    console.error("Admin contact delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
