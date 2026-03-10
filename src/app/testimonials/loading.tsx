import { Skeleton } from "@/components/ui/skeleton";

export default function TestimonialsLoading() {
  return (
    <div className="gradient-wellness py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <Skeleton className="mx-auto h-5 w-32" />
          <Skeleton className="mx-auto mt-2 h-10 w-64" />
          <Skeleton className="mx-auto mt-3 h-5 w-80" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6">
              <Skeleton className="mb-4 h-4 w-24" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-5/6" />
              <Skeleton className="mt-4 h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
