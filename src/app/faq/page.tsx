import React from "react";
import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_DATA } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to common questions about Wellness Point products, shipping, returns, and more.",
};

export default function FAQPage() {
  return (
    <div className="gradient-wellness py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600 dark:text-wellness-400">
            Support
          </span>
          <h1 className="mt-2 font-heading text-4xl font-bold text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Everything you need to know about our products and services.
          </p>
        </div>

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_DATA.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-lg border border-border bg-card px-6 mb-3 shadow-sm"
              >
                <AccordionTrigger className="text-left font-medium text-card-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 rounded-2xl bg-wellness-50 dark:bg-wellness-950/30 p-8 text-center">
            <h2 className="mb-2 font-heading text-xl font-semibold text-foreground">
              Still have questions?
            </h2>
            <p className="mb-4 text-muted-foreground">
              Can&apos;t find the answer you&apos;re looking for? Reach out to
              our support team.
            </p>
            <a
              href="/contact"
              className="inline-flex items-center rounded-lg bg-wellness-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-wellness-700"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
