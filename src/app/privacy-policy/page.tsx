import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read the Wellness Point privacy policy to understand how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-8 font-heading text-4xl font-bold text-foreground">
          Privacy Policy
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Last updated: February 12, 2026
        </p>

        <div className="prose max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide directly to us, such as when you
              create an account, make a purchase, subscribe to our newsletter, or
              contact us. This may include your name, email address, phone
              number, shipping address, and payment information.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              2. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process your orders and payments</li>
              <li>Send order confirmations and updates</li>
              <li>Manage your account</li>
              <li>Send promotional emails (with your consent)</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              3. Data Security
            </h2>
            <p>
              We implement appropriate technical and organizational measures to
              protect your personal data against unauthorized access, alteration,
              disclosure, or destruction. Payment information is processed
              securely through Razorpay and is never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              4. Cookies
            </h2>
            <p>
              We use cookies and similar tracking technologies to enhance your
              browsing experience, analyze site traffic, and personalize content.
              You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              5. Third-Party Services
            </h2>
            <p>
              We may share your information with trusted third-party services
              for payment processing (Razorpay), analytics, and email delivery.
              These services have their own privacy policies and handle your
              data in accordance with applicable laws.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              6. Your Rights
            </h2>
            <p>
              You have the right to access, correct, or delete your personal
              data. You can also opt out of marketing communications at any
              time. Contact us at support@wellness-point.in for any privacy-related
              requests.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              7. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy, please contact us
              at:
            </p>
            <p>
              <strong>Email:</strong> support@wellness-point.in
              <br />
              <strong>Phone:</strong> +91 87224 85312
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
