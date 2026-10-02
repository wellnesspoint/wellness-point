import type { Metadata } from "next";
import { getSiteStatus } from "@/lib/site-status";
import { getCompany } from "@/lib/site-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Back soon",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const [status, company] = await Promise.all([getSiteStatus(), getCompany()]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-wellness-600">{company.name}</p>
        <h1 className="font-heading text-3xl font-bold text-foreground">We&apos;ll be right back</h1>
        <p className="mt-4 text-muted-foreground">{status.maintenance.message}</p>
        {company.supportEmail && (
          <p className="mt-6 text-sm text-muted-foreground">
            Questions? Write to{" "}
            <a className="font-medium text-wellness-700 underline" href={`mailto:${company.supportEmail}`}>
              {company.supportEmail}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
