import React from "react";
import { Search, ShoppingCart, Truck, Heart } from "lucide-react";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Browse Products",
    description:
      "Explore our wide range of natural supplements and find what suits your wellness goals.",
  },
  {
    icon: ShoppingCart,
    step: "02",
    title: "Add to Cart",
    description:
      "Select the products you love and add them to your cart with just a click.",
  },
  {
    icon: Truck,
    step: "03",
    title: "Fast Delivery",
    description:
      "We ship your order quickly and securely to your doorstep across India.",
  },
  {
    icon: Heart,
    step: "04",
    title: "Feel the Difference",
    description:
      "Experience improved wellness with our premium, lab-tested natural supplements.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
            Simple Process
          </span>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Getting started with Wellness Point is easy. Follow these simple
            steps to begin your wellness journey.
          </p>
        </div>

        <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connecting line (hidden on mobile) */}
          <div className="absolute left-0 right-0 top-16 hidden h-0.5 bg-gradient-to-r from-transparent via-wellness-200 to-transparent lg:block" />

          {steps.map((item, index) => (
            <div key={index} className="relative flex flex-col items-center text-center">
              {/* Step number badge */}
              <div className="relative z-10 mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wellness-100 text-wellness-700 shadow-sm transition-all duration-300 hover:scale-110 hover:shadow-md">
                  <item.icon className="h-7 w-7" />
                </div>
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-wellness-600 text-xs font-bold text-white shadow-sm">
                  {item.step}
                </span>
              </div>

              <h3 className="mb-2 font-heading text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
