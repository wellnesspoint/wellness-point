import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { sanitizeInput } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

/** PUT — rename (products using the old name follow), describe, reorder or hide a category. */
export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("products", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    await connectDB();
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const oldName = category.name;
    if (body.name !== undefined) {
      const name = sanitizeInput(String(body.name)).trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });
      const clash = await Category.findOne({ _id: { $ne: id }, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
      if (clash) return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
      category.name = name;
    }
    if (body.description !== undefined) {
      category.description = sanitizeInput(String(body.description)).slice(0, 300) || undefined;
    }
    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "Sort order must be a number" }, { status: 400 });
      category.sortOrder = n;
    }
    if (body.isActive !== undefined) category.isActive = Boolean(body.isActive);
    await category.save();

    if (category.name !== oldName) {
      await Product.updateMany({ category: oldName }, { $set: { category: category.name } });
    }
    await logAudit(session, {
      action: "category.update",
      entity: "category",
      entityId: id,
      summary: category.name !== oldName ? `Renamed category "${oldName}" → "${category.name}"` : `Updated category "${category.name}"`,
    });
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Admin category update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE — removes the category; products that used it become uncategorised. */
export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const session = await checkAdmin("products", "manage");
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    await connectDB();
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    const { modifiedCount } = await Product.updateMany({ category: category.name }, { $unset: { category: "" } });
    await logAudit(session, {
      action: "category.delete",
      entity: "category",
      entityId: id,
      summary: `Deleted category "${category.name}" (${modifiedCount} product(s) uncategorised)`,
    });
    return NextResponse.json({ message: "Category deleted", productsUpdated: modifiedCount });
  } catch (error) {
    console.error("Admin category delete error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
