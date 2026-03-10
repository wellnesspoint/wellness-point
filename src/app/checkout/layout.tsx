import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Wellness Point order securely.",
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
