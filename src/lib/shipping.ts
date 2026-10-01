/**
 * Single source of truth for shipping defaults and the shipping-cost rule.
 * Previously the checkout page, /api/shipping and /api/payment/create-order
 * each had their own (conflicting) fallback numbers, so a missing settings
 * document made the customer see one total and Razorpay charge another.
 * Defaults mirror the ShippingSettings model.
 */
export interface ShippingConfig {
  flatRate: number;
  freeShippingThreshold: number;
  enableFreeShipping: boolean;
}

export const DEFAULT_SHIPPING: ShippingConfig = {
  flatRate: 50,
  freeShippingThreshold: 499,
  enableFreeShipping: true,
};

export function computeShipping(
  subtotal: number,
  config?: Partial<ShippingConfig> | null
): number {
  const c = { ...DEFAULT_SHIPPING, ...(config || {}) };
  if (c.enableFreeShipping && subtotal >= c.freeShippingThreshold) return 0;
  return c.flatRate;
}
