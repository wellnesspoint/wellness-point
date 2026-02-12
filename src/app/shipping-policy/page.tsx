import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "Learn about Wellness Point's shipping policy including delivery timelines, charges, and tracking information.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-8 font-heading text-4xl font-bold text-foreground">
          Shipping Policy
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Last updated: February 12, 2026
        </p>

        <div className="prose max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              1. Shipping Coverage
            </h2>
            <p>
              We currently ship to all major cities and towns across India. If your
              location is serviceable, you will see the estimated delivery date at
              checkout. For remote areas, deliveries may take a few additional days.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              2. Delivery Timelines
            </h2>
            <p>
              Standard delivery typically takes 5–7 business days from the date of
              order confirmation. Orders placed on weekends or public holidays will
              be processed on the next business day.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Metro cities: 3–5 business days</li>
              <li>Tier 2 & Tier 3 cities: 5–7 business days</li>
              <li>Remote areas: 7–10 business days</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              3. Shipping Charges
            </h2>
            <p>
              We offer <strong>free shipping</strong> on all orders above ₹999.
              For orders below ₹999, a flat shipping fee of ₹99 will be applied
              at checkout.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              4. Order Tracking
            </h2>
            <p>
              Once your order is shipped, you will receive a tracking number via
              email and SMS. You can use this tracking number on our courier
              partner&apos;s website to track your order in real time. You can also
              check your order status from your account dashboard.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              5. Delayed or Missing Shipments
            </h2>
            <p>
              If your order has not been delivered within the estimated delivery
              window, please contact our support team at{" "}
              <a
                href="mailto:hello@wellness-point.in"
                className="text-wellness-600 hover:underline"
              >
                hello@wellness-point.in
              </a>{" "}
              or call us at{" "}
              <a
                href="tel:+918772485312"
                className="text-wellness-600 hover:underline"
              >
                +91 87724 85312
              </a>
              . We will investigate the matter and ensure timely resolution.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              6. No Refund, No Exchange, No Replacement
            </h2>
            <p>
              All sales are final. We do not offer refunds, exchanges, or
              replacements on any orders. Please ensure you review your order
              carefully before completing your purchase. Cash on Delivery (COD)
              is not available — all orders must be prepaid online.
            </p>
            <p className="mt-2">
              If you receive a damaged product due to transit, please contact us
              within 48 hours of delivery with photographs of the product and
              packaging for assistance.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              7. Contact Us
            </h2>
            <p>
              For any shipping-related queries, reach out to us:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Email:{" "}
                <a
                  href="mailto:hello@wellness-point.in"
                  className="text-wellness-600 hover:underline"
                >
                  hello@wellness-point.in
                </a>
              </li>
              <li>
                Phone:{" "}
                <a
                  href="tel:+918772485312"
                  className="text-wellness-600 hover:underline"
                >
                  +91 87724 85312
                </a>
              </li>
              <li>Address: Bengaluru, Karnataka, India</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
