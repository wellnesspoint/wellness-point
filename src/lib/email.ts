import nodemailer from "nodemailer";
import { generateInvoicePDF, InvoiceOrderData } from "./invoice";
import { escapeHtml } from "./utils";
import { getCompany } from "./site-settings";

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
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  discount?: number;
  couponCode?: string;
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
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.name)}</td>
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
        <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
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
          ${data.discount ? `<p style="margin:4px 0;color:#15803d">Discount${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ""}: <strong>-₹${data.discount.toFixed(2)}</strong></p>` : ""}
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
    const pdfBuffer = generateInvoicePDF(invoiceData, await getCompany());
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
        <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
        <p>Thank you for reaching out. Here's our response to your inquiry:</p>
        <div style="background:#fff;border-left:4px solid #065f46;padding:16px;margin:16px 0;border-radius:4px">
          <p style="color:#6b7280;font-size:13px;margin:0 0 8px">Your message about "<em>${escapeHtml(data.originalSubject)}</em>":</p>
          <p style="color:#374151;margin:0;white-space:pre-wrap">${escapeHtml(data.originalMessage).replace(/\n/g, "<br />")}</p>
        </div>
        <div style="background:#ecfdf5;padding:16px;margin:16px 0;border-radius:8px">
          <p style="color:#065f46;font-weight:600;margin:0 0 8px">Our Reply:</p>
          <p style="color:#374151;margin:0;white-space:pre-wrap">${escapeHtml(data.adminReply).replace(/\n/g, "<br />")}</p>
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
        <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
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

// ─── OAuth Account Notice ──────────────────────────────────────────
// Sent instead of a reset link when a password-reset request comes in for
// an email that's only registered via Google/Facebook sign-in. Keeping this
// server-side (rather than telling the API caller directly) means the
// forgot-password endpoint's response is identical whether or not — and
// however — the account exists, closing an account-enumeration gap.

interface OAuthAccountNoticeData {
  customerName: string;
  customerEmail: string;
  provider: string;
}

export async function sendOAuthAccountNotice(data: OAuthAccountNoticeData) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("SMTP not configured — cannot send account notice email");
  }

  const providerLabel = data.provider.charAt(0).toUpperCase() + data.provider.slice(1);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">Wellness Point</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">
        <h2 style="color:#065f46">About Your Sign-In</h2>
        <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
        <p>Someone requested a password reset for this email address. Your Wellness Point account uses <strong>${escapeHtml(providerLabel)}</strong> sign-in, so it doesn't have a password to reset.</p>
        <p>Please sign in using the "${escapeHtml(providerLabel)}" button on our login page instead.</p>
        <p style="color:#6b7280;font-size:13px">If this wasn't you, you can safely ignore this email.</p>
      </div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
        © ${new Date().getFullYear()} Wellness Point. All rights reserved.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.customerEmail,
    subject: "About Your Wellness Point Sign-In",
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
        <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
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

// ─── Order status emails ───────────────────────────────────────────

export type OrderStatusEmailType = "shipped" | "delivered" | "cancelled" | "refunded";

interface OrderStatusEmailData {
  type: OrderStatusEmailType;
  customerName: string;
  customerEmail: string;
  orderId: string;
  total: number;
  tracking?: { courier?: string; trackingNumber?: string; trackingUrl?: string };
}

const APP_BASE_URL = () => process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in";

function emailShell(inner: string, companyName: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <div style="text-align:center;padding:20px;background:#065f46;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0">${escapeHtml(companyName)}</h1>
      </div>
      <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb">${inner}</div>
      <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px">
        © ${new Date().getFullYear()} ${escapeHtml(companyName)}. All rights reserved.
      </div>
    </div>`;
}

/** Customer email for an order moving to shipped / delivered / cancelled / refunded. */
export async function sendOrderStatusEmail(data: OrderStatusEmailData) {
  if (!data.customerEmail) return;
  const transporter = getSalesTransporter();
  if (!transporter) throw new Error("SMTP not configured — cannot send order status email");

  const company = await getCompany();
  const id = formatOrderId(data.orderId);
  const t = data.tracking;
  const hasTracking = !!(t?.courier || t?.trackingNumber || t?.trackingUrl);

  const trackingBlock = hasTracking
    ? `<div style="background:#ecfdf5;padding:16px;margin:16px 0;border-radius:8px">
         <p style="color:#065f46;font-weight:600;margin:0 0 8px">Tracking details</p>
         ${t?.courier ? `<p style="margin:4px 0">Courier: <strong>${escapeHtml(t.courier)}</strong></p>` : ""}
         ${t?.trackingNumber ? `<p style="margin:4px 0">Tracking number: <strong>${escapeHtml(t.trackingNumber)}</strong></p>` : ""}
         ${
           t?.trackingUrl && /^https:\/\//i.test(t.trackingUrl)
             ? `<p style="margin:8px 0 0"><a href="${escapeHtml(t.trackingUrl)}" style="color:#065f46;font-weight:600">Track your package →</a></p>`
             : ""
         }
       </div>`
    : "";

  const copy: Record<OrderStatusEmailType, { subject: string; heading: string; body: string }> = {
    shipped: {
      subject: `Your order ${id} has shipped`,
      heading: "Your order is on its way 🚚",
      body: `Good news — order <strong>${id}</strong> has been shipped.`,
    },
    delivered: {
      subject: `Your order ${id} was delivered`,
      heading: "Order delivered ✅",
      body: `Order <strong>${id}</strong> has been delivered. We hope you love it! If anything isn't right, just reply to this email.`,
    },
    cancelled: {
      subject: `Your order ${id} was cancelled`,
      heading: "Order cancelled",
      body: `Order <strong>${id}</strong> (₹${data.total.toFixed(2)}) has been cancelled. If you already paid, we'll process your refund and email you once it's initiated.`,
    },
    refunded: {
      subject: `Refund initiated for order ${id}`,
      heading: "Your refund is on its way 💸",
      body: `We've refunded ₹${data.total.toFixed(2)} for order <strong>${id}</strong> to your original payment method. It can take 5–7 business days to show up in your account.`,
    },
  };
  const c = copy[data.type];

  const html = emailShell(
    `<h2 style="color:#065f46;margin-top:0">${c.heading}</h2>
     <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
     <p>${c.body}</p>
     ${data.type === "shipped" ? trackingBlock : ""}
     <p style="color:#6b7280;font-size:13px">
       View your order in your <a href="${APP_BASE_URL()}/dashboard/orders" style="color:#065f46">dashboard</a>.
       Questions? Contact <a href="mailto:${escapeHtml(company.supportEmail)}" style="color:#065f46">${escapeHtml(company.supportEmail)}</a>.
     </p>`,
    company.name
  );

  await transporter.sendMail({
    from: FROM_ADDRESS_SALES,
    to: data.customerEmail,
    subject: `${c.subject} | ${company.name}`,
    html,
  });
}

