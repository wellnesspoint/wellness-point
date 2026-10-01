import Coupon, { type ICoupon } from "@/models/Coupon";
import Order from "@/models/Order";

type CouponRules = Pick<
  ICoupon,
  "type" | "value" | "minOrder" | "maxDiscount" | "startsAt" | "expiresAt" | "isActive"
>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Discount (₹) a coupon gives on a cart subtotal. Never exceeds the subtotal. */
export function computeDiscount(
  coupon: Pick<ICoupon, "type" | "value" | "maxDiscount">,
  subtotal: number
): number {
  let discount =
    coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  if (coupon.type === "percent" && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return round2(Math.max(0, Math.min(discount, subtotal)));
}

/** Static rules (no DB): active, dates, minimum order. Returns an error message or null. */
export function checkCouponRules(
  coupon: CouponRules,
  subtotal: number,
  now: Date = new Date()
): string | null {
  if (!coupon.isActive) return "This coupon is not active";
  if (coupon.startsAt && now < coupon.startsAt) return "This coupon is not valid yet";
  if (coupon.expiresAt && now > coupon.expiresAt) return "This coupon has expired";
  if (coupon.minOrder > 0 && subtotal < coupon.minOrder) {
    return `Add items worth ₹${Math.ceil(coupon.minOrder - subtotal)} more to use this coupon (minimum order ₹${coupon.minOrder})`;
  }
  return null;
}

export type CouponCheck =
  | { ok: true; coupon: ICoupon; discount: number }
  | { ok: false; error: string };

/**
 * Full validation for a customer's cart. Usage is counted from real orders
 * (paid and not cancelled) instead of a mutable counter, so abandoned
 * checkouts, cancellations and refunds never leave a coupon "used up".
 */
export async function validateCoupon(
  rawCode: string,
  subtotal: number,
  userId: string
): Promise<CouponCheck> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code" };

  const coupon = await Coupon.findOne({ code });
  if (!coupon) return { ok: false, error: "Invalid coupon code" };

  const ruleError = checkCouponRules(coupon, subtotal);
  if (ruleError) return { ok: false, error: ruleError };

  const counted = { couponCode: code, paymentStatus: "paid", orderStatus: { $ne: "cancelled" } };

  if (coupon.usageLimit > 0) {
    const used = await Order.countDocuments(counted);
    if (used >= coupon.usageLimit) {
      return { ok: false, error: "This coupon has reached its usage limit" };
    }
  }
  if (coupon.perUserLimit > 0) {
    const usedByUser = await Order.countDocuments({ ...counted, user: userId });
    if (usedByUser >= coupon.perUserLimit) {
      return { ok: false, error: "You have already used this coupon" };
    }
  }

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) return { ok: false, error: "This coupon doesn't apply to your cart" };
  return { ok: true, coupon, discount };
}
