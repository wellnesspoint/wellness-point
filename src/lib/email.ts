import nodemailer from "nodemailer";
import { generateInvoicePDF, InvoiceOrderData } from "./invoice";

/**
 * Email service for Wellness Point.
 *
 * Uses SMTP (works with Gmail, Zoho, SendGrid, Hostinger, etc.)
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("SMTP not configured. Emails will not be sent.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass },
  });
}

const FROM_ADDRESS =
  process.env.SMTP_FROM || "Wellness Point <support@wellness-point.in>";

// ─── Email templates ──────────────────────────────────────────────

interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  shipping: number;
  total: number;
  // Extra fields for invoice PDF generation
  shippingAddress?: {
    fullName: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  discount?: number;
  createdAt?: string | Date;
}

function formatOrderId(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`;
}

export async function sendOrderConfirmation(data: OrderEmailData) {
  const transporter = getTransporter();
  if (!transporter) return;

  const itemRows = data.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">₹${item.price.toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">Wellness Point</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
        <h2 style="color:#065f46">Order Confirmed! 🎉</h2>
        <p>Hi <strong>${data.customerName}</strong>,</p>
        <p>Thank you for your order. Here's your order summary:</p>
        <p style="color:#6b7280;font-size:14px">Order ID: <strong>${formatOrderId(data.orderId)}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#065f46;color:#fff">
              <th style="padding:8px;text-align:left">Product</th>
              <th style="padding:8px;text-align:center">Qty</th>
              <th style="padding:8px;text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="text-align:right;margin-top:12px">
          <p style="margin:4px 0">Subtotal: <strong>₹${data.subtotal.toFixed(2)}</strong></p>
          <p style="margin:4px 0">Shipping: <strong>${data.shipping === 0 ? "FREE" : `₹${data.shipping.toFixed(2)}`}</strong></p>
          <p style="margin:4px 0;font-size:18px;color:#065f46">Total: <strong>₹${data.total.toFixed(2)}</strong></p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="color:#6b7280;font-size:13px">
          You can track your order in your <a href="https://wellness-point.in/dashboard/orders" style="color:#065f46">dashboard</a>.
        </p>
        <p style="color:#6b7280;font-size:13px">
          Questions? Contact us at <a href="mailto:support@wellness-point.in" style="color:#065f46">support@wellness-point.in</a>
        </p>
      </div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
        © ${new Date().getFullYear()} Wellness Point. All rights reserved.
      </div>
    </div>
  `;

  // Generate invoice PDF attachment
  const orderId8 = data.orderId.slice(-8).toUpperCase();
  let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  try {
    const invoiceData: InvoiceOrderData = {
      _id: data.orderId,
      createdAt: data.createdAt || new Date(),
      paymentStatus: "paid",
      items: data.items,
      shippingAddress: data.shippingAddress || { fullName: data.customerName },
      userEmail: data.customerEmail,
      userName: data.customerName,
      shipping: data.shipping,
      discount: data.discount || 0,
    };
    const pdfBuffer = generateInvoicePDF(invoiceData);
    attachments = [
      {
        filename: `Invoice-WP-${orderId8}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  } catch (err) {
    console.error("Failed to generate invoice PDF for email:", err);
  }

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: data.customerEmail,
      subject: `Order Confirmed — ${formatOrderId(data.orderId)} | Wellness Point`,
      html,
      attachments,
    });
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }
}

interface ContactReplyData {
  customerName: string;
  customerEmail: string;
  originalSubject: string;
  originalMessage: string;
  adminReply: string;
}

export async function sendContactReply(data: ContactReplyData) {
  const transporter = getTransporter();
  if (!transporter) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">Wellness Point</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
        <h2 style="color:#065f46">We've replied to your query</h2>
        <p>Hi <strong>${data.customerName}</strong>,</p>
        <p>Thank you for reaching out. Here's our response to your inquiry:</p>
        <div style="background:#fff;border-left:4px solid #065f46;padding:16px;margin:16px 0;border-radius:4px">
          <p style="color:#6b7280;font-size:13px;margin:0 0 8px">Your message about "<em>${data.originalSubject}</em>":</p>
          <p style="color:#374151;margin:0">${data.originalMessage}</p>
        </div>
        <div style="background:#ecfdf5;padding:16px;margin:16px 0;border-radius:8px">
          <p style="color:#065f46;font-weight:600;margin:0 0 8px">Our Reply:</p>
          <p style="color:#374151;margin:0">${data.adminReply}</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="color:#6b7280;font-size:13px">
          Need more help? Reply to this email or visit our <a href="https://wellness-point.in/contact" style="color:#065f46">contact page</a>.
        </p>
      </div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
        © ${new Date().getFullYear()} Wellness Point. All rights reserved.
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: data.customerEmail,
      subject: `Re: ${data.originalSubject} | Wellness Point`,
      html,
    });
  } catch (error) {
    console.error("Failed to send contact reply email:", error);
  }
}
