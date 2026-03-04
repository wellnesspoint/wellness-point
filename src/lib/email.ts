import nodemailer from "nodemailer";
import { generateInvoicePDF, InvoiceOrderData } from "./invoice";

/**
 * Email service for Wellness Point.
 *
 * Uses SMTP (works with Gmail, Zoho, SendGrid, Hostinger, etc.)
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_SUPPORT_USER, SMTP_SUPPORT_PASS, SMTP_FROM_SUPPORT
 *   SMTP_ORDERS_USER, SMTP_ORDERS_PASS, SMTP_FROM_ORDERS
 */

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_SUPPORT_USER;
  const pass = process.env.SMTP_SUPPORT_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "SMTP not configured. Emails will not be sent.",
      { host: !!host, user: !!user, pass: !!pass }
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass },
  });
}

function getSalesTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_ORDERS_USER;
  const pass = process.env.SMTP_ORDERS_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "Orders SMTP not configured. Falling back to support transporter.",
      { host: !!host, user: !!user, pass: !!pass }
    );
    return getTransporter();
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

const FROM_ADDRESS =
  process.env.SMTP_FROM_SUPPORT || "Wellness Point <support@wellness-point.in>";

const FROM_ADDRESS_SALES =
  process.env.SMTP_FROM_ORDERS || "Wellness Point <orders@wellness-point.in>";

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
  const transporter = getSalesTransporter();
  if (!transporter) {
    console.error("sendOrderConfirmation: No SMTP transporter available. Check SMTP_HOST, SMTP_ORDERS_USER, SMTP_ORDERS_PASS env vars.");
    throw new Error("SMTP not configured — cannot send order confirmation email");
  }

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
    console.log("Invoice PDF generated successfully for order:", orderId8);
  } catch (err) {
    console.error("Failed to generate invoice PDF for email:", err);
    // Continue sending email without PDF attachment
  }

  // Send the email — let errors propagate to caller
  await transporter.sendMail({
    from: FROM_ADDRESS_SALES,
    to: data.customerEmail,
    subject: `Order Confirmed — ${formatOrderId(data.orderId)} | Wellness Point`,
    html,
    attachments,
  });
  console.log("Order confirmation email sent to:", data.customerEmail);
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
  if (!transporter) {
    console.error("sendContactReply: No SMTP transporter available. Check SMTP_HOST, SMTP_SUPPORT_USER, SMTP_SUPPORT_PASS env vars.");
    throw new Error("SMTP not configured — cannot send contact reply email");
  }

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
          <p style="color:#374151;margin:0;white-space:pre-wrap">${data.originalMessage.replace(/\n/g, "<br />")}</p>
        </div>
        <div style="background:#ecfdf5;padding:16px;margin:16px 0;border-radius:8px">
          <p style="color:#065f46;font-weight:600;margin:0 0 8px">Our Reply:</p>
          <p style="color:#374151;margin:0;white-space:pre-wrap">${data.adminReply.replace(/\n/g, "<br />")}</p>
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

  // Send the email — let errors propagate to caller
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.customerEmail,
    subject: `Re: ${data.originalSubject} | Wellness Point`,
    html,
  });
  console.log("Contact reply email sent to:", data.customerEmail);
}

// ─── Password Reset Email ──────────────────────────────────────────

interface PasswordResetData {
  customerName: string;
  customerEmail: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail(data: PasswordResetData) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("SMTP not configured — cannot send password reset email");
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">Wellness Point</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
        <h2 style="color:#065f46">Reset Your Password</h2>
        <p>Hi <strong>${data.customerName}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${data.resetUrl}" style="display:inline-block;background:#065f46;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="color:#6b7280;font-size:12px">
          If the button doesn't work, copy and paste this URL into your browser:<br />
          <a href="${data.resetUrl}" style="color:#065f46;word-break:break-all">${data.resetUrl}</a>
        </p>
      </div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
        © ${new Date().getFullYear()} Wellness Point. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.customerEmail,
    subject: "Reset Your Password | Wellness Point",
    html,
  });
}

// ─── Email Verification ──────────────────────────────────────────

interface EmailVerificationData {
  customerName: string;
  customerEmail: string;
  verifyUrl: string;
}

export async function sendEmailVerification(data: EmailVerificationData) {
  const transporter = getTransporter();
  if (!transporter) {
    console.error("sendEmailVerification: No SMTP transporter available.");
    throw new Error("SMTP not configured — cannot send verification email");
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">Wellness Point</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
        <h2 style="color:#065f46">Verify Your Email</h2>
        <p>Hi <strong>${data.customerName}</strong>,</p>
        <p>Welcome to Wellness Point! Please verify your email address by clicking the button below:</p>
        <div style="text-align:center;margin:24px 0">
          <a href="${data.verifyUrl}" style="display:inline-block;background:#065f46;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">
            Verify Email
          </a>
        </div>
        <p style="color:#6b7280;font-size:13px">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <p style="color:#6b7280;font-size:12px">
          If the button doesn't work, copy and paste this URL:<br />
          <a href="${data.verifyUrl}" style="color:#065f46;word-break:break-all">${data.verifyUrl}</a>
        </p>
      </div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
        © ${new Date().getFullYear()} Wellness Point. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.customerEmail,
    subject: "Verify Your Email | Wellness Point",
    html,
  });
  console.log("Verification email sent to:", data.customerEmail);
}
