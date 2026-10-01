import connectDB from "./db";
import SiteSettings from "@/models/SiteSettings";
import { COMPANY, type CompanyInfo } from "./invoice-core";

const TTL_MS = 60 * 1000;
let cache: { value: CompanyInfo; at: number } | null = null;

/**
 * Store details used by invoices and emails. Values saved in Admin → Settings
 * override the built-in defaults; any blank field falls back to its default.
 * Cached briefly per instance (settings change rarely).
 */
export async function getCompany(): Promise<CompanyInfo> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  let value: CompanyInfo = { ...COMPANY };
  try {
    await connectDB();
    const doc = await SiteSettings.findOne().lean();
    if (doc) {
      value = {
        name: doc.storeName || COMPANY.name,
        tagline: doc.tagline || COMPANY.tagline,
        location: doc.location || COMPANY.location,
        gstNo: doc.gstNo || COMPANY.gstNo,
        supportEmail: doc.supportEmail || COMPANY.supportEmail,
        website: doc.website || COMPANY.website,
        phone: doc.phone || undefined,
      };
    }
  } catch (err) {
    console.error("Failed to load site settings, using defaults:", err);
  }
  cache = { value, at: Date.now() };
  return value;
}

export function clearCompanyCache() {
  cache = null;
}
