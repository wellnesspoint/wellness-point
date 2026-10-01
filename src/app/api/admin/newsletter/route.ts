import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import NewsletterSubscriber from "@/models/NewsletterSubscriber";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const subscribers = await NewsletterSubscriber.find()
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    return NextResponse.json({ subscribers });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await req.json().catch(() => ({}));
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "A valid subscriber ID is required" }, { status: 400 });
    }

    await connectDB();
    const deleted = await NewsletterSubscriber.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Subscriber deleted" });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
