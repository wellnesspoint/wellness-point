import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";
import Wishlist from "@/models/Wishlist";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

// Fields an admin is allowed to write via this route — excludes computed
// fields (rating/reviewCount, derived from reviews) and identifiers.
const ALLOWED_FIELDS = [
  "name",
  "slug",
  "description",
  "shortDescription",
  "price",
  "discountPrice",
  "images",
  "ingredients",
  "benefits",
  "usage",
  "stock",
  "sku",
  "weight",
  "gst",
  "category",
  "isFeatured",
  "isActive",
  "metaTitle",
  "metaDescription",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    await connectDB();

    const existing = await Product.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) update[field] = body[field];
    }

    // A "discount" price that's >= the regular price is a markup, not a
    // discount — this was previously unenforced, so a data-entry mistake
    // (or a stray admin API call) could silently overcharge customers.
    const nextPrice = (update.price as number | undefined) ?? existing.price;
    const nextDiscountPrice =
      "discountPrice" in update
        ? (update.discountPrice as number | null | undefined)
        : existing.discountPrice;
    if (
      nextDiscountPrice !== undefined &&
      nextDiscountPrice !== null &&
      nextDiscountPrice >= nextPrice
    ) {
      return NextResponse.json(
        { error: "Discount price must be lower than the regular price" },
        { status: 400 }
      );
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true, context: "query" }
    );

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Product updated", product });
  } catch (error: any) {
    console.error("Admin update product error:", error);
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Clean up references so a deleted product doesn't leave dangling
    // wishlist entries (which crashed the wishlist page) or orphaned reviews.
    await Promise.all([
      Wishlist.updateMany({ products: id }, { $pull: { products: id } }),
      Review.deleteMany({ product: id }),
    ]);

    return NextResponse.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
