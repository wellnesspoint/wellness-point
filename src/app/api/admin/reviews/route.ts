import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Review from "@/models/Review";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { parsePagination, escapeRegex, pageMeta } from "@/lib/pagination";

const EXPORT_CAP = 5000;

// GET /api/admin/reviews?page=&limit=&status=all|pending|approved&rating=&q=&all=1
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin("reviews", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "all";
    const rating = parseInt(sp.get("rating") || "", 10);
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const exportAll = sp.get("all") === "1";

    const filter: Record<string, unknown> = {};
    if (status === "pending") filter.isApproved = false;
    if (status === "approved") filter.isApproved = true;
    if (rating >= 1 && rating <= 5) filter.rating = rating;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const productIds = await Product.find({ name: rx }).select("_id").limit(200).lean();
      filter.$or = [
        { name: rx },
        { email: rx },
        { title: rx },
        { content: rx },
        { product: { $in: productIds.map((p) => p._id) } },
      ];
    }

    const page = parsePagination(sp, { defaultLimit: 20, maxLimit: 100 });
    const query = Review.find(filter)
      .populate("product", "name slug images")
      .sort({ createdAt: -1 });
    if (exportAll) query.limit(EXPORT_CAP);
    else query.skip(page.skip).limit(page.limit);

    const [reviews, total, pending, approved] = await Promise.all([
      query.lean(),
      Review.countDocuments(filter),
      Review.countDocuments({ isApproved: false }),
      Review.countDocuments({ isApproved: true }),
    ]);

    return NextResponse.json({
      reviews,
      counts: { all: pending + approved, pending, approved },
      ...pageMeta(total, page),
    });
  } catch (error) {
    console.error("Admin reviews error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
