"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const faqs = [
    {
        question: "Are your products FSSAI approved?",
        answer:
            "Yes, all our products comply with FSSAI regulations and safety standards.",
    },
    {
        question: "Are the supplements lab tested?",
        answer:
            "Yes, our products undergo quality testing to ensure purity and safety.",
    },
    {
        question: "How long does shipping take?",
        answer:
            "Orders are typically delivered within 3–7 business days, depending on location.",
    },
];

export default function FAQPreview() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-14">
            <div className="container mx-auto px-4">
                <div className="mx-auto max-w-3xl">
                    {/* Header */}
                    <div className="mb-12 text-center">
                        <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
                            FAQ
                        </span>
                        <h2 className="mt-2 font-heading text-3xl font-bold text-heading sm:text-4xl">
                            Frequently Asked Questions
                        </h2>
                    </div>

                    {/* Accordion Items */}
                    <div className="space-y-3">
                        {faqs.map((faq, index) => {
                            const isOpen = openIndex === index;
                            return (
                                <div
                                    key={index}
                                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <button
                                        onClick={() =>
                                            setOpenIndex(isOpen ? null : index)
                                        }
                                        className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-wellness-50/50 sm:px-6 sm:py-5"
                                    >
                                        <span className="pr-4 font-heading text-base font-semibold text-heading">
                                            {faq.question}
                                        </span>
                                        <ChevronDown
                                            className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                                                }`}
                                        />
                                    </button>
                                    <div
                                        className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-60" : "max-h-0"
                                            }`}
                                    >
                                        <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-5">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* View All CTA */}
                    <div className="mt-8 text-center">
                        <Button
                            variant="outline"
                            asChild
                            className="border-wellness-300 text-wellness-700 hover:bg-wellness-50"
                        >
                            <Link href="/faq" className="flex items-center gap-2">
                                View All FAQs
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
