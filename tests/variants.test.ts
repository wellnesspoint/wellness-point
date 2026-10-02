import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseVariants, summarizeVariants, effectivePrice, lineKey } from "@/lib/variants";

describe("parseVariants", () => {
  const ok = { name: "1kg", price: 1000, stock: 5 };

  it("accepts valid variants and defaults isActive/stock", () => {
    const r = parseVariants([{ name: " 1kg ", price: "1000", discountPrice: "900" }]);
    expect(r).toEqual({
      ok: true,
      variants: [{ name: "1kg", sku: undefined, price: 1000, discountPrice: 900, stock: 0, isActive: true }],
    });
  });

  it("rejects missing names, duplicate names (case-insensitive) and duplicate SKUs", () => {
    expect(parseVariants([{ ...ok, name: " " }])).toMatchObject({ ok: false });
    expect(parseVariants([ok, { ...ok, name: "1KG" }])).toMatchObject({ ok: false });
    expect(parseVariants([{ ...ok, sku: "A" }, { ...ok, name: "2kg", sku: "a" }])).toMatchObject({ ok: false });
  });

  it("rejects bad prices, discounts at/above price, and bad stock", () => {
    expect(parseVariants([{ ...ok, price: 0 }])).toMatchObject({ ok: false });
    expect(parseVariants([{ ...ok, discountPrice: 1000 }])).toMatchObject({ ok: false });
    expect(parseVariants([{ ...ok, stock: -1 }])).toMatchObject({ ok: false });
    expect(parseVariants([{ ...ok, stock: 1.5 }])).toMatchObject({ ok: false });
  });

  it("rejects non-arrays and more than 30 variants", () => {
    expect(parseVariants("x")).toMatchObject({ ok: false });
    const many = Array.from({ length: 31 }, (_, i) => ({ name: `v${i}`, price: 10, stock: 1 }));
    expect(parseVariants(many)).toMatchObject({ ok: false });
  });
});

describe("summarizeVariants / effectivePrice / lineKey", () => {
  it("sums stock across all variants and mirrors the cheapest active price", () => {
    const s = summarizeVariants([
      { price: 2000, discountPrice: 1500, stock: 3, isActive: true },
      { price: 1200, stock: 4, isActive: true },
      { price: 100, stock: 9, isActive: false }, // inactive: not the "from" price
    ]);
    expect(s).toEqual({ stock: 16, price: 1200, discountPrice: undefined });
  });

  it("uses the discounted price for 'from' when it is the cheapest", () => {
    const s = summarizeVariants([{ price: 2000, discountPrice: 900, stock: 1, isActive: true }, { price: 1000, stock: 1, isActive: true }]);
    expect(s.price).toBe(2000);
    expect(s.discountPrice).toBe(900);
  });

  it("ignores a discount that is not lower than the price", () => {
    expect(effectivePrice({ price: 100, discountPrice: 100 })).toBe(100);
    expect(effectivePrice({ price: 100, discountPrice: 0 })).toBe(100);
    expect(effectivePrice({ price: 100, discountPrice: 80 })).toBe(80);
  });

  it("keys plain products by id and variants by id:variant", () => {
    expect(lineKey("p1")).toBe("p1");
    expect(lineKey("p1", "v1")).toBe("p1:v1");
  });
});

