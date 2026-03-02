"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-red-50 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        An error occurred while loading this page. Try again or go back to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline" size="sm" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Retry
        </Button>
        <Link href="/admin">
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
