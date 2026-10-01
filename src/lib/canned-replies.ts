/**
 * Quick-insert reply templates for the Contact and Reviews admin pages.
 * `{name}` is replaced with the customer's first name. Edit freely — they are
 * only starting points; the admin can change the text before sending.
 */
export interface CannedReply {
  label: string;
  text: string;
}

export const CONTACT_REPLIES: CannedReply[] = [
  {
    label: "Order status",
    text: "Hi {name},\n\nThanks for reaching out. Your order is being processed and you'll receive a shipping confirmation email with tracking details as soon as it's dispatched (usually within 2-3 business days).\n\nLet us know if there's anything else we can help with.",
  },
  {
    label: "Delivery delay",
    text: "Hi {name},\n\nWe're sorry for the delay with your delivery. We've flagged it with our courier partner and will update you as soon as we have news. Thank you for your patience.",
  },
  {
    label: "Product question",
    text: "Hi {name},\n\nThanks for your interest in our products. All of our supplements are lab tested and made with clean ingredients. Please see the product page for the full ingredient list and usage directions; if you have a specific health condition, we recommend checking with your doctor before starting any supplement.",
  },
  {
    label: "Returns & refunds",
    text: "Hi {name},\n\nThanks for getting in touch. Please review our Returns & Refund Policy on the website for eligibility. If your order arrived damaged or incorrect, reply with your order ID and a photo and we'll make it right.",
  },
  {
    label: "Thank you",
    text: "Hi {name},\n\nThank you for contacting Wellness Point. We appreciate your message and will be glad to help whenever you need us.",
  },
];

export const REVIEW_REPLIES: CannedReply[] = [
  {
    label: "Thank you (positive)",
    text: "Thank you so much for the kind words, {name}! We're delighted you're enjoying it and appreciate you taking the time to review.",
  },
  {
    label: "Sorry (negative)",
    text: "We're sorry this didn't meet your expectations, {name}. Please email us with your order ID so we can look into it and put things right.",
  },
  {
    label: "Usage tip",
    text: "Thanks for the feedback, {name}! For best results we recommend following the usage directions on the label and staying consistent for a few weeks.",
  },
];

export function fillReply(template: string, fullName?: string): string {
  const first = (fullName || "").trim().split(/\s+/)[0] || "there";
  return template.replace(/\{name\}/g, first);
}
