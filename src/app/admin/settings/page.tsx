"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";
import toast from "react-hot-toast";

interface Company {
  name: string;
  tagline: string;
  location: string;
  gstNo: string;
  supportEmail: string;
  website: string;
  phone?: string;
}

const empty: Company = { name: "", tagline: "", location: "", gstNo: "", supportEmail: "", website: "", phone: "" };

export default function AdminSettingsPage() {
  const [form, setForm] = useState<Company>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load settings");
        setForm({ ...empty, ...d.settings });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Company) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save settings");
      setForm({ ...empty, ...d.settings });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Settings className="h-7 w-7 text-emerald-500" /> Store Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          These details appear on invoices, shipping labels and customer emails.
        </p>
      </div>

      <form onSubmit={save}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Store name *</Label>
              <Input id="name" value={form.name} onChange={set("name")} maxLength={80} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tagline">Tagline (shown on invoices)</Label>
              <Input id="tagline" value={form.tagline} onChange={set("tagline")} maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Address / location</Label>
              <Input id="location" value={form.location} onChange={set("location")} maxLength={200} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gstNo">GST number (GSTIN)</Label>
                <Input
                  id="gstNo"
                  value={form.gstNo}
                  onChange={(e) => setForm((f) => ({ ...f, gstNo: e.target.value.toUpperCase() }))}
                  maxLength={15}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone || ""} onChange={set("phone")} maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supportEmail">Support email</Label>
                <Input id="supportEmail" type="email" value={form.supportEmail} onChange={set("supportEmail")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={set("website")} maxLength={100} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Changes apply to new invoices and emails within about a minute. Leave a field blank to use the built-in default.
            </p>
            <Button type="submit" variant="wellness" disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
