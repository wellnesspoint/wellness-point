"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-red-50 p-4 mb-6">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Something went wrong
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        An unexpected error occurred. Please try again or return to the homepage.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/">
          <Button variant="wellness" className="gap-2">
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
