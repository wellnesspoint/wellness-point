import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Review from "@/models/Review";
import Product from "@/models/Product";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import mongoose from "mongoose";

// GET /api/reviews?productId=xxx — get approved reviews for a product
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return NextResponse.json(
        { error: "A valid productId is required" },
        { status: 400 }
      );
    }

    const reviews = await Review.find({
      product: productId,
      isApproved: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Reviews fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST /api/reviews — submit a review (logged-in users)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in to submit a review" },
        { status: 401 }
      );
    }

    // Rate limit: 5 reviews per 15 minutes per IP
    const ip = getClientIp(req);
    const { success: withinLimit } = await rateLimit(`review:${ip}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many review submissions. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { productId, rating, title, content } = body;

    if (!productId || !rating || !title || !content) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const numericRating = Math.round(Number(rating));
    if (
      !mongoose.isValidObjectId(productId) ||
      typeof title !== "string" ||
      typeof content !== "string"
    ) {
      return NextResponse.json({ error: "Invalid review data" }, { status: 400 });
    }
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // One review per customer per product.
    const alreadyReviewed = await Review.exists({
      product: productId,
      user: (session.user as any).id,
    });
    if (alreadyReviewed) {
      return NextResponse.json(
        { error: "You have already reviewed this product" },
        { status: 409 }
      );
    }

    const review = await Review.create({
      product: productId,
      user: (session.user as any).id,
      name: session.user.name || "Anonymous",
      email: session.user.email || "",
      rating: numericRating,
      title: title.trim().slice(0, 120),
      content: content.trim().slice(0, 1000),
      isApproved: false, // requires admin approval
    });

    return NextResponse.json(
      { message: "Review submitted! It will appear after admin approval.", review },
      { status: 201 }
    );
  } catch (error) {
    console.error("Review submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
