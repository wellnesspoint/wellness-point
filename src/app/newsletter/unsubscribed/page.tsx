import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed",
  description: "You have been unsubscribed from the Wellness Point newsletter.",
};

export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="text-center">
        <h1 className="mb-4 font-heading text-3xl font-bold text-foreground">
          Unsubscribed Successfully
        </h1>
        <p className="mb-6 text-muted-foreground">
          You have been removed from our newsletter mailing list. You will no
          longer receive promotional emails from Wellness Point.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg bg-wellness-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-wellness-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
