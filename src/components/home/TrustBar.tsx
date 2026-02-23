import React from "react";
import { ShieldCheck, FlaskConical, MapPin, Lock } from "lucide-react";

const trustItems = [
    { icon: ShieldCheck, text: "FSSAI Approved" },
    { icon: FlaskConical, text: "Lab Tested for Purity" },
    { icon: MapPin, text: "Made in India" },
    { icon: Lock, text: "Secure Razorpay Payments" },
];

export default function TrustBar() {
    // Double the items for seamless infinite scroll
    const doubled = [...trustItems, ...trustItems, ...trustItems, ...trustItems];

    return (
        <section className="overflow-hidden border-y border-wellness-100 bg-wellness-50/50">
            <div
                className="flex animate-marquee items-center gap-12 py-3.5 whitespace-nowrap"
                style={{ width: "max-content" }}
            >
                {doubled.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-2">
                        <item.icon className="h-4.5 w-4.5 shrink-0 text-accent-500" />
                        <span className="text-sm font-medium text-wellness-800">
                            {item.text}
                        </span>
                        {i < doubled.length - 1 && (
                            <span className="ml-10 text-wellness-300">•</span>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
