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

    await connectDB();

    const updateData: any = {};

    if (body.status) {
      updateData.status = body.status;
    }

    if (body.adminReply) {
      updateData.adminReply = body.adminReply;
      updateData.adminRepliedAt = new Date();
      updateData.status = "replied";
    }

    const contact = await Contact.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Send reply email if admin replied (MUST await — Vercel kills the function after response)
    if (body.adminReply && contact.email) {
      try {
        await sendContactReply({
          customerName: contact.name,
          customerEmail: contact.email,
          originalSubject: contact.subject,
          originalMessage: contact.message,
          adminReply: body.adminReply,
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
