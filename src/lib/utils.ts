import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function getDiscountPercentage(
  price: number,
  discountPrice: number
): number {
  return Math.round(((price - discountPrice) / price) * 100);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, "").trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check a file's actual bytes against known image format signatures instead
 * of trusting the client-supplied MIME type, which is just a form field an
 * uploader controls — a malicious file (e.g. HTML/SVG with an embedded
 * script) can freely claim `Content-Type: image/png`.
 */
export function isLikelyImageFile(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return true;
  // GIF: "GIF87a" / "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  )
    return true;
  // WEBP: "RIFF"....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return true;
  // AVIF/HEIC-family: ftyp box with an avif/heic brand
  const ftyp = buffer.toString("ascii", 4, 8);
  if (ftyp === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["avif", "avis", "heic", "heix", "mif1"].includes(brand)) return true;
  }

  return false;
}

/** Escape text before interpolating it into an HTML email template. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ShippingAddressInput {
  fullName?: string;
  email?: string;
  phone?: string;
  street?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/**
 * Server-side mirror of the checkout form's validation. The client-side
 * regex is UX only — anyone can call the API directly, so this is what
 * actually keeps garbage/HTML out of orders, invoices, and confirmation
 * emails. Allows apostrophes/hyphens/periods in names & places (e.g.
 * "O'Brien", "St. Thomas Mount").
 */
export function validateShippingAddress(
  input: ShippingAddressInput
): { valid: true; address: Required<Omit<ShippingAddressInput, "addressLine2">> & { addressLine2: string } } | { valid: false; error: string } {
  const nameLike = /^[a-zA-Z][a-zA-Z\s'.-]{0,99}$/;
  const pincodeRe = /^\d{6}$/;
  const phoneRe = /^\d{10}$/;

  const fullName = (input.fullName || "").trim();
  const email = (input.email || "").trim();
  const phone = (input.phone || "").trim();
  const street = (input.street || "").trim();
  const addressLine2 = (input.addressLine2 || "").trim();
  const city = (input.city || "").trim();
  const state = (input.state || "").trim();
  const pincode = (input.pincode || "").trim();

  if (!nameLike.test(fullName)) return { valid: false, error: "Invalid full name" };
  if (!isValidEmail(email)) return { valid: false, error: "Invalid email address" };
  if (!phoneRe.test(phone)) return { valid: false, error: "Invalid phone number" };
  if (!street || street.length > 200) return { valid: false, error: "Invalid street address" };
  if (addressLine2.length > 200) return { valid: false, error: "Address line 2 is too long" };
  if (!nameLike.test(city)) return { valid: false, error: "Invalid city" };
  if (!nameLike.test(state)) return { valid: false, error: "Invalid state" };
  if (!pincodeRe.test(pincode)) return { valid: false, error: "Invalid pincode" };

  return {
    valid: true,
    address: {
      fullName: sanitizeInput(fullName),
      email,
      phone,
      street: sanitizeInput(street),
      addressLine2: sanitizeInput(addressLine2),
      city: sanitizeInput(city),
      state: sanitizeInput(state),
      pincode,
    },
  };
}

/**
 * The root layout's metadata title template appends " | <site name>" to
 * every page title. If an admin-entered title (e.g. a product's metaTitle)
 * already ends with the site name — a natural thing to type for SEO — the
 * template would double it up ("X | Wellness Point | Wellness Point").
 * Strip a pre-existing suffix before it reaches the template.
 */
export function stripSiteNameSuffix(title: string, siteName: string): string {
  const suffix = ` | ${siteName}`;
  return title.toLowerCase().endsWith(suffix.toLowerCase())
    ? title.slice(0, title.length - suffix.length).trim()
    : title;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Wellness Point";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";


/** Clean a list of product tags: trimmed, lower-cased, de-duplicated, max 15 of max 30 chars. */
export function normalizeTags(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= 15) break;
  }
  return out;
}


/**
 * Ask Cloudinary for a right-sized, auto-format (WebP/AVIF) copy of an image instead of the
 * full-size original. Only touches res.cloudinary.com delivery URLs that have no
 * transformation yet; anything else (Unsplash, local files...) is returned unchanged.
 */
export function cloudinaryUrl(url: string | undefined | null, width: number): string {
  if (!url) return "";
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.*)$/);
  if (!m) return url;
  return `${m[1]}f_auto,q_auto,c_limit,w_${Math.max(16, Math.round(width))}/${m[2]}`;
}
