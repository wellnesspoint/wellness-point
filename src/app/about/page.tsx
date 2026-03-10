import React from "react";
import { Heart, Award, Users, Target } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Wellness Point — our mission, values, and commitment to your health.",
};

export default function AboutPage() {
  return (
    <div className="gradient-wellness">
      {/* Hero */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Our Story
          </span>
          <h1 className="mt-2 font-heading text-4xl font-bold text-foreground sm:text-5xl">
            About Wellness Point
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            We believe that wellness begins with what you put into your body. Our
            mission is to make premium, natural supplements accessible to
            everyone.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="font-heading text-3xl font-bold text-foreground">
              Our Mission
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Wellness Point was born from a simple belief: everyone deserves
              access to high-quality, science-backed nutritional supplements
              that actually work. We combine nature&apos;s finest ingredients
              with modern science to create products that support your health
              from the inside out.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Every product we create goes through rigorous testing and quality
              checks. We source only the purest ingredients, ensure ethical
              manufacturing, and maintain complete transparency about what goes
              into each supplement.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center font-heading text-3xl font-bold text-foreground">
            Our Core Values
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Heart,
                title: "Health First",
                desc: "Every decision we make prioritizes your health and wellbeing above all else.",
              },
              {
                icon: Award,
                title: "Quality Always",
                desc: "Lab-tested, certified ingredients — no compromises on quality, ever.",
              },
              {
                icon: Users,
                title: "Community",
                desc: "We're building a wellness community, not just selling products.",
              },
              {
                icon: Target,
                title: "Transparency",
                desc: "Full ingredient disclosure, honest marketing, and real results.",
              },
            ].map((value, i) => (
              <div
                key={i}
                className="rounded-2xl bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md border border-border"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-wellness-100 text-wellness-600">
                  <value.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                  {value.title}
                </h3>
                <p className="text-sm text-muted-foreground">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-wellness-600 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
            {[
              { number: "10K+", label: "Happy Customers" },
              { number: "100%", label: "Natural Ingredients" },
              { number: "3+", label: "Premium Products" },
              { number: "100%", label: "Prepaid & Secure" },
            ].map((stat, i) => (
              <div key={i}>
                <p className="font-heading text-4xl font-bold text-white">
                  {stat.number}
                </p>
                <p className="mt-1 text-wellness-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
