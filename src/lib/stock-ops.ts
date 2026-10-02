import Product from "@/models/Product";

export interface StockLine {
  product: unknown;
  variantId?: unknown;
  quantity: number;
}

/**
 * Atomically take `quantity` units off a product, or off one variant of it.
 * For a variant the product's own `stock` (the sum of its variants) moves with it
 * in the same update, so the two can never drift. Returns false when there is not
 * enough stock (nothing is changed).
 */
export async function decrementStock(line: StockLine): Promise<boolean> {
  if (line.variantId) {
    const res = await Product.findOneAndUpdate(
      {
        _id: line.product,
        variants: { $elemMatch: { _id: line.variantId, stock: { $gte: line.quantity } } },
      },
      { $inc: { "variants.$.stock": -line.quantity, stock: -line.quantity } },
      { new: true }
    );
    return !!res;
  }
  const res = await Product.findOneAndUpdate(
    { _id: line.product, stock: { $gte: line.quantity } },
    { $inc: { stock: -line.quantity } },
    { new: true }
  );
  return !!res;
}

/** Put `quantity` units back (cancel/refund/rollback). Mirror of decrementStock. */
export async function incrementStock(line: StockLine): Promise<void> {
  if (line.variantId) {
    await Product.updateOne(
      { _id: line.product, "variants._id": line.variantId },
      { $inc: { "variants.$.stock": line.quantity, stock: line.quantity } }
    );
    return;
  }
  await Product.updateOne({ _id: line.product }, { $inc: { stock: line.quantity } });
}
