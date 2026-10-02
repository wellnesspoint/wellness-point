import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { checkLowStock, logStockMovements } from "@/lib/stock";
import { generateSlug, sanitizeInput, truncateText } from "@/lib/utils";

const MAX_ROWS = 500;

interface RowResult {
  row: number;
  ok: boolean;
  action?: "created" | "updated";
  error?: string;
}

const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : Number(v));
const list = (v: string | undefined) =>
  (v || "").split(/[|;]/).map((s) => s.trim()).filter(Boolean);

/**
 * POST /api/admin/products/import  { rows: Record<string,string>[], dryRun?: boolean }
 * Columns (case-insensitive): name, description, price, discountprice, stock, sku,
 * category, weight, gst, image (https URL), ingredients, benefits (use | between items).
 * Rows whose SKU already exists update that product; everything else is created.
 * New products without an image are created inactive so they never show on the storefront bare.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("inventory", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const rows: Record<string, string>[] = body?.rows;
    const dryRun = body?.dryRun === true;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Provide 1-${MAX_ROWS} rows` }, { status: 400 });
    }

    await connectDB();
    const actorName = session.user.name || session.user.email;
    const results: RowResult[] = [];
    const movements = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const rowNo = i + 2; // header is row 1
      const fail = (error: string) => results.push({ row: rowNo, ok: false, error });

      const sku = (r.sku || "").trim() || undefined;
      const existing = sku ? await Product.findOne({ sku }) : null;

      const price = num(r.price);
      const discountPrice = num(r.discountprice);
      const stock = num(r.stock);
      const weight = num(r.weight);
      const gst = num(r.gst);
      const image = (r.image || "").trim();

      if (image && !/^https:\/\//i.test(image)) { fail("Image must be an https URL"); continue; }
      if (price !== undefined && (!Number.isFinite(price) || price <= 0)) { fail("Price must be a positive number"); continue; }
      if (discountPrice !== undefined && (!Number.isFinite(discountPrice) || discountPrice < 0 || (price !== undefined && discountPrice >= price))) {
        fail("Discount price must be lower than price"); continue;
      }
      if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) { fail("Stock must be a whole number, 0 or more"); continue; }
      if (weight !== undefined && (!Number.isFinite(weight) || weight < 0)) { fail("Weight must be 0 or more"); continue; }
      if (gst !== undefined && (!Number.isFinite(gst) || gst < 0 || gst > 100)) { fail("GST must be 0-100"); continue; }

      if (existing) {
        if ((existing.variants?.length ?? 0) > 0 && (price !== undefined || stock !== undefined || r.discountprice)) {
          fail("This product has variants: edit price and stock per variant in the product editor");
          continue;
        }
        if (!dryRun) {
          if (r.name) existing.name = sanitizeInput(r.name);
          if (r.description) {
            existing.description = r.description;
            existing.shortDescription = truncateText(r.description.replace(/\s+/g, " ").trim(), 200);
          }
          if (price !== undefined) existing.price = price;
          if (r.discountprice !== undefined && r.discountprice !== "") existing.discountPrice = discountPrice || undefined;
          if (r.category) existing.category = r.category.slice(0, 60);
          if (weight !== undefined) existing.weight = weight;
          if (gst !== undefined) existing.gst = gst;
          if (existing.discountPrice && existing.discountPrice >= existing.price) existing.discountPrice = undefined;
          let delta = 0;
          if (stock !== undefined && stock !== existing.stock) {
            delta = stock - existing.stock;
            existing.stock = stock;
          }
          await existing.save();
          if (delta !== 0) {
            movements.push({ product: existing._id, delta, reason: delta > 0 ? ("restock" as const) : ("admin_edit" as const), actorName, balance: existing.stock });
          }
        }
        results.push({ row: rowNo, ok: true, action: "updated" });
        continue;
      }

      if (!r.name || !r.description || price === undefined) {
        fail("name, description and price are required for new products");
        continue;
      }
      if (!dryRun) {
        const baseSlug = generateSlug(r.name);
        const taken = await Product.findOne({ slug: baseSlug }).select("_id").lean();
        const product = await Product.create({
          name: sanitizeInput(r.name),
          slug: taken ? `${baseSlug}-${Date.now().toString(36)}${i}` : baseSlug,
          description: r.description,
          shortDescription: truncateText(r.description.replace(/\s+/g, " ").trim(), 200),
          price,
          discountPrice: discountPrice || undefined,
          images: image ? [image] : [],
          ingredients: list(r.ingredients),
          benefits: list(r.benefits),
          stock: stock ?? 0,
          sku,
          weight,
          gst,
          category: r.category ? r.category.slice(0, 60) : undefined,
          isActive: Boolean(image),
        });
        if ((stock ?? 0) > 0) {
          movements.push({ product: product._id, delta: stock as number, reason: "restock" as const, actorName, balance: stock });
        }
      }
      results.push({ row: rowNo, ok: true, action: "created" });
    }

    if (!dryRun) {
      await logStockMovements(movements);
      await checkLowStock();
      const ok = results.filter((x) => x.ok);
      await logAudit(session, {
        action: "product.import",
        entity: "product",
        summary: `CSV import: ${ok.filter((x) => x.action === "created").length} created, ${ok.filter((x) => x.action === "updated").length} updated, ${results.length - ok.length} failed`,
      });
    }
    return NextResponse.json({ dryRun, results });
  } catch (error) {
    console.error("Admin products import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
