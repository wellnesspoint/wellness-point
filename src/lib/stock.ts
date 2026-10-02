import connectDB from "./db";
import Product from "@/models/Product";
import User from "@/models/User";
import StockMovement, { type StockReason } from "@/models/StockMovement";
import { sendLowStockAlert } from "./email";

export interface StockMovementInput {
  product: unknown;
  variantId?: unknown;
  variantName?: string;
  delta: number;
  reason: StockReason;
  order?: unknown;
  actorName?: string;
  balance?: number;
}

/** Append stock-history rows. Never throws (history must not break an order). */
export async function logStockMovements(entries: StockMovementInput[]): Promise<void> {
  const rows = entries.filter((e) => e.delta !== 0);
  if (rows.length === 0) return;
  try {
    await connectDB();
    await StockMovement.insertMany(rows);
  } catch (err) {
    console.error("Stock movement log failed:", err);
  }
}

const LOW_STOCK_EXPR = {
  $lte: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }],
};

/**
 * Email the admins once when products fall to/below their low-stock threshold.
 * `lowStockAlertedAt` de-duplicates: a product alerts once, and is re-armed
 * automatically when its stock rises back above the threshold. Best-effort.
 */
export async function checkLowStock(): Promise<void> {
  try {
    await connectDB();

    // Re-arm products that have been restocked.
    await Product.updateMany(
      {
        lowStockAlertedAt: { $exists: true },
        $expr: { $gt: ["$stock", { $ifNull: ["$lowStockThreshold", 10] }] },
      },
      { $unset: { lowStockAlertedAt: "" } }
    );

    const low = await Product.find({
      isActive: true,
      archivedAt: { $exists: false },
      lowStockAlertedAt: { $exists: false },
      $expr: LOW_STOCK_EXPR,
    })
      .select("name stock lowStockThreshold")
      .limit(50)
      .lean();
    if (low.length === 0) return;

    const admins = await User.find({ role: "admin", isActive: true }).select("email").lean();
    const recipients = admins.map((a) => a.email).filter(Boolean);

    if (recipients.length > 0) {
      await sendLowStockAlert(
        recipients,
        low.map((p) => ({
          name: p.name,
          stock: p.stock,
          threshold: p.lowStockThreshold ?? 10,
        }))
      );
    }
    // Mark as alerted even with no recipients, so this doesn't re-run on every order.
    await Product.updateMany(
      { _id: { $in: low.map((p) => p._id) } },
      { $set: { lowStockAlertedAt: new Date() } }
    );
  } catch (err) {
    console.error("Low-stock check failed:", err);
  }
}
