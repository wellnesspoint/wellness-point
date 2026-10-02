import toast from "react-hot-toast";
import type { CompanyInfo } from "@/lib/invoice-core";
import type { Order } from "./order-types";

// ——— Invoice PDF (layout shared with the emailed invoice: lib/invoice-core) ———
export async function downloadInvoices(list: Order[]) {
  if (list.length === 0) return;
  const [{ jsPDF }, { renderInvoice }] = await Promise.all([
    import("jspdf"),
    import("@/lib/invoice-core"),
  ]);

  // Load logo as base64 (skipped if it fails)
  let logoBase64: string | null = null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = "/logo.png";
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    logoBase64 = canvas.toDataURL("image/png");
  } catch {
    // no logo
  }

  // Store name / GSTIN / address come from Admin → Settings (falls back to defaults).
  let company: CompanyInfo | undefined;
  try {
    const res = await fetch("/api/admin/settings");
    if (res.ok) company = (await res.json()).settings;
  } catch {
    // use defaults
  }

  // One page per order (invoice on top, shipping label below).
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  list.forEach((order, i) => {
    if (i > 0) doc.addPage();
    renderInvoice(
      doc,
      {
        ...order,
        email: order.shippingAddress?.email || order.user?.email,
        userName: order.user?.name,
      },
      { logoBase64, includeShippingLabel: true, company }
    );
  });

  // Save with data URI to ensure Chrome uses correct filename
  const link = document.createElement("a");
  link.href = doc.output("datauristring");
  link.download =
    list.length === 1
      ? `Invoice-WP-${list[0]._id.slice(-8).toUpperCase()}.pdf`
      : `Invoices-${list.length}-orders-${new Date().toISOString().slice(0, 10)}.pdf`;
  link.click();
  toast.success(list.length === 1 ? "Invoice downloaded" : `${list.length} invoices downloaded`);
}

export const downloadInvoice = (order: Order) => downloadInvoices([order]);

// Packing slips + labels, four to an A4 sheet (lib/packing-slip)
export async function downloadPackingSlips(list: Order[]) {
  if (list.length === 0) return;
  const [{ jsPDF }, { renderPackingSlips }, { COMPANY }] = await Promise.all([
    import("jspdf"),
    import("@/lib/packing-slip"),
    import("@/lib/invoice-core"),
  ]);
  let company: { name: string; location: string } = COMPANY;
  try {
    const res = await fetch("/api/admin/settings");
    if (res.ok) company = (await res.json()).settings ?? COMPANY;
  } catch {
    // use defaults
  }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  renderPackingSlips(doc, list, company);
  const link = document.createElement("a");
  link.href = doc.output("datauristring");
  link.download = `Packing-slips-${list.length}-orders-${new Date().toISOString().slice(0, 10)}.pdf`;
  link.click();
  toast.success(`${list.length} packing slip${list.length !== 1 ? "s" : ""} downloaded`);
}
