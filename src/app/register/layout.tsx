import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a Wellness Point account to start shopping for natural wellness products.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
