/**
 * Newsletter audience options. Kept free of server-only imports so both the admin
 * page (browser) and lib/newsletter.ts (server) can share one definition.
 */
export const AUDIENCES = ["all", "customers", "non_customers", "recent"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "All active subscribers",
  customers: "Subscribers who have bought",
  non_customers: "Subscribers who have not bought yet",
  recent: "New subscribers (last 30 days)",
};
