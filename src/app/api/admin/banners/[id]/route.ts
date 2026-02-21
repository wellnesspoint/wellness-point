import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Banner from "@/models/Banner";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

interface Props {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/banners/[id] — update banner
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const banner = await Banner.findByIdAndUpdate(id, body, { new: true });

    if (!banner) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    return NextResponse.json({ banner });
  } catch (error) {
    console.error("Banner update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/banners/[id] — delete banner
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    await connectDB();
    const banner = await Banner.findByIdAndDelete(id);

    if (!banner) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Banner deleted" });
  } catch (error) {
    console.error("Banner delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