// --- priceCart with variants -------------------------------------------------
const productFind = vi.fn();
vi.mock("@/models/Product", () => ({
  default: {
    find: () => ({ lean: async () => productFind() }),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
}));

const P = "64b000000000000000000001";
const V1 = "64b0000000000000000000a1";
const V2 = "64b0000000000000000000a2";
const mkProduct = (over: Record<string, unknown> = {}) => ({
  _id: P,
  name: "Whey",
  price: 1000,
  stock: 10,
  images: ["img.jpg"],
  variants: [
    { _id: V1, name: "1kg", price: 1000, discountPrice: 900, stock: 4, isActive: true },
    { _id: V2, name: "2kg", price: 1800, stock: 6, isActive: false },
  ],
  ...over,
});

describe("priceCart with variants", () => {
  beforeEach(() => productFind.mockReset());

  it("prices a variant line from the database and names it with the variant", async () => {
    const { priceCart } = await import("@/lib/cart-pricing");
    productFind.mockReturnValue([mkProduct()]);
    const r = await priceCart([{ _id: P, variantId: V1, quantity: 2, price: 1 }]);
    expect(r).toMatchObject({ ok: true, subtotal: 1800 });
    if (r.ok) expect(r.items[0]).toMatchObject({ name: "Whey – 1kg", variantName: "1kg", price: 900, quantity: 2 });
  });

  it("requires a variant choice when the product has variants", async () => {
    const { priceCart } = await import("@/lib/cart-pricing");
    productFind.mockReturnValue([mkProduct()]);
    const r = await priceCart([{ _id: P, quantity: 1 }]);
    expect(r).toMatchObject({ ok: false });
  });

  it("rejects inactive or unknown variants and variant ids on plain products", async () => {
    const { priceCart } = await import("@/lib/cart-pricing");
    productFind.mockReturnValue([mkProduct()]);
    expect(await priceCart([{ _id: P, variantId: V2, quantity: 1 }])).toMatchObject({ ok: false });
    expect(await priceCart([{ _id: P, variantId: "64b0000000000000000000ff", quantity: 1 }])).toMatchObject({ ok: false });
    expect(await priceCart([{ _id: P, variantId: "not-an-id", quantity: 1 }])).toMatchObject({ ok: false });
    productFind.mockReturnValue([mkProduct({ variants: undefined })]);
    expect(await priceCart([{ _id: P, variantId: V1, quantity: 1 }])).toMatchObject({ ok: false });
  });

  it("checks stock per variant, merging duplicate lines first", async () => {
    const { priceCart } = await import("@/lib/cart-pricing");
    productFind.mockReturnValue([mkProduct()]);
    expect(await priceCart([{ _id: P, variantId: V1, quantity: 3 }, { _id: P, variantId: V1, quantity: 2 }])).toMatchObject({
      ok: false,
    }); // 5 > 4 in stock
    expect(await priceCart([{ _id: P, variantId: V1, quantity: 4 }])).toMatchObject({ ok: true });
  });

  it("still prices plain products from product-level price and stock", async () => {
    const { priceCart } = await import("@/lib/cart-pricing");
    productFind.mockReturnValue([mkProduct({ variants: undefined, discountPrice: 800 })]);
    const r = await priceCart([{ _id: P, quantity: 2 }]);
    expect(r).toMatchObject({ ok: true, subtotal: 1600 });
  });
});

// --- stock operations ----------------------------------------------------------
describe("stock-ops", () => {
  it("decrements a variant and the product total in ONE atomic update, guarded by variant stock", async () => {
    const Product = (await import("@/models/Product")).default as any;
    const { decrementStock } = await import("@/lib/stock-ops");
    Product.findOneAndUpdate.mockReset();
    Product.findOneAndUpdate.mockResolvedValue({ _id: P });

    expect(await decrementStock({ product: P, variantId: V1, quantity: 3 })).toBe(true);
    expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: P, variants: { $elemMatch: { _id: V1, stock: { $gte: 3 } } } },
      { $inc: { "variants.$.stock": -3, stock: -3 } },
      { new: true }
    );
  });

  it("reports failure (changes nothing) when the variant does not have enough stock", async () => {
    const Product = (await import("@/models/Product")).default as any;
    const { decrementStock } = await import("@/lib/stock-ops");
    Product.findOneAndUpdate.mockReset();
    Product.findOneAndUpdate.mockResolvedValue(null);
    expect(await decrementStock({ product: P, variantId: V1, quantity: 99 })).toBe(false);
  });

  it("uses the plain product path when there is no variant, and restores both on increment", async () => {
    const Product = (await import("@/models/Product")).default as any;
    const { decrementStock, incrementStock } = await import("@/lib/stock-ops");
    Product.findOneAndUpdate.mockReset();
    Product.findOneAndUpdate.mockResolvedValue({ _id: P });
    await decrementStock({ product: P, quantity: 2 });
    expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: P, stock: { $gte: 2 } },
      { $inc: { stock: -2 } },
      { new: true }
    );

    Product.updateOne.mockReset();
    await incrementStock({ product: P, variantId: V1, quantity: 3 });
    expect(Product.updateOne).toHaveBeenCalledWith(
      { _id: P, "variants._id": V1 },
      { $inc: { "variants.$.stock": 3, stock: 3 } }
    );
  });
});
