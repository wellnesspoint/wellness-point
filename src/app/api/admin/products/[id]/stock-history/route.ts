import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import StockMovement from "@/models/StockMovement";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

/** GET /api/admin/products/[id]/stock-history — latest 50 stock changes. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    await connectDB();
    const movements = await StockMovement.find({ product: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ movements });
  } catch (error) {
    console.error("Stock history error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
