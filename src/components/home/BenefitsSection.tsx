import React from "react";
import { Leaf, FlaskConical, ShieldCheck, Truck } from "lucide-react";
import { BENEFITS } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  Leaf,
  FlaskConical,
  ShieldCheck,
  Truck,
};

export default function BenefitsSection() {
  return (
    <section className="bg-gradient-to-b from-wellness-50 to-white dark:from-wellness-950/30 dark:to-background py-20">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600 dark:text-wellness-400">
            Why Choose Us
          </span>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            The Wellness Point Difference
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            We go above and beyond to deliver supplements that truly make a
            difference in your health.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, index) => {
            const Icon = iconMap[benefit.icon] || Leaf;
            return (
              <div
                key={index}
                className="group rounded-2xl bg-card p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg border border-border"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wellness-100 dark:bg-wellness-900/50 text-wellness-600 dark:text-wellness-400 transition-colors group-hover:bg-wellness-600 group-hover:text-white dark:group-hover:bg-wellness-500">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
