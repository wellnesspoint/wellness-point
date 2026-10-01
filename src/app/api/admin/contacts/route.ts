import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Contact from "@/models/Contact";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

// GET /api/admin/contacts — list all contact queries
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const contacts = await Contact.find().sort({ createdAt: -1 }).limit(1000).lean();
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Admin contacts list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
