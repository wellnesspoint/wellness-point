import React from "react";
import { Leaf, Pill, Heart } from "lucide-react";

const ingredients = [
    {
        icon: Leaf,
        name: "Ashwagandha Extract",
        description: "Supports stress management and overall vitality.",
        color: "bg-wellness-100 text-wellness-700",
    },
    {
        icon: Pill,
        name: "Multivitamin Complex",
        description: "Essential nutrients to support daily energy and immunity.",
        color: "bg-wellness-50 text-wellness-600",
    },
    {
        icon: Heart,
        name: "Omega Blend",
        description: "Supports heart and brain health.",
        color: "bg-wellness-50 text-wellness-600",
    },
];

export default function IngredientSpotlight() {
    return (
        <section className="py-20">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-14 text-center">
                    <span className="text-sm font-semibold uppercase tracking-wider text-wellness-600">
                        What&apos;s Inside
                    </span>
                    <h2 className="mt-2 font-heading text-3xl font-bold text-heading sm:text-4xl">
                        Powered by Quality Ingredients
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                        We select ingredients backed by research and sourced with care —
                        because what you put into your body matters.
                    </p>
                </div>

                {/* Ingredient Cards */}
                <div className="grid gap-8 sm:grid-cols-3">
                    {ingredients.map((item, index) => (
                        <div
                            key={index}
                            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                        >
                            {/* Subtle gradient overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-wellness-50/0 to-wellness-50/0 transition-all duration-300 group-hover:from-wellness-50/50 group-hover:to-wellness-50/30" />

                            <div className="relative">
                                <div
                                    className={`mb-5 flex h-14 w-14 items-center justify-center rounded-xl ${item.color} transition-transform duration-300 group-hover:scale-110`}
                                >
                                    <item.icon className="h-7 w-7" />
                                </div>
                                <h3 className="mb-2 font-heading text-xl font-semibold text-heading">
                                    {item.name}
                                </h3>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
