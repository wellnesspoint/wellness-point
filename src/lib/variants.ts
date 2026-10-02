/**
 * Product variants: validation and the summary values mirrored onto the product.
 * Pure functions so the pricing/checkout code and the admin routes share one rule set.
 */
export interface VariantInput {
  _id?: string;
  name: string;
  sku?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  isActive: boolean;
}

export const MAX_VARIANTS = 30;

/** A discount only counts when it is a real, lower, non-zero price. */
export function effectivePrice(v: { price: number; discountPrice?: number | null }): number {
  return v.discountPrice && v.discountPrice > 0 && v.discountPrice < v.price ? v.discountPrice : v.price;
}

const numOrUndef = (v: unknown) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

/** Validate a variants array coming from the admin form. */
export function parseVariants(
  raw: unknown
): { ok: true; variants: VariantInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "variants must be a list" };
  if (raw.length > MAX_VARIANTS) return { ok: false, error: `At most ${MAX_VARIANTS} variants per product` };

  const seenNames = new Set<string>();
  const seenSkus = new Set<string>();
  const out: VariantInput[] = [];

  for (let i = 0; i < raw.length; i++) {
    const v = (raw[i] ?? {}) as Record<string, unknown>;
    const n = i + 1;
    const name = String(v.name ?? "").trim().slice(0, 80);
    if (!name) return { ok: false, error: `Variant ${n}: name is required` };
    if (seenNames.has(name.toLowerCase())) return { ok: false, error: `Variant names must be unique ("${name}")` };
    seenNames.add(name.toLowerCase());

    const price = Number(v.price);
    if (!Number.isFinite(price) || price <= 0) return { ok: false, error: `${name}: price must be a positive number` };
    const discountPrice = numOrUndef(v.discountPrice);
    if (discountPrice !== undefined && discountPrice !== 0) {
      if (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice >= price) {
        return { ok: false, error: `${name}: discount price must be lower than the price` };
      }
    }
    const stock = v.stock === undefined || v.stock === "" ? 0 : Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: `${name}: stock must be a whole number, 0 or more` };

    const sku = String(v.sku ?? "").trim().slice(0, 40) || undefined;
    if (sku) {
      if (seenSkus.has(sku.toLowerCase())) return { ok: false, error: `Duplicate SKU "${sku}"` };
      seenSkus.add(sku.toLowerCase());
    }

    out.push({
      ...(typeof v._id === "string" && v._id ? { _id: v._id } : {}),
      name,
      sku,
      price,
      discountPrice: discountPrice || undefined,
      stock,
      isActive: v.isActive === undefined ? true : Boolean(v.isActive),
    });
  }
  return { ok: true, variants: out };
}

/**
 * Values the product itself mirrors when it has variants: total stock across all
 * variants, and the cheapest active variant's price (the "from" price).
 */
export function summarizeVariants(variants: { price: number; discountPrice?: number | null; stock: number; isActive: boolean }[]) {
  const stock = variants.reduce((sum, v) => sum + v.stock, 0);
  const active = variants.filter((v) => v.isActive);
  const pool = active.length ? active : variants;
  const cheapest = pool.reduce((best, v) => (effectivePrice(v) < effectivePrice(best) ? v : best), pool[0]);
  return {
    stock,
    price: cheapest.price,
    discountPrice: cheapest.discountPrice && cheapest.discountPrice < cheapest.price ? cheapest.discountPrice : undefined,
  };
}

/** Cart/line identity: a product, or a specific variant of it. */
export const lineKey = (productId: string, variantId?: string | null) =>
  variantId ? `${productId}:${variantId}` : productId;
