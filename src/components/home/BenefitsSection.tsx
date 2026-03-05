import React from "react";
import { Award, FlaskConical, Eye } from "lucide-react";

const benefits = [
  {
    icon: Award,
    title: "Quality First",
    description:
      "Every product is carefully formulated and tested to ensure purity and effectiveness.",
  },
  {
    icon: FlaskConical,
    title: "Science-Backed Formulas",
    description:
      "We focus on evidence-based ingredients that support real wellness goals.",
  },
  {
    icon: Eye,
    title: "Transparent & Trusted",
    description:
      "Clear labeling, honest claims, and a commitment to your health.",
  },
];

export default function BenefitsSection() {
  return (
    <section className="bg-gradient-to-b from-wellness-50/50 to-white py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-10 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Why Us
          </span>
          <h2 className="mt-2 font-heading text-3xl font-bold text-heading sm:text-4xl">
            Why Choose Wellness Point?
          </h2>
        </div>

        {/* Cards */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Top accent bar */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-wellness-400 via-wellness-600 to-accent-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-wellness-100 text-wellness-600 transition-all duration-300 group-hover:bg-wellness-600 group-hover:text-white group-hover:shadow-lg">
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mb-3 font-heading text-xl font-semibold text-heading">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
