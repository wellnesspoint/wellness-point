import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      );
    }

    if (files.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 images allowed" },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    await mkdir(uploadDir, { recursive: true });

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `${file.name} is not an image file` },
          { status: 400 }
        );
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: `${file.name} exceeds 5MB limit` },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate unique filename
      const ext = path.extname(file.name) || ".jpg";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      await writeFile(filePath, buffer);
      uploadedUrls.push(`/uploads/products/${uniqueName}`);
    }

    return NextResponse.json({
      message: "Files uploaded successfully",
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}