// ─── Low-stock alert (to admins) ───────────────────────────────────

export async function sendLowStockAlert(
  recipients: string[],
  products: { name: string; stock: number; threshold: number }[]
) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP not configured — cannot send low-stock alert");
  const company = await getCompany();

  const rows = products
    .map(
      (p) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(p.name)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${p.stock <= 0 ? "#b91c1c" : "#b45309"}"><strong>${p.stock}</strong></td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${p.threshold}</td>
        </tr>`
    )
    .join("");

  const html = emailShell(
    `<h2 style="color:#b45309;margin-top:0">Low stock alert ⚠️</h2>
     <p>${products.length} product${products.length === 1 ? " is" : "s are"} at or below the restock level:</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0">
       <thead><tr style="background:#065f46;color:#fff">
         <th style="padding:8px;text-align:left">Product</th>
         <th style="padding:8px;text-align:center">In stock</th>
         <th style="padding:8px;text-align:center">Alert level</th>
       </tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <p><a href="${APP_BASE_URL()}/admin/products" style="color:#065f46;font-weight:600">Manage inventory →</a></p>`,
    company.name
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: recipients.join(","),
    subject: `Low stock: ${products.length} product${products.length === 1 ? "" : "s"} need restocking`,
    html,
  });
}

// ─── Abandoned checkout reminder ───────────────────────────────────

interface AbandonedCartEmailData {
  customerName: string;
  customerEmail: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  couponCode?: string;
}

export async function sendAbandonedCartEmail(data: AbandonedCartEmailData) {
  const transporter = getSalesTransporter();
  if (!transporter) throw new Error("SMTP not configured — cannot send reminder email");
  const company = await getCompany();

  const rows = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(i.name)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">₹${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const couponBlock = data.couponCode
    ? `<div style="background:#ecfdf5;padding:16px;margin:16px 0;border-radius:8px;text-align:center">
         <p style="margin:0 0 4px;color:#065f46">Use code</p>
         <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:2px;color:#065f46">${escapeHtml(data.couponCode)}</p>
         <p style="margin:4px 0 0;color:#6b7280;font-size:13px">at checkout</p>
       </div>`
    : "";

  const html = emailShell(
    `<h2 style="color:#065f46;margin-top:0">You left something behind 🛒</h2>
     <p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
     <p>You started checking out but didn't finish. Your items are still waiting:</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0">
       <thead><tr style="background:#065f46;color:#fff">
         <th style="padding:8px;text-align:left">Product</th>
         <th style="padding:8px;text-align:center">Qty</th>
         <th style="padding:8px;text-align:right">Price</th>
       </tr></thead>
       <tbody>${rows}</tbody>
     </table>
     ${couponBlock}
     <p style="text-align:center;margin:24px 0">
       <a href="${APP_BASE_URL()}/checkout" style="background:#065f46;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Complete your order</a>
     </p>
     <p style="color:#6b7280;font-size:13px">Items are not reserved and may sell out. Questions? Contact <a href="mailto:${escapeHtml(company.supportEmail)}" style="color:#065f46">${escapeHtml(company.supportEmail)}</a>.</p>`,
    company.name
  );

  await transporter.sendMail({
    from: FROM_ADDRESS_SALES,
    to: data.customerEmail,
    subject: `Still thinking it over? Your cart is waiting | ${company.name}`,
    html,
  });
}

// ─── Admin → customer message ──────────────────────────────────────

export async function sendCustomerMessage(data: {
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
}) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP not configured — cannot send email");
  const company = await getCompany();

  const html = emailShell(
    `<p>Hi <strong>${escapeHtml(data.customerName)}</strong>,</p>
     <div style="color:#374151;line-height:1.6">${escapeHtml(data.message).replace(/\r?\n/g, "<br />")}</div>
     <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
     <p style="color:#6b7280;font-size:13px">Reply to this email or contact <a href="mailto:${escapeHtml(company.supportEmail)}" style="color:#065f46">${escapeHtml(company.supportEmail)}</a>.</p>`,
    company.name
  );

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: data.customerEmail,
    subject: `${data.subject} | ${company.name}`,
    html,
  });
}
