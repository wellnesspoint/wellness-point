"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, ShoppingBag } from "lucide-react";
import Link from "next/link";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Checkout error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center px-4">
      <div className="rounded-full bg-red-50 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Checkout Error
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Something went wrong during checkout. Your payment has not been processed. Please try again.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" size="sm" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/shop">
          <Button variant="wellness" size="sm" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}
