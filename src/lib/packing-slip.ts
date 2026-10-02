import type { jsPDF } from "jspdf";
import type { CompanyInfo } from "./invoice-core";

export interface PackingSlipOrder {
  _id: string;
  createdAt: string | Date;
  items: { name: string; quantity: number }[];
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    street?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  tracking?: { courier?: string; trackingNumber?: string };
}

/**
 * Packing slips + shipping labels, four to an A4 sheet (cut along the lines).
 * Each cell has the "To" address, the order id, what to pack (quantities only, no
 * prices, so it can go in the parcel), and the courier/AWB when known.
 * Pure jsPDF drawing, used in the browser from the admin orders page.
 */
export function renderPackingSlips(doc: jsPDF, orders: PackingSlipOrder[], company: Pick<CompanyInfo, "name" | "location">) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cellW = W / 2;
  const cellH = H / 2;
  const pad = 8;

  orders.forEach((order, i) => {
    const slot = i % 4;
    if (i > 0 && slot === 0) doc.addPage();
    const x0 = (slot % 2) * cellW;
    const y0 = Math.floor(slot / 2) * cellH;
    const innerW = cellW - pad * 2;
    let y = y0 + pad + 4;
    const left = x0 + pad;

    // cut lines
    doc.setDrawColor(190);
    doc.setLineDashPattern([2, 2], 0);
    if (slot === 0 || slot === 2) doc.line(x0 + cellW, y0, x0 + cellW, y0 + cellH);
    if (slot === 0 || slot === 1) doc.line(x0, y0 + cellH, x0 + cellW, y0 + cellH);
    doc.setLineDashPattern([], 0);

    const id = order._id.slice(-8).toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Order #${id}`, left, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(
      new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      x0 + cellW - pad,
      y,
      { align: "right" }
    );

    y += 7;
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("SHIP TO", left, y);
    y += 4.5;
    const a = order.shippingAddress || {};
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(String(a.fullName || "—").slice(0, 40), left, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const addressLines = doc.splitTextToSize(
      [a.street, a.addressLine2, [a.city, a.state].filter(Boolean).join(", "), a.pincode].filter(Boolean).join(", "),
      innerW
    ) as string[];
    addressLines.slice(0, 4).forEach((line) => {
      doc.text(line, left, y);
      y += 4;
    });
    if (a.phone) {
      doc.text(`Phone: ${a.phone}`, left, y);
      y += 4;
    }

    y += 3;
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("PACK", left, y);
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(20);
    const maxItems = 7;
    order.items.slice(0, maxItems).forEach((item) => {
      const line = doc.splitTextToSize(`${item.quantity} x ${item.name}`, innerW)[0] as string;
      doc.text(line, left, y);
      y += 4;
    });
    if (order.items.length > maxItems) {
      doc.setTextColor(110);
      doc.text(`+ ${order.items.length - maxItems} more item(s)`, left, y);
      y += 4;
    }

    // footer: courier / AWB and sender
    const footerY = y0 + cellH - pad - 6;
    doc.setFontSize(8);
    doc.setTextColor(60);
    const t = order.tracking;
    if (t?.courier || t?.trackingNumber) {
      doc.text(`${t.courier ?? "Courier"}${t.trackingNumber ? `  AWB ${t.trackingNumber}` : ""}`, left, footerY);
    }
    doc.setTextColor(130);
    doc.text(`From: ${company.name}, ${company.location}`.slice(0, 80), left, footerY + 4.5);
  });
}
