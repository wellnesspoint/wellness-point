import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { checkLowStock, logStockMovements } from "@/lib/stock";

const MAX_ROWS = 200;

/**
 * POST /api/admin/products/stock-adjust
 *   { adjustments: [{ id, variantId?, delta }] }  relative change (+restock / -damaged), or
 *   { adjustments: [{ id, variantId?, set }] }    absolute count (stocktake)
 * Products with variants must be adjusted per variant (variantId).
 * Atomic per product (a relative decrease never takes stock below 0) and logged
 * as StockMovement rows.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("inventory", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const rows = body?.adjustments;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Provide 1-${MAX_ROWS} adjustments` }, { status: 400 });
    }

    await connectDB();
    const actorName = session.user.name || session.user.email;
    const results: { id: string; ok: boolean; balance?: number; error?: string }[] = [];
    const movements = [];

    for (const r of rows) {
      const id = String(r?.id ?? "");
      if (!mongoose.isValidObjectId(id)) {
        results.push({ id, ok: false, error: "Invalid product id" });
        continue;
      }
      const hasSet = r.set !== undefined && r.set !== null && r.set !== "";
      const n = Number(hasSet ? r.set : r.delta);
      if (!Number.isInteger(n) || (hasSet && n < 0) || (!hasSet && n === 0)) {
        results.push({
          id,
          ok: false,
          error: hasSet ? "Count must be a whole number, 0 or more" : "Change must be a non-zero whole number",
        });
        continue;
      }

      const variantId = r.variantId ? String(r.variantId) : undefined;
      if (variantId && !mongoose.isValidObjectId(variantId)) {
        results.push({ id, ok: false, error: "Invalid variant id" });
        continue;
      }
      const current = await Product.findById(id).select("stock variants").lean();
      if (!current) {
        results.push({ id, ok: false, error: "Not found" });
        continue;
      }
      const hasVariants = (current.variants?.length ?? 0) > 0;
      if (hasVariants && !variantId) {
        results.push({ id, ok: false, error: "This product has variants: adjust each variant's stock" });
        continue;
      }
      const variant = variantId ? current.variants?.find((v) => String(v._id) === variantId) : undefined;
      if (variantId && !variant) {
        results.push({ id, ok: false, error: "Variant not found" });
        continue;
      }

      // For a variant, the product's own stock (the sum of its variants) moves in the same update.
      const target = variant ? { _id: id, "variants._id": variantId } : { _id: id };
      const field = variant ? "variants.$.stock" : "stock";
      const productTotal = (d: number) => (variant ? { stock: d } : {});

      let delta = n;
      let updated;
      if (hasSet) {
        delta = n - (variant ? variant.stock : current.stock);
        // (no empty $inc for plain products: Mongo rejects empty operators)
        const setUpdate: Record<string, unknown> = { $set: { [field]: n } };
        if (variant) setUpdate.$inc = productTotal(delta);
        updated = await Product.findOneAndUpdate(target, setUpdate, { new: true }).select("stock variants");
      } else {
        // Never let a negative adjustment take stock below zero.
        updated = await Product.findOneAndUpdate(
          variant
            ? { _id: id, variants: { $elemMatch: { _id: variantId, ...(n < 0 ? { stock: { $gte: -n } } : {}) } } }
            : { _id: id, ...(n < 0 ? { stock: { $gte: -n } } : {}) },
          { $inc: { [field]: n, ...productTotal(n) } },
          { new: true }
        ).select("stock variants");
        if (!updated) {
          results.push({ id, ok: false, error: "Not enough stock" });
          continue;
        }
      }
      if (!updated) {
        results.push({ id, ok: false, error: "Not found" });
        continue;
      }
      const balance = variant
        ? updated.variants?.find((v) => String(v._id) === variantId)?.stock ?? 0
        : updated.stock;
      movements.push({
        product: id,
        ...(variant && { variantId, variantName: variant.name }),
        delta,
        reason: delta > 0 ? ("restock" as const) : ("admin_edit" as const),
        actorName,
        balance,
      });
      results.push({ id, ok: true, balance });
    }

    await logStockMovements(movements);
    await checkLowStock();
    await logAudit(session, {
      action: "product.stock_adjust",
      entity: "product",
      summary: `Adjusted stock on ${movements.length} product(s)`,
      meta: { count: movements.length },
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Admin stock adjust error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
