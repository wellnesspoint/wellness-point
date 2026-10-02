import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Category from "@/models/Category";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { generateSlug, sanitizeInput } from "@/lib/utils";
import { logAudit } from "@/lib/audit";

/**
 * GET /api/admin/categories — categories with how many (non-archived) products use each.
 * Product.category values with no Category row (older free-text values) are listed too,
 * flagged `unmanaged`, so nothing disappears and they can be adopted with one click.
 */
export async function GET() {
  try {
    const session = await checkAdmin("products", "view");
    if (!session) return unauthorizedResponse();

    await connectDB();
    const [categories, counts] = await Promise.all([
      Category.find().sort({ sortOrder: 1, name: 1 }).lean(),
      Product.aggregate([
        { $match: { archivedAt: { $exists: false }, category: { $exists: true, $ne: "" } } },
        { $group: { _id: "$category", n: { $sum: 1 } } },
      ]),
    ]);
    const countByName = new Map<string, number>(counts.map((c) => [c._id as string, c.n as number]));
    const known = new Set(categories.map((c) => c.name));

    return NextResponse.json({
      categories: categories.map((c) => ({ ...c, productCount: countByName.get(c.name) ?? 0 })),
      unmanaged: counts
        .filter((c) => !known.has(c._id as string))
        .map((c) => ({ name: c._id as string, productCount: c.n as number })),
    });
  } catch (error) {
    console.error("Admin categories list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("products", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const name = sanitizeInput(String(body?.name ?? "")).trim().slice(0, 60);
    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }
    const sortOrder = Number(body?.sortOrder ?? 0);
    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: "Sort order must be a number" }, { status: 400 });
    }

    await connectDB();
    const exists = await Category.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (exists) {
      return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
    }
    let slug = generateSlug(name) || "category";
    if (await Category.findOne({ slug })) slug = `${slug}-${Date.now().toString(36)}`;

    const category = await Category.create({
      name,
      slug,
      description: body?.description ? sanitizeInput(String(body.description)).slice(0, 300) : undefined,
      sortOrder,
      isActive: body?.isActive === undefined ? true : Boolean(body.isActive),
    });
    await logAudit(session, {
      action: "category.create",
      entity: "category",
      entityId: String(category._id),
      summary: `Created category "${name}"`,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Admin category create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
