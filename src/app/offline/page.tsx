import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

/** Shown by the service worker (public/sw.js) when a page cannot be loaded because there is no connection. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">You&apos;re offline</h1>
        <p className="mt-3 text-muted-foreground">
          We can&apos;t reach the store right now. Check your internet connection and try again. Your cart is saved on
          this device.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-wellness-600 px-6 text-sm font-medium text-white hover:bg-wellness-700"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
