import type { jsPDF } from "jspdf";
import { calcOrderSubtotal } from "./order-math";

/**
 * Shared invoice renderer. The emailed PDF (server, lib/invoice.ts) and the
 * admin "Download Invoice" button (browser) used to be two hand-maintained
 * copies of this layout; both now call renderInvoice() and differ only in
 * options. Pure drawing code (no fs/DOM access), so it runs in both places.
 */
export interface CompanyInfo {
  name: string;
  tagline: string;
  location: string;
  gstNo: string;
  supportEmail: string;
  website: string;
  phone?: string;
}

/** Built-in defaults; Admin → Settings overrides them (see lib/site-settings). */
export const COMPANY: CompanyInfo = {
  name: "Wellness Point",
  tagline: "Premium Food Supplements for Whole-Body Wellness",
  location: "Bengaluru, Karnataka, India",
  gstNo: "29ACQPH3825A1ZP",
  supportEmail: "support@wellness-point.in",
  website: "www.wellness-point.in",
};

// Indian number formatting (commas): 1,23,456.78
export function fmt(n: number): string {
  const s = Math.abs(n).toFixed(2);
  const [intPart, dec] = s.split(".");
  const sign = n < 0 ? "-" : "";
  const decimals = dec !== "00" ? "." + dec : "";
  if (intPart.length <= 3) return sign + intPart + decimals;
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return sign + parts.join(",") + "," + last3 + decimals;
}

export interface InvoiceData {
  _id: string;
  createdAt: string | Date;
  paymentStatus: string;
  items: { name: string; quantity: number; price: number }[];
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    street?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  email?: string;
  userName?: string;
  shipping: number;
  discount: number;
}

export interface InvoiceOptions {
  /** PNG data URI; the logo is skipped when omitted. */
  logoBase64?: string | null;
  /** Bottom half of the page: a cut-out shipping label (admin print copy). */
  includeShippingLabel?: boolean;
  /** "Thank you" footer under the totals (customer email copy). */
  includeThankYou?: boolean;
  /** Store details; defaults to COMPANY. */
  company?: CompanyInfo;
}

