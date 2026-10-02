"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Plus, Trash2, ArrowRight, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/admin/ConfirmProvider";

interface RedirectRow {
  _id: string;
  from: string;
  to: string;
  permanent: boolean;
  isActive: boolean;
}

export default function SitePage() {
  const confirm = useConfirm();

  // ---- maintenance ----
  const [maint, setMaint] = useState<{ on: boolean; message: string; defaultMessage: string } | null>(null);
  const [message, setMessage] = useState("");
  const [savingMaint, setSavingMaint] = useState(false);

  // ---- redirects ----
  const [redirects, setRedirects] = useState<RedirectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [permanent, setPermanent] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([
        fetch("/api/admin/maintenance").then((x) => x.json()),
        fetch("/api/admin/redirects").then((x) => x.json()),
      ]);
      if (m.on !== undefined) {
        setMaint(m);
        setMessage(m.message || "");
      }
      setRedirects(r.redirects || []);
    } catch {
      toast.error("Failed to load site settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setMaintenance = async (on: boolean) => {
    if (
      on &&
      !(await confirm(
        "Turn ON maintenance mode? Customers will see a maintenance page instead of the store. The admin panel, payments and signed-in admins are not affected.",
        { danger: false, confirmLabel: "Turn on", title: "Maintenance mode" }
      ))
    )
      return;
    setSavingMaint(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on, message }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success(on ? "Maintenance mode is ON (takes effect within about 30 seconds)" : "Store is live again");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingMaint(false);
    }
  };

  const send = async (url: string, method: string, body?: unknown, okMsg = "Saved") => {
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Request failed");
      toast.success(okMsg);
      await load();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      return false;
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    if (await send("/api/admin/redirects", "POST", { from, to, permanent }, "Redirect added")) {
      setFrom("");
      setTo("");
    }
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <Globe className="h-7 w-7 text-emerald-500" /> Site
      </h1>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Wrench className="h-4 w-4" /> Maintenance mode
              </h2>
              <p className="text-sm text-muted-foreground">
                Shows customers a &quot;back soon&quot; page (HTTP 503) instead of the store. Admin pages, the payment
                webhook and anyone signed in to the admin panel keep working.
              </p>
            </div>
            {maint && (
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  maint.on ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"
                }`}
              >
                {maint.on ? "ON" : "Off (store is live)"}
              </span>
            )}
          </div>
          <label htmlFor="maint-msg" className="block text-sm font-medium">
            Message shown to customers
          </label>
          <Input
            id="maint-msg"
            value={message}
            maxLength={300}
            placeholder={maint?.defaultMessage}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            {maint?.on ? (
              <Button variant="wellness" disabled={savingMaint} onClick={() => setMaintenance(false)}>
                Turn off, go live
              </Button>
            ) : (
              <Button variant="outline" disabled={savingMaint || !maint} onClick={() => setMaintenance(true)}>
                Turn on maintenance mode
              </Button>
            )}
            {maint?.on && (
              <Button variant="ghost" disabled={savingMaint} onClick={() => send("/api/admin/maintenance", "PUT", { on: true, message }, "Message updated")}>
                Update message
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div>
            <h2 className="font-semibold text-foreground">Redirects</h2>
            <p className="text-sm text-muted-foreground">
              Send an old address to a new one so links and Google results do not break (for example after renaming a
              product or blog post).
            </p>
          </div>
          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <div>
              <label htmlFor="rd-from" className="mb-1 block text-xs font-medium">Old address</label>
              <Input id="rd-from" required placeholder="/product/old-name" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rd-to" className="mb-1 block text-xs font-medium">New address</label>
              <Input id="rd-to" required placeholder="/product/new-name or https://..." value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <select
              value={permanent ? "301" : "302"}
              onChange={(e) => setPermanent(e.target.value === "301")}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Redirect type"
            >
              <option value="301">Permanent (301)</option>
              <option value="302">Temporary (302)</option>
            </select>
            <Button type="submit" variant="wellness" disabled={adding}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>

          {loading ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : redirects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No redirects yet</p>
          ) : (
            <ul className="divide-y">
              {redirects.map((r) => (
                <li key={r._id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center ${r.isActive ? "" : "opacity-60"}`}>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5">{r.from}</code>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <code className="min-w-0 truncate rounded bg-muted px-1.5 py-0.5">{r.to}</code>
                    <span className="text-xs text-muted-foreground">{r.permanent ? "301" : "302"}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10"
                      onClick={() => send(`/api/admin/redirects/${r._id}`, "PUT", { isActive: !r.isActive })}
                    >
                      {r.isActive ? "Turn off" : "Turn on"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10 text-red-600"
                      aria-label={`Delete redirect ${r.from}`}
                      onClick={async () => {
                        if (await confirm(`Delete the redirect from ${r.from}?`)) {
                          await send(`/api/admin/redirects/${r._id}`, "DELETE", undefined, "Redirect deleted");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Changes apply within about 30 seconds.</p>
        </CardContent>
      </Card>
    </div>
  );
}
