import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Have questions about Wellness Point products? Get in touch with our support team.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
