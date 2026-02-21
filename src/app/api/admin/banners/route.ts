import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Banner from "@/models/Banner";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

// GET /api/admin/banners — list all banners
export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const banners = await Banner.find().sort({ position: 1, sortOrder: 1 }).lean();
    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Banner list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/admin/banners — create a banner
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    await connectDB();

    const banner = await Banner.create(body);
    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    console.error("Banner create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
