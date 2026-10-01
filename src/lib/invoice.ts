import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import { renderInvoice, type CompanyInfo } from "./invoice-core";

/**
 * Server-side invoice PDF generator (email attachment). The layout itself
 * lives in invoice-core.ts and is shared with the admin download.
 */

// Load logo from public/ as base64 data URI (server-side)
// On Vercel serverless, public/ may not be on the filesystem,
// so we also try the .next/server path and gracefully skip if not found.
function loadLogoBase64(): string | null {
  try {
    // Try standard path first (works locally and in some hosting)
    const candidates = [
      path.join(process.cwd(), "public", "logo.png"),
      path.join(process.cwd(), ".next", "static", "media", "logo.png"),
    ];
    for (const logoPath of candidates) {
      if (fs.existsSync(logoPath)) {
        const buffer = fs.readFileSync(logoPath);
        return "data:image/png;base64," + buffer.toString("base64");
      }
    }
    console.warn("Invoice logo not found at any expected path — PDF will omit logo.");
    return null;
  } catch (err) {
    console.warn("Failed to load logo for invoice:", err);
    return null;
  }
}

export interface InvoiceOrderData {
  _id: string;
  createdAt: string | Date;
  paymentStatus: string;
  items: { name: string; quantity: number; price: number }[];
  shippingAddress: {
    fullName: string;
    phone?: string;
    street?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  userEmail?: string;
  userName?: string;
  shipping: number;
  discount: number;
}

/**
 * Generate an invoice PDF and return it as a Buffer.
 */
export function generateInvoicePDF(order: InvoiceOrderData, company?: CompanyInfo): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  renderInvoice(
    doc,
    { ...order, email: order.userEmail },
    { logoBase64: loadLogoBase64(), includeThankYou: true, company }
  );
  return Buffer.from(doc.output("arraybuffer"));
}