export function renderInvoice(doc: jsPDF, order: InvoiceData, opts: InvoiceOptions = {}): void {
  const W = doc.internal.pageSize.getWidth(); // 210mm
  const H = doc.internal.pageSize.getHeight(); // 297mm
  const M = 15; // margin
  const orderId = order._id.slice(-8).toUpperCase();
  const invoiceNo = `WP-${orderId}`;
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const addr = order.shippingAddress || {};
  const company = opts.company ?? COMPANY;

  // ---------- TOP HALF: INVOICE ----------
  let y = 18;

  const logoSize = 16;
  const textStartX = opts.logoBase64 ? M + logoSize + 3 : M;
  if (opts.logoBase64) {
    doc.addImage(opts.logoBase64, "PNG", M, y - 6, logoSize, logoSize);
  }
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(company.name, textStartX, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(company.tagline, textStartX, y);
  y += 4;
  doc.text(company.location, textStartX, y);
  y += 4;
  doc.text(`GST No: ${company.gstNo}`, textStartX, y);

  // "TAX INVOICE" label + meta on the right
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("TAX INVOICE", W - M, 18, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Invoice No: ${invoiceNo}`, W - M, 24, { align: "right" });
  doc.text(`Order ID: #${orderId}`, W - M, 28, { align: "right" });
  doc.text(`Date: ${orderDate}`, W - M, 32, { align: "right" });
  doc.text(`Payment: Razorpay (${order.paymentStatus.toUpperCase()})`, W - M, 36, { align: "right" });

  y += 6;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 6;

  // Bill To
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("BILL TO:", M, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(addr.fullName || order.userName || "Customer", M, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  if (addr.phone) {
    doc.text(`Phone: ${addr.phone}`, M, y);
    y += 4;
  }
  if (order.email) {
    doc.text(`Email: ${order.email}`, M, y);
    y += 4;
  }
  doc.text(
    `${[addr.street, addr.addressLine2].filter(Boolean).join(", ")}, ${addr.city || ""}, ${addr.state || ""} - ${addr.pincode || ""}`,
    M,
    y
  );
  y += 8;

  // Items table header
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y - 1, W - 2 * M, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60);
  doc.text("#", M + 2, y + 3.5);
  doc.text("Product", M + 10, y + 3.5);
  doc.text("Qty", W - M - 60, y + 3.5, { align: "center" });
  doc.text("Unit Price", W - M - 35, y + 3.5, { align: "right" });
  doc.text("Amount", W - M - 2, y + 3.5, { align: "right" });
  y += 10;

  // Item rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);
  order.items.forEach((item, i) => {
    doc.setFontSize(8);
    doc.text(String(i + 1), M + 2, y);
    const nameText = item.name.length > 40 ? item.name.substring(0, 37) + "..." : item.name;
    doc.text(nameText, M + 10, y);
    doc.text(String(item.quantity), W - M - 60, y, { align: "center" });
    doc.text(`Rs. ${fmt(item.price)}`, W - M - 35, y, { align: "right" });
    doc.text(`Rs. ${fmt(item.price * item.quantity)}`, W - M - 2, y, { align: "right" });
    y += 6;
  });

  y += 2;
  doc.setDrawColor(200);
  doc.line(W - M - 80, y, W - M, y);
  y += 6;

  // Summary: derived from the line items so the numbers always add up
  const subtotal = calcOrderSubtotal(order);
  const total = subtotal + (order.shipping || 0) - (order.discount || 0);

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("Subtotal:", W - M - 80, y);
  doc.setTextColor(30);
  doc.text(`Rs. ${fmt(subtotal)}`, W - M - 2, y, { align: "right" });
  y += 5;

  doc.setTextColor(80);
  doc.text("Shipping:", W - M - 80, y);
  doc.setTextColor(30);
  doc.text(`Rs. ${fmt(order.shipping || 0)}`, W - M - 2, y, { align: "right" });
  y += 5;

  if (order.discount > 0) {
    doc.setTextColor(80);
    doc.text("Discount:", W - M - 80, y);
    doc.setTextColor(22, 163, 74);
    doc.text(`-Rs. ${fmt(order.discount)}`, W - M - 2, y, { align: "right" });
    y += 5;
  }

  doc.setDrawColor(200);
  doc.line(W - M - 80, y, W - M, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("TOTAL:", W - M - 80, y);
  doc.text(`Rs. ${fmt(total)}`, W - M - 2, y, { align: "right" });
  y += 8;

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text("* All prices are inclusive of applicable GST.", M, y);
  y += 3;
  doc.text("* This is a computer-generated invoice and does not require a signature.", M, y);
  y += 10;

  if (opts.includeThankYou) {
    doc.setDrawColor(200);
    doc.line(M, y, W - M, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(`Thank you for shopping with ${company.name}!`, W / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `For any queries, contact us at ${company.supportEmail} | ${company.website}`,
      W / 2,
      y,
      { align: "center" }
    );
  }

  if (!opts.includeShippingLabel) return;

  // ---------- CUT LINE ----------
  const cutY = H / 2;
  doc.setDrawColor(150);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(M, cutY, W - M, cutY);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150);
  doc.text("--- CUT HERE --- Keep above with product, paste below on delivery box ---", M + 5, cutY - 2);
  doc.setLineDashPattern([], 0);

  // ---------- BOTTOM HALF: SHIPPING LABEL ----------
  let sy = cutY + 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("SHIPPING LABEL", W / 2, sy, { align: "center" });
  sy += 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("FROM:", M, sy);
  sy += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30);
  doc.text(company.name, M, sy);
  sy += 4;
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(company.location, M, sy);
  sy += 4;
  doc.text(`GST No: ${company.gstNo}`, M, sy);
  sy += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("TO:", M, sy);
  sy += 6;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(addr.fullName || "Customer", M, sy);
  sy += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  if (addr.street) {
    doc.text(addr.street, M, sy);
    sy += 6;
  }
  if (addr.addressLine2) {
    doc.text(addr.addressLine2, M, sy);
    sy += 6;
  }
  doc.text(`${addr.city || ""}, ${addr.state || ""}`, M, sy);
  sy += 6;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(`PIN: ${addr.pincode || ""}`, M, sy);
  sy += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  doc.text(`Phone: ${addr.phone || ""}`, M, sy);
  sy += 10;

  doc.setDrawColor(200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(M, sy, W - 2 * M, 14, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text(`Order: #${orderId}`, M + 5, sy + 6);
  doc.text(`Date: ${orderDate}`, W / 2, sy + 6);
  doc.text(`Items: ${order.items.length}`, W - M - 30, sy + 6);
  doc.text(`Total: Rs. ${fmt(total)}`, W / 2, sy + 11);
}
