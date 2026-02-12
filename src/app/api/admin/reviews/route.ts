import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Review from "@/models/Review";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

// GET /api/admin/reviews — list all reviews (admin)
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const reviews = await Review.find()
      .populate("product", "name slug images")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Admin reviews error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
