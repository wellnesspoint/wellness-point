// Shown when a product's image URL fails to load (e.g. a dead hotlinked
// third-party URL) instead of the browser's default broken-image icon.
// An inline SVG data URI needs no extra asset file or network request.
export const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f0f4f1"/>
      <g fill="none" stroke="#c3d3c8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="90" y="110" width="220" height="180" rx="12"/>
        <circle cx="150" cy="165" r="18"/>
        <path d="M90 250l60-60 40 40 60-70 60 80"/>
      </g>
    </svg>`
  );

export const SITE_CONFIG = {
  name: "Wellness Point",
  description:
    "Premium food supplements for whole-body wellness. Natural ingredients, scientifically formulated for your health journey.",
  tagline: "Nourish Your Body, Elevate Your Life",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://wellness-point.in",
  ogImage: "/images/og-image.jpg",
  keywords: [
    "wellness supplements",
    "food supplements",
    "health supplements",
    "natural supplements",
    "body wellness",
    "nutrition",
    "vitamins",
    "wellness point",
  ],
};

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "About", href: "/about" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
];

export const FOOTER_LINKS = {
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "/faq" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Returns & Refund Policy", href: "/returns-refund-policy" },
    { label: "Shipping Policy", href: "/shipping-policy" },
    { label: "Disclaimer", href: "/disclaimer" },
    { label: "Data Deletion", href: "/data-deletion" },
  ],
  account: [
    { label: "My Account", href: "/dashboard" },
    { label: "Order History", href: "/dashboard/orders" },
    { label: "Wishlist", href: "/dashboard/wishlist" },
  ],
};

export const BENEFITS = [
  {
    title: "100% Natural",
    description: "Made with carefully selected natural ingredients",
    icon: "Leaf",
  },
  {
    title: "Lab Tested",
    description: "Every batch tested for purity and potency",
    icon: "FlaskConical",
  },
  {
    title: "No Side Effects",
    description: "Safe formulations backed by science",
    icon: "ShieldCheck",
  },
  {
    title: "Fast Delivery",
    description: "Free shipping on all orders across India",
    icon: "Truck",
  },
];

export const FAQ_DATA = [
  {
    question: "What makes Wellness Point supplements different?",
    answer:
      "Our supplements are made with 100% natural ingredients, scientifically formulated, and lab-tested for quality and efficacy. We prioritize purity and transparency in every product.",
  },
  {
    question: "Are your products safe for daily use?",
    answer:
      "Yes, all our products are designed for daily consumption and are free from harmful chemicals, artificial colors, and preservatives. However, we always recommend consulting your healthcare provider if you have specific medical conditions.",
  },
  {
    question: "How long before I see results?",
    answer:
      "Results vary by individual, but most customers report noticeable improvements within 2-4 weeks of consistent daily use. We recommend a minimum of 30 days for optimal results.",
  },
  {
    question: "What is your return and refund policy?",
    answer:
      "All sales are final. We do not offer refunds, exchanges, or replacements on any orders. Please review your order carefully before completing your purchase. Cash on Delivery (COD) is not available — all orders must be prepaid online.",
  },
  {
    question: "Do you offer international shipping?",
    answer:
      "Currently, we ship across India with free delivery on all orders. International shipping is coming soon. Sign up for our newsletter to be the first to know.",
  },
  {
    question: "Are your products vegetarian/vegan?",
    answer:
      "Yes, all our products are 100% vegetarian. We use plant-based capsules and natural ingredients. Check individual product pages for specific dietary information.",
  },
];
