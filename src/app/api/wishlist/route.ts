import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db";
import Wishlist from "@/models/Wishlist";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const wishlist = await Wishlist.findOne({
      user: (session.user as any).id,
    }).populate({
      path: "products",
      select: "name slug price discountPrice images shortDescription rating reviewCount stock",
    }).lean();

    return NextResponse.json({
      products: wishlist?.products || [],
    });
  } catch (error) {
    console.error("Wishlist fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wishlist" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400 }
      );
    }

    await connectDB();

    let wishlist = await Wishlist.findOne({
      user: (session.user as any).id,
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: (session.user as any).id,
        products: [productId],
      });
    } else {
      const exists = wishlist.products.some(
        (p: any) => p.toString() === productId
      );

      if (exists) {
        wishlist.products = wishlist.products.filter(
          (p: any) => p.toString() !== productId
        );
      } else {
        wishlist.products.push(productId);
      }
      await wishlist.save();
    }

    return NextResponse.json({ message: "Wishlist updated" });
  } catch (error) {
    console.error("Wishlist update error:", error);
    return NextResponse.json(
      { error: "Failed to update wishlist" },
      { status: 500 }
    );
  }
}
