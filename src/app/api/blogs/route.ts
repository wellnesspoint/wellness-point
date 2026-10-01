import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Blog from "@/models/Blog";
import { publicBlogFilter } from "@/lib/blog-visibility";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const blogs = await Blog.find(publicBlogFilter())
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-content")
      .lean();

    const res = NextResponse.json({ blogs });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (error) {
    console.error("Blogs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch blogs" },
      { status: 500 }
    );
  }
}
