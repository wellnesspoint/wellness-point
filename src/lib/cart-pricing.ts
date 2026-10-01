import Product from "@/models/Product";

export interface PricedItem {
  product: string;
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
 */
export async function priceCart(rawItems: unknown): Promise<CartPricing> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: "Cart items are required" };
  }

  // Merge duplicate product ids (a direct API call could send the same
  // product twice — the cart UI itself always merges these already).
  const qtyByProduct = new Map<string, number>();
  for (const item of rawItems) {
    const id = String(item?._id);
    const qty = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    qtyByProduct.set(id, (qtyByProduct.get(id) || 0) + qty);
  }
  const productIds = Array.from(qtyByProduct.keys());

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

  for (const id of productIds) {
    const product: any = productMap.get(id);
    if (!product) return { ok: false, error: `Product not found: ${id}` };

    const quantity = qtyByProduct.get(id)!;
    if (product.stock < quantity) {
      return {
        ok: false,
        error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
      };
    }

    // A discount only applies when it is a real, lower, non-zero price.
    const price =
      product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;
    subtotal += price * quantity;

    items.push({
      product: product._id.toString(),
      name: product.name,
      image: product.images?.[0] || "",
      price,
      quantity,
    });
  }

  return { ok: true, items, subtotal: Math.round(subtotal * 100) / 100 };
}
