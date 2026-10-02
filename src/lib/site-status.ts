import connectDB from "./db";
import SiteSettings from "@/models/SiteSettings";
import Redirect from "@/models/Redirect";
import type { RedirectRule } from "./redirects";

export interface SiteStatus {
  maintenance: { on: boolean; message: string };
  redirects: RedirectRule[];
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  "We're making a few improvements and will be back shortly. Thank you for your patience.";

const TTL_MS = 30 * 1000;
let cache: { value: SiteStatus; at: number } | null = null;

/** Maintenance flag + active redirects, cached briefly per instance. Fails open (no maintenance, no redirects). */
export async function getSiteStatus(): Promise<SiteStatus> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: SiteStatus = { maintenance: { on: false, message: DEFAULT_MAINTENANCE_MESSAGE }, redirects: [] };
  try {
    await connectDB();
    const [settings, redirects] = await Promise.all([
      SiteSettings.findOne().select("maintenanceMode maintenanceMessage").lean(),
      Redirect.find({ isActive: true }).select("from to permanent").limit(1000).lean(),
    ]);
    value = {
      maintenance: {
        on: !!settings?.maintenanceMode,
        message: settings?.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
      },
      redirects: redirects.map((r) => ({ from: r.from, to: r.to, permanent: r.permanent })),
    };
  } catch (err) {
    console.error("Site status load failed:", err);
  }
  cache = { value, at: Date.now() };
  return value;
}

export function clearSiteStatusCache() {
  cache = null;
}
