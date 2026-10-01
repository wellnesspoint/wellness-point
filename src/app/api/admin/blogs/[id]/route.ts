import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Blog from "@/models/Blog";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { sanitizeInput } from "@/lib/utils";

// Fields an admin may write; slug/author/timestamps are not editable here.
const ALLOWED_FIELDS = [
  "title", "excerpt", "content", "coverImage", "images", "tags",
  "isPublished", "publishAt", "metaTitle", "metaDescription",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) update[field] = body[field];
    }
    if (typeof update.title === "string") update.title = sanitizeInput(update.title);
    if (update.publishAt !== undefined) {
      if (update.publishAt === null || update.publishAt === "") {
        update.publishAt = null;
      } else {
        const d = new Date(update.publishAt as string);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "Invalid publish date" }, { status: 400 });
        }
        update.publishAt = d;
      }
    }
    if (update.isPublished !== undefined && typeof update.isPublished !== "boolean") {
      return NextResponse.json({ error: "isPublished must be true or false" }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();

    const blog = await Blog.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true, context: "query" }
    );

    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Blog updated", blog });
  } catch (error: any) {
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return NextResponse.json({ error: "Blog not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Blog deleted" });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
