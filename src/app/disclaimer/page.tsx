import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Read the Wellness Point disclaimer regarding product information, health advice, and liability.",
};

export default function DisclaimerPage() {
  return (
    <div className="py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-8 font-heading text-4xl font-bold text-foreground">
          Disclaimer
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Last updated: February 12, 2026
        </p>

        <div className="prose max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              1. General Information
            </h2>
            <p>
              The information provided on the Wellness Point website
              (wellness-point.in) is for general informational purposes only. While
              we make every effort to keep the information up to date and accurate,
              we make no representations or warranties of any kind, express or
              implied, about the completeness, accuracy, reliability, or
              availability of the website or the information, products, or services
              contained therein.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              2. Not Medical Advice
            </h2>
            <p>
              The content on this website, including product descriptions,
              ingredients, and benefits, is not intended to be a substitute for
              professional medical advice, diagnosis, or treatment. Always seek the
              advice of your physician or other qualified health provider with any
              questions you may have regarding a medical condition or before
              starting any new supplement, diet, or wellness program.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              3. Product Results
            </h2>
            <p>
              Individual results from the use of our products may vary. The
              testimonials and reviews on this website reflect the personal
              experiences of individual users and are not to be construed as a
              guarantee or claim that all users will achieve the same results.
              Factors such as age, health condition, lifestyle, and consistency of
              use can affect outcomes.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              4. External Links
            </h2>
            <p>
              Our website may contain links to external websites that are not
              operated by us. We have no control over the content and practices of
              these sites and cannot accept responsibility or liability for their
              respective privacy policies or content.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              5. Limitation of Liability
            </h2>
            <p>
              In no event shall Wellness Point, its directors, employees, or
              affiliates be liable for any indirect, incidental, special,
              consequential, or punitive damages arising out of or in connection
              with your use of the website or products purchased through it. Our
              total liability shall not exceed the amount paid by you for the
              specific product giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              6. Product Availability & Pricing
            </h2>
            <p>
              We reserve the right to modify product pricing, availability, and
              descriptions at any time without prior notice. While we strive to
              display accurate product images and colors, actual products may vary
              slightly due to photography and screen differences.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              7. Allergies & Sensitivities
            </h2>
            <p>
              Please review the full list of ingredients before using any of our
              products. If you have known allergies, sensitivities, or are pregnant
              or nursing, consult your healthcare provider before use. Discontinue
              use immediately if you experience any adverse reactions.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              8. Changes to This Disclaimer
            </h2>
            <p>
              We reserve the right to update or modify this disclaimer at any time.
              Any changes will be posted on this page with an updated revision
              date. Your continued use of the website following any changes
              constitutes acceptance of the revised disclaimer.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              9. Contact Us
            </h2>
            <p>
              If you have any questions about this disclaimer, please contact us:
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
