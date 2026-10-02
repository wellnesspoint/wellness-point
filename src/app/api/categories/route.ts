import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";

/** GET /api/categories — public: active categories that have at least one active product. */
export async function GET() {
  try {
    await connectDB();
    const [categories, used] = await Promise.all([
      Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).select("name slug description").lean(),
      Product.distinct("category", { isActive: true, archivedAt: { $exists: false } }),
    ]);
    const inUse = new Set(used.filter(Boolean));
    const res = NextResponse.json({ categories: categories.filter((c) => inUse.has(c.name)) });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json({ categories: [] });
  }
}
