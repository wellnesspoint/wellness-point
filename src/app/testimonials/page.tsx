"use client";

import React, { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTestimonials() {
      try {
        const res = await fetch("/api/testimonials");
        const data = await res.json();
        setTestimonials(data.testimonials || []);
      } catch {
        setTestimonials([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTestimonials();
  }, []);

  return (
    <div className="gradient-wellness py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Customer Love
          </span>
          <h1 className="mt-2 font-heading text-4xl font-bold text-foreground">
            What Our Customers Say
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Real stories from real people who transformed their wellness journey
            with our products.
          </p>
        </div>

        {loading ? (
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
        ) : testimonials.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t._id}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <Quote className="absolute right-4 top-4 h-8 w-8 text-wellness-100" />
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < t.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{t.content}&rdquo;
                </p>
                <div>
                  <p className="font-semibold text-card-foreground">{t.name}</p>
                  {t.role && <p className="text-xs text-muted-foreground">{t.role}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-16 text-center">
            <p className="text-muted-foreground">Testimonials coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
