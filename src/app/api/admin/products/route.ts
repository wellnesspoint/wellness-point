import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { escapeRegex, pageMeta, parsePagination } from "@/lib/pagination";
import { generateSlug, sanitizeInput, truncateText } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { checkLowStock, logStockMovements } from "@/lib/stock";

/** GET /api/admin/products?page=&limit=&q=&status=active|inactive|archived&stock=low|out (archived are hidden unless asked for) */
export async function GET(req: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) return unauthorizedResponse();

    await connectDB();

    const sp = new URL(req.url).searchParams;
    const paging = parsePagination(sp, { defaultLimit: 24 });

    const filter: Record<string, unknown> = {};
    const q = (sp.get("q") || "").trim().slice(0, 100);
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { sku: rx }, { category: rx }];
    }
    const status = sp.get("status");
    if (status === "archived") {
      filter.archivedAt = { $exists: true };
    } else {
      // Soft-deleted products stay out of the normal list.
      filter.archivedAt = { $exists: false };
      if (status === "active") filter.isActive = { $ne: false };
      else if (status === "inactive") filter.isActive = false;
    }
    const stock = sp.get("stock");
    if (stock === "out") filter.stock = { $lte: 0 };
    // "low" respects each product's own alert level (default 10)
    else if (stock === "low") {
      filter.stock = { $gt: 0 };
      filter.$expr = { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }] };
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
      Product.countDocuments(filter),
    ]);
    return NextResponse.json({ products, ...pageMeta(total, paging) });
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
      images,
      ingredients,
      benefits,
      usage,
      isFeatured,
      isActive,
      sku,
      category,
      metaTitle,
      metaDescription,
    } = body;

    if (!name || !description || !body.price) {
      return NextResponse.json(
        { error: "Name, description, and price are required" },
        { status: 400 }
      );
    }

    // The admin form has no separate short-description field, so derive one
    // from the description (the model requires it, max 200 chars).
    const shortDescription =
      typeof body.shortDescription === "string" && body.shortDescription.trim()
        ? body.shortDescription.trim().slice(0, 200)
        : truncateText(String(description).replace(/\s+/g, " ").trim(), 200);

    // Coerce and range-check numbers (same rules as the update route).
    const price = Number(body.price);
    const stock = body.stock === undefined || body.stock === "" ? 0 : Number(body.stock);
    const discountPrice =
      body.discountPrice === undefined || body.discountPrice === null || body.discountPrice === ""
        ? undefined
        : Number(body.discountPrice);
    const weight =
      body.weight === undefined || body.weight === null || body.weight === ""
        ? undefined
        : Number(body.weight);
    const gst =
      body.gst === undefined || body.gst === null || body.gst === "" ? undefined : Number(body.gst);
    const lowStockThreshold =
      body.lowStockThreshold === undefined || body.lowStockThreshold === null || body.lowStockThreshold === ""
        ? undefined
        : Number(body.lowStockThreshold);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json({ error: "Stock must be a whole number, 0 or more" }, { status: 400 });
    }
    if (discountPrice !== undefined && discountPrice !== 0) {
      if (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice >= price) {
        return NextResponse.json(
          { error: "Discount price must be lower than the regular price" },
          { status: 400 }
        );
      }
    }
    if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) {
      return NextResponse.json({ error: "Weight must be 0 or more" }, { status: 400 });
    }
    if (lowStockThreshold !== undefined && (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)) {
      return NextResponse.json({ error: "Low-stock alert level must be a whole number, 0 or more" }, { status: 400 });
    }
    if (gst !== undefined && (!Number.isFinite(gst) || gst < 0 || gst > 100)) {
      return NextResponse.json({ error: "GST must be between 0 and 100" }, { status: 400 });
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
      stock,
      lowStockThreshold,
      sku: sku || undefined,
      weight,
      gst,
      category: category || undefined,
      isFeatured: isFeatured || false,
      isActive: isActive === undefined ? true : Boolean(isActive),
      metaTitle,
      metaDescription,
    });

    await logStockMovements([
      { product: product._id, delta: stock, reason: "restock", actorName: session.user.name || session.user.email, balance: stock },
    ]);
    await checkLowStock();
    await logAudit(session, {
      action: "product.create",
      entity: "product",
      entityId: product._id.toString(),
      summary: `Created product "${product.name}" (₹${price}, stock ${stock})`,
    });

    return NextResponse.json(
      { message: "Product created", product },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Admin create product error:", error);
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
