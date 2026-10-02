import mongoose from "mongoose";
import Review from "@/models/Review";
import Product from "@/models/Product";

/** Recompute a product's rating/reviewCount from its approved reviews. */
export async function recalculateProductRating(productId: string) {
  const [stats] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
    { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: "$rating" } } },
  ]);
  const count: number = stats?.count ?? 0;
  const avg: number = stats?.avg ?? 0;

  await Product.findByIdAndUpdate(productId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}
