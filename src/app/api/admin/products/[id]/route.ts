import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import Review from "@/models/Review";
import Wishlist from "@/models/Wishlist";
import { checkAdmin, unauthorizedResponse } from "@/lib/admin";
import { truncateText, normalizeTags } from "@/lib/utils";
import mongoose from "mongoose";
import { parseVariants, summarizeVariants } from "@/lib/variants";
import { diffFields, logAudit } from "@/lib/audit";
import { checkLowStock, logStockMovements } from "@/lib/stock";

// Fields an admin is allowed to write via this route — excludes computed
// fields (rating/reviewCount, derived from reviews) and identifiers.
const ALLOWED_FIELDS = [
  "name",
  "slug",
  "description",
  "shortDescription",
  "price",
  "discountPrice",
  "images",
  "ingredients",
  "benefits",
  "usage",
  "stock",
  "lowStockThreshold",
  "sku",
  "weight",
  "gst",
  "category",
  "tags",
  "isFeatured",
  "isActive",
  "metaTitle",
  "metaDescription",
] as const;

// What shows up (before → after) in the audit log.
const AUDITED_FIELDS = [
  "name", "price", "discountPrice", "stock", "lowStockThreshold",
  "isActive", "isFeatured", "gst", "category", "sku",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await checkAdmin("products", "manage");
    if (!session) return unauthorizedResponse();

    const body = await req.json();
    await connectDB();

    const existing = await Product.findById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Restore an archived product. It comes back inactive so nothing goes
    // live by accident; the admin re-activates it when ready.
    if (body.restore === true) {
      if (!existing.archivedAt) {
        return NextResponse.json({ error: "Product is not archived" }, { status: 400 });
      }
      const restored = await Product.findByIdAndUpdate(
        id,
        { $set: { isActive: false }, $unset: { archivedAt: "" } },
        { new: true }
      );
      await logAudit(session, {
        action: "product.restore",
        entity: "product",
        entityId: id,
        summary: `Restored product "${existing.name}" from the archive (inactive)`,
      });
      return NextResponse.json({ message: "Product restored", product: restored });
    }

    if (existing.archivedAt) {
      return NextResponse.json(
        { error: "This product is archived. Restore it before editing." },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) update[field] = body[field];
    }

    if (update.tags !== undefined) update.tags = normalizeTags(update.tags);

    // Variants: validated, ids of existing variants kept (so carts/orders stay valid),
    // and the product's own stock/price mirror them (see lib/variants.ts).
    const variantMovements: { variantId: unknown; variantName: string; delta: number; balance: number }[] = [];
    if (body.variants !== undefined) {
      const parsed = parseVariants(body.variants);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const oldById = new Map((existing.variants ?? []).map((v) => [String(v._id), v]));
      if (parsed.variants.length === 0) {
        update.variants = [];
      } else {
        const docs = parsed.variants.map((v) => {
          const keep = v._id && oldById.has(v._id) ? v._id : undefined;
          const doc = {
            _id: keep ? new mongoose.Types.ObjectId(keep) : new mongoose.Types.ObjectId(),
            name: v.name,
            sku: v.sku,
            price: v.price,
            discountPrice: v.discountPrice,
            stock: v.stock,
            isActive: v.isActive,
          };
          const delta = v.stock - (keep ? oldById.get(keep)!.stock : 0);
          if (delta !== 0) variantMovements.push({ variantId: doc._id, variantName: v.name, delta, balance: v.stock });
          return doc;
        });
        const summary = summarizeVariants(docs);
        update.variants = docs;
        update.stock = summary.stock;
        update.price = summary.price;
        update.discountPrice = summary.discountPrice ?? null;
      }
    }

    if (update.stock !== undefined) {
      const stock = Number(update.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return NextResponse.json({ error: "Stock must be a whole number, 0 or more" }, { status: 400 });
      }
      update.stock = stock;
    }
    if (update.lowStockThreshold !== undefined) {
      const t = Number(update.lowStockThreshold);
      if (!Number.isInteger(t) || t < 0) {
        return NextResponse.json({ error: "Low-stock alert level must be a whole number, 0 or more" }, { status: 400 });
      }
      update.lowStockThreshold = t;
    }

    // The admin form has no short-description field; keep the derived one in
    // step with the description so shop cards don't show stale text.
    if (typeof update.description === "string" && body.shortDescription === undefined) {
      update.shortDescription = truncateText(update.description.replace(/\s+/g, " ").trim(), 200);
    }

    // A "discount" price that's >= the regular price is a markup, not a
    // discount — this was previously unenforced, so a data-entry mistake
    // (or a stray admin API call) could silently overcharge customers.
    const nextPrice = (update.price as number | undefined) ?? existing.price;
    const nextDiscountPrice =
      "discountPrice" in update
        ? (update.discountPrice as number | null | undefined)
        : existing.discountPrice;
    if (
      nextDiscountPrice !== undefined &&
      nextDiscountPrice !== null &&
      nextDiscountPrice >= nextPrice
    ) {
      return NextResponse.json(
        { error: "Discount price must be lower than the regular price" },
        { status: 400 }
      );
    }

    const before = existing.toObject() as unknown as Record<string, unknown>;

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true, context: "query" }
    );

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Stock history + audit trail
    const actorName = session.user.name || session.user.email;
    const changes = diffFields(before, product.toObject() as unknown as Record<string, unknown>, AUDITED_FIELDS);

    if (variantMovements.length > 0) {
      await logStockMovements(
        variantMovements.map((m) => ({
          product: product._id,
          variantId: m.variantId,
          variantName: m.variantName,
          delta: m.delta,
          reason: "admin_edit" as const,
          actorName,
          balance: m.balance,
        }))
      );
    } else if (changes.stock) {
      await logStockMovements([
        {
          product: product._id,
          delta: product.stock - existing.stock,
          reason: "admin_edit",
          actorName,
          balance: product.stock,
        },
      ]);
    }
    if (changes.stock || changes.lowStockThreshold) await checkLowStock();

    const changed = Object.entries(changes)
      .map(([k, [from, to]]) => `${k} ${JSON.stringify(from ?? null)} → ${JSON.stringify(to ?? null)}`)
      .join(", ");
    if (changed || Object.keys(update).length > 0) {
      await logAudit(session, {
        action: "product.update",
        entity: "product",
        entityId: id,
        summary: `Updated "${product.name}"${changed ? `: ${changed}` : ""}`,
        meta: { changes },
      });
    }

    return NextResponse.json({ message: "Product updated", product });
  } catch (error: any) {
    console.error("Admin update product error:", error);
    if (error?.name === "ValidationError") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * DELETE archives (soft delete): the product disappears from the store and the
 * default admin list but keeps its reviews, and can be restored. Only an
 * already-archived product can be removed for good with ?permanent=1.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await checkAdmin("products", "manage");
    if (!session) return unauthorizedResponse();

    await connectDB();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const permanent = new URL(req.url).searchParams.get("permanent") === "1";

    if (!permanent) {
      if (product.archivedAt) {
        return NextResponse.json({ error: "Product is already archived" }, { status: 400 });
      }
      await Product.findByIdAndUpdate(id, { $set: { isActive: false, archivedAt: new Date() } });
      // Hidden products shouldn't linger in customers' wishlists.
      await Wishlist.updateMany({ products: id }, { $pull: { products: id } });
      await logAudit(session, {
        action: "product.archive",
        entity: "product",
        entityId: id,
        summary: `Archived product "${product.name}"`,
      });
      return NextResponse.json({ message: "Product archived", archived: true });
    }

    if (!product.archivedAt) {
      return NextResponse.json(
        { error: "Archive the product first, then delete it permanently." },
        { status: 400 }
      );
    }

    await Product.findByIdAndDelete(id);

    // Clean up references so a deleted product doesn't leave dangling
    // wishlist entries (which crashed the wishlist page) or orphaned reviews.
    await Promise.all([
      Wishlist.updateMany({ products: id }, { $pull: { products: id } }),
      Review.deleteMany({ product: id }),
    ]);

    await logAudit(session, {
      action: "product.delete",
      entity: "product",
      entityId: id,
      summary: `Permanently deleted product "${product.name}"`,
    });

    return NextResponse.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
