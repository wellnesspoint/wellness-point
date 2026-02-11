import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-2 text-7xl font-bold text-wellness-600">404</h1>
      <h2 className="mb-3 text-2xl font-semibold text-foreground">
        Page Not Found
      </h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="wellness">Back to Home</Button>
      </Link>
    </div>
  );
}
