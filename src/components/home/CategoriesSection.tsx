import React from "react";
import Link from "next/link";
import {
  Pill,
  Apple,
  Droplets,
  Dumbbell,
  Brain,
  HeartPulse,
} from "lucide-react";

const categories = [
  {
    icon: Pill,
    title: "Vitamins & Minerals",
    description: "Essential daily nutrients for overall health",
    color: "from-teal-500 to-emerald-600",
  },
  {
    icon: Apple,
    title: "Immunity Boosters",
    description: "Strengthen your body's natural defenses",
    color: "from-green-500 to-teal-600",
  },
  {
    icon: Droplets,
    title: "Herbal Extracts",
    description: "Traditional Ayurvedic formulations",
    color: "from-emerald-500 to-green-600",
  },
  {
    icon: Dumbbell,
    title: "Sports Nutrition",
    description: "Fuel your active lifestyle",
    color: "from-cyan-500 to-teal-600",
  },
  {
    icon: Brain,
    title: "Brain Health",
    description: "Cognitive support & mental clarity",
    color: "from-teal-600 to-cyan-600",
  },
  {
    icon: HeartPulse,
    title: "Heart Health",
    description: "Cardiovascular wellness support",
    color: "from-emerald-600 to-teal-600",
  },
];

export default function CategoriesSection() {
  return (
    <section className="bg-gradient-to-b from-background to-wellness-50/50 py-20">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Categories
          </span>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Shop by Category
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Find the right supplements for your specific health needs. Browse
            our curated categories.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat, index) => (
            <Link
              key={index}
              href="/shop"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat.color} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
                >
                  <cat.icon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-card-foreground group-hover:text-wellness-600 transition-colors">
                    {cat.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
              </div>
              {/* Hover arrow indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/0 transition-all duration-300 group-hover:text-wellness-500 group-hover:translate-x-0 -translate-x-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
