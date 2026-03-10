import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Wellness Point account to manage orders, wishlist, and more.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
