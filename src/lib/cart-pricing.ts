import mongoose from "mongoose";
import Product from "@/models/Product";
import { effectivePrice, lineKey } from "@/lib/variants";

export interface PricedItem {
  product: string;
  /** set when the line is a specific variant of the product */
  variantId?: string;
  variantName?: string;
  /** includes the variant ("Whey – 1kg Chocolate") so invoices/emails need no changes */
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export type CartPricing =
  | { ok: true; items: PricedItem[]; subtotal: number }
  | { ok: false; error: string };

/**
 * Prices a client-supplied cart from the database: real prices, stock and
 * availability. The client never controls an amount. Shared by
 * /api/payment/create-order and /api/coupons/validate so both always agree.
 *
 * Cart lines are `{ _id, quantity, variantId? }`. A product that has variants
 * must be bought as a specific (active) variant, priced and stocked per variant.
 */
export async function priceCart(rawItems: unknown): Promise<CartPricing> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: "Cart items are required" };
  }

  // Merge duplicate lines (a direct API call could send the same product/variant
  // twice — the cart UI itself always merges these already).
  const lines = new Map<string, { productId: string; variantId?: string; quantity: number }>();
  for (const item of rawItems) {
    const productId = String(item?._id);
    const rawVariant = item?.variantId;
    const variantId = rawVariant ? String(rawVariant) : undefined;
    if (variantId && !mongoose.isValidObjectId(variantId)) {
      return { ok: false, error: "Some products are no longer available" };
    }
    const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    const key = lineKey(productId, variantId);
    const existing = lines.get(key);
    if (existing) existing.quantity += qty;
    else lines.set(key, { productId, variantId, quantity: qty });
  }
  const productIds = Array.from(new Set(Array.from(lines.values()).map((l) => l.productId)));

  let products;
  try {
    products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  } catch {
    return { ok: false, error: "Some products are no longer available" };
  }
  if (products.length !== productIds.length) {
    return { ok: false, error: "Some products are no longer available" };
  }

  const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));
  const items: PricedItem[] = [];
  let subtotal = 0;

  for (const line of lines.values()) {
    const product: any = productMap.get(line.productId);
    if (!product) return { ok: false, error: `Product not found: ${line.productId}` };

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    let price: number;
    let available: number;
    let name: string = product.name;
    let variantName: string | undefined;

    if (hasVariants) {
      if (!line.variantId) {
        return { ok: false, error: `Please choose an option for "${product.name}"` };
      }
      const variant = product.variants.find((v: any) => v._id.toString() === line.variantId);
      if (!variant || variant.isActive === false) {
        return { ok: false, error: `That option of "${product.name}" is no longer available` };
      }
      price = effectivePrice(variant);
      available = variant.stock;
      variantName = variant.name;
      name = `${product.name} – ${variant.name}`;
    } else {
      if (line.variantId) {
        return { ok: false, error: `Some products are no longer available` };
      }
      // A discount only applies when it is a real, lower, non-zero price.
      price = effectivePrice(product);
      available = product.stock;
    }

    if (available < line.quantity) {
      return {
        ok: false,
        error: `Insufficient stock for "${name}". Available: ${available}`,
      };
    }

    subtotal += price * line.quantity;
    items.push({
      product: product._id.toString(),
      ...(hasVariants && { variantId: line.variantId, variantName }),
      name,
      image: product.images?.[0] || "",
      price,
      quantity: line.quantity,
    });
  }

  return { ok: true, items, subtotal: Math.round(subtotal * 100) / 100 };
}
