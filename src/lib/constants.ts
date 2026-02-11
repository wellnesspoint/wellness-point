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
      "We offer a 30-day satisfaction guarantee. If you're not happy with your purchase, contact us within 30 days of delivery for a full refund or exchange.",
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
