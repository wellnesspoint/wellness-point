import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { generateSlug, sanitizeInput } from "@/lib/utils";

export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Admin products error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    const {
      name,
      description,
      shortDescription,
      price,
      discountPrice,
      images,
      ingredients,
      benefits,
      usage,
      stock,
      isFeatured,
      metaTitle,
      metaDescription,
    } = body;

    if (!name || !description || !shortDescription || !price) {
      return NextResponse.json(
        { error: "Name, description, short description, and price are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const slug = generateSlug(name);
    const existingSlug = await Product.findOne({ slug });
    const finalSlug = existingSlug
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    const product = await Product.create({
      name: sanitizeInput(name),
      slug: finalSlug,
      description,
      shortDescription,
      price,
      discountPrice: discountPrice || undefined,
      images: images || [],
      ingredients: ingredients || [],
      benefits: benefits || [],
      usage: usage || "",
      stock: stock || 0,
      isFeatured: isFeatured || false,
      metaTitle,
      metaDescription,
    });

    return NextResponse.json(
      { message: "Product created", product },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin create product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
