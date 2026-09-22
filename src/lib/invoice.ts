import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

/**
 * Server-side invoice PDF generator for Wellness Point.
 * Mirrors the admin downloadInvoice() exactly but uses Node.js APIs.
 */

// Indian number formatting (commas): 1,23,456.78
function fmt(n: number): string {
  const s = Math.abs(n).toFixed(2);
  const [intPart, dec] = s.split(".");
  if (intPart.length <= 3)
    return (n < 0 ? "-" : "") + intPart + (dec !== "00" ? "." + dec : "");
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return (
    (n < 0 ? "-" : "") +
    parts.join(",") +
    "," +
    last3 +
    (dec !== "00" ? "." + dec : "")
  );
}

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
export function generateInvoicePDF(order: InvoiceOrderData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 210mm
  const M = 15; // margin
  const orderId = order._id.slice(-8).toUpperCase();
  const invoiceNo = `WP-${orderId}`;
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ---------- TOP HALF: INVOICE ----------
  let y = 18;

  // Load logo as base64 (server-side)
  const logoBase64 = loadLogoBase64();

  // Company header with logo
  const logoSize = 16;
  const textStartX = logoBase64 ? M + logoSize + 3 : M;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", M, y - 6, logoSize, logoSize);
  }
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Wellness Point", textStartX, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    "Premium Food Supplements for Whole-Body Wellness",
    textStartX,
    y
  );
  y += 4;
  doc.text("Bengaluru, Karnataka, India", textStartX, y);
  y += 4;
  doc.text("GST No: 29ACQPH3825A1ZP", textStartX, y);

  // "TAX INVOICE" label on right
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("TAX INVOICE", W - M, 18, { align: "right" });

  // Invoice meta on right
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Invoice No: ${invoiceNo}`, W - M, 24, { align: "right" });
  doc.text(`Order ID: #${orderId}`, W - M, 28, { align: "right" });
  doc.text(`Date: ${orderDate}`, W - M, 32, { align: "right" });
  doc.text(
    `Payment: Razorpay (${order.paymentStatus.toUpperCase()})`,
    W - M,
    36,
    { align: "right" }
  );

  y += 6;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 6;

  // Bill To section
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("BILL TO:", M, y);
  y += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(
    order.shippingAddress?.fullName || order.userName || "Customer",
    M,
    y
  );
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  if (order.shippingAddress?.phone) {
    doc.text(`Phone: ${order.shippingAddress.phone}`, M, y);
    y += 4;
  }
  if (order.userEmail) {
    doc.text(`Email: ${order.userEmail}`, M, y);
    y += 4;
  }
  const addressLine = [
    order.shippingAddress?.street,
    order.shippingAddress?.addressLine2,
  ]
    .filter(Boolean)
    .join(", ");
  doc.text(
    `${addressLine}, ${order.shippingAddress?.city || ""}, ${order.shippingAddress?.state || ""} - ${order.shippingAddress?.pincode || ""}`,
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

  // Items rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);
  order.items.forEach((item, i) => {
    doc.setFontSize(8);
    doc.text(String(i + 1), M + 2, y);
    const nameText =
      item.name.length > 40 ? item.name.substring(0, 37) + "..." : item.name;
    doc.text(nameText, M + 10, y);
    doc.text(String(item.quantity), W - M - 60, y, { align: "center" });
    doc.text(`Rs. ${fmt(item.price)}`, W - M - 35, y, { align: "right" });
    doc.text(`Rs. ${fmt(item.price * item.quantity)}`, W - M - 2, y, {
      align: "right",
    });
    y += 6;
  });

  // Divider
  y += 2;
  doc.setDrawColor(200);
  doc.line(W - M - 80, y, W - M, y);
  y += 6;

  // Summary
  const calcSubtotal = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const calcTotal =
    calcSubtotal + (order.shipping || 0) - (order.discount || 0);

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("Subtotal:", W - M - 80, y);
  doc.setTextColor(30);
  doc.text(`Rs. ${fmt(calcSubtotal)}`, W - M - 2, y, { align: "right" });
  y += 5;

  doc.setTextColor(80);
  doc.text("Shipping:", W - M - 80, y);
  doc.setTextColor(30);
  doc.text(`Rs. ${fmt(order.shipping || 0)}`, W - M - 2, y, {
    align: "right",
  });
  y += 5;

  if (order.discount > 0) {
    doc.setTextColor(80);
    doc.text("Discount:", W - M - 80, y);
    doc.setTextColor(22, 163, 74);
    doc.text(`-Rs. ${fmt(order.discount)}`, W - M - 2, y, {
      align: "right",
    });
    y += 5;
  }

  // Total
  doc.setDrawColor(200);
  doc.line(W - M - 80, y, W - M, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34, 120, 65);
  doc.text("TOTAL:", W - M - 80, y);
  doc.text(`Rs. ${fmt(calcTotal)}`, W - M - 2, y, { align: "right" });
  y += 8;

  // GST note
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text("* All prices are inclusive of applicable GST.", M, y);
  y += 3;
  doc.text(
    "* This is a computer-generated invoice and does not require a signature.",
    M,
    y
  );
  y += 10;

  // Thank-you footer
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("Thank you for shopping with Wellness Point!", W / 2, y, {
    align: "center",
  });
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    "For any queries, contact us at support@wellness-point.in | www.wellness-point.in",
    W / 2,
    y,
    { align: "center" }
  );

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
