import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion",
  description:
    "Learn how to request deletion of your data collected through Facebook Login on Wellness Point.",
};

export default function DataDeletionPage() {
  return (
    <div className="py-16">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-8 font-heading text-4xl font-bold text-foreground">
          Data Deletion Instructions
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Last updated: March 6, 2026
        </p>

        <div className="prose max-w-none space-y-8 text-muted-foreground">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              1. Overview
            </h2>
            <p>
              If you signed in to Wellness Point using your Facebook account, we
              may have received basic profile information (such as your name,
              email address, and profile picture) from Facebook. You have the
              right to request the deletion of this data at any time.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              2. What Data We Collect via Facebook Login
            </h2>
            <p>
              When you use Facebook Login, we collect the following information
              from your Facebook profile:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your name</li>
              <li>Your email address</li>
              <li>Your profile picture URL</li>
            </ul>
            <p className="mt-2">
              This information is used solely to create and manage your Wellness
              Point account. We do not share this data with third parties.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              3. How to Request Data Deletion
            </h2>
            <p>
              You can request deletion of your data in any of the following ways:
            </p>

            <h3 className="mt-4 font-heading text-lg font-medium text-foreground">
              Option A: Email Us
            </h3>
            <p>
              Send an email to{" "}
              <a
                href="mailto:support@wellness-point.in"
                className="text-wellness-600 underline hover:text-wellness-700"
              >
                support@wellness-point.in
              </a>{" "}
              with the subject line <strong>&quot;Data Deletion Request&quot;</strong>.
              Please include the email address associated with your account so we
              can identify your data.
            </p>

            <h3 className="mt-4 font-heading text-lg font-medium text-foreground">
              Option B: Remove via Facebook Settings
            </h3>
            <p>
              You can remove the Wellness Point app from your Facebook account
              directly:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Go to your{" "}
                <a
                  href="https://www.facebook.com/settings?tab=applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-wellness-600 underline hover:text-wellness-700"
                >
                  Facebook App Settings
                </a>
              </li>
              <li>Find &quot;Wellness Point&quot; in the list of apps</li>
              <li>Click &quot;Remove&quot; to revoke access</li>
              <li>
                After removing, contact us at{" "}
                <a
                  href="mailto:support@wellness-point.in"
                  className="text-wellness-600 underline hover:text-wellness-700"
                >
                  support@wellness-point.in
                </a>{" "}
                to confirm deletion of your stored data
              </li>
            </ol>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              4. What Happens After a Deletion Request
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                We will verify your identity and process the request within{" "}
                <strong>7 business days</strong>.
              </li>
              <li>
                All personal data associated with your Facebook Login will be
                permanently deleted from our systems.
              </li>
              <li>
                Order history and transaction records may be retained as required
                by Indian tax and accounting regulations.
              </li>
              <li>
                You will receive a confirmation email once the deletion is
                complete.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              5. Data Retention
            </h2>
            <p>
              If you do not request deletion, your data will be retained as long
              as your account is active. Inactive accounts may be purged after
              extended periods of inactivity, as outlined in our{" "}
              <Link
                href="/privacy-policy"
                className="text-wellness-600 underline hover:text-wellness-700"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">
              6. Contact Us
            </h2>
            <p>
              If you have any questions or concerns about data deletion, please
              contact us:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@wellness-point.in"
                  className="text-wellness-600 underline hover:text-wellness-700"
                >
                  support@wellness-point.in
                </a>
              </li>
              <li>
                <strong>Phone:</strong> +91 87224 85312
              </li>
              <li>
                <strong>Address:</strong> Bengaluru, Karnataka, India
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
