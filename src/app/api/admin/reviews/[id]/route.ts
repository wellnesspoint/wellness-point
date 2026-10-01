import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Review from "@/models/Review";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

interface Props {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/reviews/[id] — approve/update review
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();

    // Whitelist moderation fields only — passing the raw body straight to the
    // update let a request rewrite product/user/rating/etc. (mass assignment).
    const update: Record<string, unknown> = {};
    if (typeof body.isApproved === "boolean") update.isApproved = body.isApproved;
    if (typeof body.adminReply === "string") {
      update.adminReply = body.adminReply.slice(0, 1000);
      // Auto-set adminRepliedAt when a reply is provided
      if (body.adminReply.trim()) update.adminRepliedAt = new Date();
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();
    const review = await Review.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Recalculate product rating
    await recalculateProductRating(review.product.toString());

    return NextResponse.json({ review });
  } catch (error) {
    console.error("Admin review update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/admin/reviews/[id] — delete review
export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    await connectDB();
    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Recalculate product rating
    await recalculateProductRating(review.product.toString());

    return NextResponse.json({ message: "Review deleted" });
  } catch (error) {
    console.error("Admin review delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function recalculateProductRating(productId: string) {
  const approvedReviews = await Review.find({
    product: productId,
    isApproved: true,
  });

  const count = approvedReviews.length;
  const avg =
    count > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / count
      : 0;

  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}
