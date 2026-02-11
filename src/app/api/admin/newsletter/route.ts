import { NextResponse } from "next/server";
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
      .lean();

    return NextResponse.json({ subscribers });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
