import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed",
  description: "You have been unsubscribed from the Wellness Point newsletter.",
};

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let heading = "Unsubscribed Successfully";
  let message =
    "You have been removed from our newsletter mailing list. You will no longer receive promotional emails from Wellness Point.";

  if (status === "invalid") {
    heading = "Invalid Unsubscribe Link";
    message =
      "This unsubscribe link is invalid or incomplete. Please use the link from the bottom of a recent newsletter email, or contact support and we'll remove you manually.";
  } else if (status === "not-found") {
    heading = "Already Unsubscribed";
    message = "We couldn't find this email address on our mailing list.";
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="text-center">
        <h1 className="mb-4 font-heading text-3xl font-bold text-foreground">
          {heading}
        </h1>
        <p className="mb-6 max-w-md text-muted-foreground">{message}</p>
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
