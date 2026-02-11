import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Blog from "@/models/Blog";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const blogs = await Blog.find({ isPublished: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-content")
      .lean();

    return NextResponse.json({ blogs });
  } catch (error) {
    console.error("Blogs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch blogs" },
      { status: 500 }
    );
  }
}
