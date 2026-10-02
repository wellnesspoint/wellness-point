import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const featured = searchParams.get("featured");
    // Clamp: NaN / negative / huge values would otherwise reach .limit()
    const parsedLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 50);

    const filter: any = { isActive: true };
    if (featured === "true") filter.isFeatured = true;

    const products = await Product.find(filter)
      .select("name slug price discountPrice images shortDescription rating reviewCount stock isFeatured variants")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const res = NextResponse.json({ products });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
