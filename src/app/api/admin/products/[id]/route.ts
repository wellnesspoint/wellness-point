import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";

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

    const product = await Product.findByIdAndUpdate(id, body, {
      new: true,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Product updated", product });
  } catch (error) {
    console.error("Admin update product error:", error);
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

    return NextResponse.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
