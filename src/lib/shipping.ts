/**
 * Single source of truth for shipping defaults and the shipping-cost rule.
 * Previously the checkout page, /api/shipping and /api/payment/create-order
 * each had their own (conflicting) fallback numbers, so a missing settings
 * document made the customer see one total and Razorpay charge another.
 * Defaults mirror the ShippingSettings model.
 */
export interface ShippingZone {
  name?: string;
  states: string[];
  rate: number;
  estimatedDays?: number;
}

export interface ShippingConfig {
  flatRate: number;
  freeShippingThreshold: number;
  enableFreeShipping: boolean;
  /** State-based rates; the first zone containing the destination state overrides `flatRate`. */
  zones?: ShippingZone[];
}

export const DEFAULT_SHIPPING: ShippingConfig = {
  flatRate: 50,
  freeShippingThreshold: 499,
  enableFreeShipping: true,
};

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/** First zone whose `states` include the destination state (case-insensitive). */
export function findZone(
  state: string | undefined | null,
  zones?: ShippingZone[] | null
): ShippingZone | null {
  if (!state || !zones?.length) return null;
  const target = norm(state);
  return zones.find((z) => z.states?.some((s) => norm(s) === target)) ?? null;
}

export function computeShipping(
  subtotal: number,
  config?: Partial<ShippingConfig> | null,
  state?: string | null
): number {
  const c = { ...DEFAULT_SHIPPING, ...(config || {}) };
  if (c.enableFreeShipping && subtotal >= c.freeShippingThreshold) return 0;
  const zone = findZone(state, c.zones);
  return zone ? zone.rate : c.flatRate;
}
