"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCog, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/admin/ConfirmProvider";
import { ADMIN_ROLES, ROLE_LABELS, type AdminRole } from "@/lib/permissions";

interface Member {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  adminRole: AdminRole;
  legacy: boolean;
  isYou: boolean;
}

export default function TeamPage() {
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("support");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/team");
      const d = await res.json();
      if (!res.ok) throw new Error();
      setMembers(d.admins || []);
    } catch {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (url: string, method: string, body?: unknown, okMsg = "Saved") => {
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
    const ok = await call("/api/admin/team", "POST", { email, adminRole: newRole }, "Admin added");
    if (ok) setEmail("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
        <UserCog className="h-7 w-7 text-emerald-500" /> Team &amp; roles
      </h1>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-2 p-4 text-sm">
          {ADMIN_ROLES.map((r) => (
            <p key={r}>
              <span className="font-semibold">{ROLE_LABELS[r].label}:</span>{" "}
              <span className="text-muted-foreground">{ROLE_LABELS[r].description}</span>
            </p>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="team-email" className="mb-1 block text-sm font-medium">
                Give an existing customer admin access
              </label>
              <Input
                id="team-email"
                type="email"
                required
                placeholder="their-account@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              aria-label="Role"
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
              ))}
            </select>
            <Button type="submit" variant="wellness" disabled={adding || !email}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m._id} className={`border-0 shadow-sm ${m.isActive ? "" : "opacity-60"}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {m.name} {m.isYou && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs">
                    {m.twoFactorEnabled ? (
                      <><ShieldCheck className="h-3.5 w-3.5 text-green-600" /> 2FA on</>
                    ) : (
                      <><ShieldOff className="h-3.5 w-3.5 text-amber-600" /> 2FA off</>
                    )}
                    {m.legacy && <span className="ml-2 text-muted-foreground">· legacy admin (treated as owner)</span>}
                    {!m.isActive && <span className="ml-2 text-red-600">· blocked</span>}
                  </p>
                </div>
                <select
                  value={m.adminRole}
                  disabled={m.isYou}
                  onChange={(e) => call(`/api/admin/team/${m._id}`, "PUT", { adminRole: e.target.value })}
                  className="h-10 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
                  aria-label={`Role for ${m.name}`}
                >
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                  ))}
                </select>
                {!m.isYou && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10"
                      onClick={() => call(`/api/admin/team/${m._id}`, "PUT", { isActive: !m.isActive })}
                    >
                      {m.isActive ? "Block" : "Unblock"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 text-red-600"
                      onClick={async () => {
                        if (await confirm(`Remove admin access for ${m.email}? They stay as a normal customer.`)) {
                          await call(`/api/admin/team/${m._id}`, "DELETE", undefined, "Admin access removed");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
