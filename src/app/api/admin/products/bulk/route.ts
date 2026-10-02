import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { summarizeVariants } from "@/lib/variants";

const MAX_BULK = 200;
const ACTIONS = [
  "activate", "deactivate", "archive", "restore",
  "feature", "unfeature", "set_category", "adjust_price",
] as const;
type Action = (typeof ACTIONS)[number];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * POST /api/admin/products/bulk
 *   { ids, action, category?: string, percent?: number }
 * adjust_price scales price (and discountPrice) by percent, e.g. 10 = +10%, -5 = -5%.
 * Archiving is a soft delete (same as DELETE /products/[id]); permanent deletes stay one at a time.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await checkAdmin("products", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json().catch(() => null);
    const action = body?.action as Action;
    const ids = body?.ids;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK ||
      !ids.every((i) => typeof i === "string" && mongoose.isValidObjectId(i))
    ) {
      return NextResponse.json({ error: `Select 1-${MAX_BULK} valid products` }, { status: 400 });
    }

    await connectDB();
    let affected = 0;

    switch (action) {
      case "activate":
        affected = (
          await Product.updateMany(
            { _id: { $in: ids }, archivedAt: { $exists: false } },
            { $set: { isActive: true } }
          )
        ).modifiedCount;
        break;
      case "deactivate":
        affected = (await Product.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } })).modifiedCount;
        break;
      case "archive":
        affected = (
          await Product.updateMany({ _id: { $in: ids } }, { $set: { archivedAt: new Date(), isActive: false } })
        ).modifiedCount;
        break;
      case "restore":
        affected = (
          await Product.updateMany(
            { _id: { $in: ids }, archivedAt: { $exists: true } },
            { $unset: { archivedAt: "" } }
          )
        ).modifiedCount;
        break;
      case "feature":
      case "unfeature":
        affected = (
          await Product.updateMany({ _id: { $in: ids } }, { $set: { isFeatured: action === "feature" } })
        ).modifiedCount;
        break;
      case "set_category": {
        const category = typeof body.category === "string" ? body.category.trim().slice(0, 60) : "";
        affected = (
          await Product.updateMany(
            { _id: { $in: ids } },
            category ? { $set: { category } } : { $unset: { category: "" } }
          )
        ).modifiedCount;
        break;
      }
      case "adjust_price": {
        const percent = Number(body.percent);
        if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500) {
          return NextResponse.json({ error: "Percent must be between -90 and 500 (not 0)" }, { status: 400 });
        }
        const factor = 1 + percent / 100;
        const products = await Product.find({ _id: { $in: ids } }).select("price discountPrice variants");
        for (const p of products) {
          if (p.variants && p.variants.length > 0) {
            // Variant products: scale every variant, then re-derive the product's "from" price.
            for (const v of p.variants) {
              const vp = round2(v.price * factor);
              if (vp <= 0) continue;
              v.price = vp;
              if (v.discountPrice) {
                const vd = round2(v.discountPrice * factor);
                v.discountPrice = vd > 0 && vd < vp ? vd : undefined;
              }
            }
            const sum = summarizeVariants(p.variants);
            p.price = sum.price;
            p.discountPrice = sum.discountPrice;
            await p.save();
            affected++;
            continue;
          }
          const price = round2(p.price * factor);
          if (price <= 0) continue;
          p.price = price;
          if (p.discountPrice) {
            const d = round2(p.discountPrice * factor);
            // keep the invariant discountPrice < price
            p.discountPrice = d > 0 && d < price ? d : undefined;
          }
          await p.save();
          affected++;
        }
        break;
      }
    }

    await logAudit(session, {
      action: `product.bulk_${action}`,
      entity: "product",
      summary: `Bulk ${action}${action === "adjust_price" ? ` ${body.percent}%` : ""} on ${ids.length} product(s)`,
      meta: { ids, ...(body.category ? { category: body.category } : {}) },
    });
    return NextResponse.json({ affected });
  } catch (error) {
    console.error("Admin products bulk error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
