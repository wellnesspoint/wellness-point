import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Returns & Refund Policy",
  description: "Read the Wellness Point returns and refund policy. Understand our no refund, no exchange, and no COD policy.",
};

export default function ReturnsRefundPolicyPage() {
  return (
    <div className="py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-8 font-heading text-4xl font-bold text-foreground">
          Returns &amp; Refund Policy
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Last updated: February 13, 2026
        </p>

        <div className="prose max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              1. All Sales Are Final
            </h2>
            <p>
              At Wellness Point, all purchases are considered final and
              non-refundable. Once an order has been placed and payment has been
              processed, it cannot be cancelled, returned, or refunded under any
              circumstances. We encourage all customers to review their order
              carefully before completing a purchase.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              2. No Cash on Delivery (COD)
            </h2>
            <p>
              We do not offer Cash on Delivery as a payment option. All orders
              must be prepaid through our secure online payment gateway (powered
              by Razorpay). We accept all major credit cards, debit cards, UPI,
              net banking, and popular wallets.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              3. No Exchange or Replacement
            </h2>
            <p>
              We do not offer exchanges or replacements on any products. Since
              our products are wellness and health supplements, for hygiene and
              safety reasons, we are unable to accept returns or process
              exchanges once the product has been dispatched.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              4. No Refund
            </h2>
            <p>
              Refunds will not be issued for any orders, regardless of the
              reason. This includes but is not limited to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Change of mind after placing an order</li>
              <li>Incorrect product selected by the customer</li>
              <li>Dissatisfaction with product results (individual results may vary)</li>
              <li>Failure to read product descriptions or ingredients before purchase</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              5. Damaged Products During Transit
            </h2>
            <p>
              If you receive a product that is damaged during transit, please
              contact us within <strong>48 hours</strong> of delivery with clear
              photographs of:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The damaged product</li>
              <li>The packaging (inner and outer)</li>
              <li>The shipping label</li>
            </ul>
            <p className="mt-2">
              Our team will review your case and determine the appropriate course
              of action on a case-by-case basis. Please note that this does not
              guarantee a refund or replacement — it is subject to our internal
              review process.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              6. Order Cancellation
            </h2>
            <p>
              Once an order is placed and payment is confirmed, it cannot be
              cancelled. Our fulfillment process begins immediately after payment
              confirmation to ensure fast delivery.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              7. Why We Have This Policy
            </h2>
            <p>
              As a wellness and health supplement brand, our products are
              manufactured and packaged with strict quality control measures. Due
              to the nature of consumable health products, we cannot accept
              returns to ensure the safety and integrity of our products for all
              customers.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              8. Contact Us
            </h2>
            <p>
              If you have any questions about this policy or need assistance with
              a damaged product claim, please reach out to us:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Email:{" "}
                <a
                  href="mailto:support@wellness-point.in"
                  className="text-wellness-600 hover:underline"
                >
                  support@wellness-point.in
                </a>
              </li>
              <li>
                Phone:{" "}
                <a
                  href="tel:+918722485312"
                  className="text-wellness-600 hover:underline"
                >
                  +91 87224 85312
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
