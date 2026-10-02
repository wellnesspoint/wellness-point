import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Blog from "@/models/Blog";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { generateSlug, sanitizeInput } from "@/lib/utils";

export async function GET() {
  try {
    const session = await checkAdmin("content", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const blogs = await Blog.find().sort({ createdAt: -1 }).limit(500).lean();
    return NextResponse.json({ blogs });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("content", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const { title, excerpt, content, coverImage, images, tags, isPublished, metaTitle, metaDescription } = body;
    let publishAt: Date | undefined;
    if (body.publishAt) {
      publishAt = new Date(body.publishAt);
      if (Number.isNaN(publishAt.getTime())) {
        return NextResponse.json({ error: "Invalid publish date" }, { status: 400 });
      }
    }

    if (!title || !excerpt || !content || !coverImage) {
      return NextResponse.json(
        { error: "Title, excerpt, content, and cover image are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const slug = generateSlug(title);
    const existingSlug = await Blog.findOne({ slug });
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const blog = await Blog.create({
      title: sanitizeInput(title),
      slug: finalSlug,
      excerpt,
      content,
      coverImage,
      images: images || [],
      tags: tags || [],
      isPublished: isPublished || false,
      publishAt,
      metaTitle,
      metaDescription,
    });

    return NextResponse.json({ message: "Blog created", blog }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
