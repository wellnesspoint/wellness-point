import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
