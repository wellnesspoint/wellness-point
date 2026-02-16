import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Read the Wellness Point terms and conditions governing the use of our website and services.",
};

export default function TermsPage() {
  return (
    <div className="py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-8 font-heading text-4xl font-bold text-foreground">
          Terms &amp; Conditions
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Last updated: February 12, 2026
        </p>

        <div className="prose max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using the Wellness Point website, you agree to be
              bound by these Terms and Conditions. If you do not agree with any
              part of these terms, please do not use our website.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              2. Products &amp; Pricing
            </h2>
            <p>
              All product descriptions, images, and prices are subject to change
              without notice. We strive to display accurate information but do not
              warrant that product descriptions are error-free. Prices are listed
              in INR and include applicable taxes unless stated otherwise.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              3. Orders &amp; Payments
            </h2>
            <p>
              All orders are subject to availability and confirmation. We accept
              payment through Razorpay. Cash on Delivery is not available. Once
              payment is processed, you will receive an order confirmation via
              email.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              4. Shipping &amp; Delivery
            </h2>
            <p>
              We offer free shipping on orders above ₹999 within India. Delivery
              typically takes 5-7 business days. We are not responsible for
              delays caused by courier services or unforeseen circumstances.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              5. Returns, Refunds &amp; Exchanges
            </h2>
            <p>
              All sales are final. We do not offer refunds, exchanges, or
              replacements on any orders. Please review your order carefully
              before completing your purchase. Cash on Delivery (COD) is not
              available.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              6. Intellectual Property
            </h2>
            <p>
              All content on this website, including text, images, logos, and
              graphics, is the property of Wellness Point and is protected by
              intellectual property laws. Unauthorized use is prohibited.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              7. Limitation of Liability
            </h2>
            <p>
              Wellness Point shall not be liable for any direct, indirect,
              incidental, or consequential damages arising out of the use of our
              products or website. Our supplements are not intended to diagnose,
              treat, cure, or prevent any disease.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              8. Contact
            </h2>
            <p>
              For questions about these Terms &amp; Conditions, contact us at:
            </p>
            <p>
              <strong>Email:</strong> support@wellness-point.in
              <br />
              <strong>Phone:</strong> +91 87724 85312
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
