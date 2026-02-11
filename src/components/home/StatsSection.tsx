import React from "react";
import { Users, Package, Award, ThumbsUp } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "10,000+",
    label: "Happy Customers",
    description: "Trusted across India",
  },
  {
    icon: Package,
    value: "50+",
    label: "Products",
    description: "Natural supplements",
  },
  {
    icon: Award,
    value: "100%",
    label: "Natural Ingredients",
    description: "No artificial additives",
  },
  {
    icon: ThumbsUp,
    value: "4.8/5",
    label: "Customer Rating",
    description: "Based on reviews",
  },
];

export default function StatsSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-wellness-800 via-wellness-700 to-wellness-800 dark:from-wellness-950 dark:via-wellness-900 dark:to-wellness-950 py-16">
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute left-1/4 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-40 w-40 rounded-full bg-white blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group flex flex-col items-center text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-wellness-300 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/20">
                <stat.icon className="h-8 w-8" />
              </div>
              <span className="text-3xl font-bold text-white sm:text-4xl">
                {stat.value}
              </span>
              <span className="mt-1 text-sm font-semibold uppercase tracking-wider text-wellness-200">
                {stat.label}
              </span>
              <span className="mt-1 text-xs text-wellness-300/80">
                {stat.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
