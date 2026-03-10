import React from "react";
import type { Metadata } from "next";
import { Star, Quote } from "lucide-react";
import connectDB from "@/lib/db";
import Testimonial from "@/models/Testimonial";

export const metadata: Metadata = {
  title: "Testimonials",
  description:
    "Real stories from real people who transformed their wellness journey with Wellness Point products.",
};

export default async function TestimonialsPage() {
  await connectDB();
  const testimonials = await Testimonial.find({ isApproved: true })
    .select("name role content rating")
    .sort({ createdAt: -1 })
    .lean();

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

        {testimonials.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={String(t._id)}
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
