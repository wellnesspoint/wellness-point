"use client";

import { Eye, Ban, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserItem } from "./types";

interface Props {
  users: UserItem[];
  selectedIds: Set<string>;
  allSelected: boolean;
  canSelectAny: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onView: (user: UserItem) => void;
  onToggleBlock: (id: string, currentlyActive: boolean) => void;
  onDelete: (id: string, name: string) => void;
}

/** Phones: one card per customer (the 10-column table needs ~900px). Desktop keeps the table. */
export default function MobileCustomerCards({
  users,
  selectedIds,
  allSelected,
  canSelectAny,
  onToggleAll,
  onToggle,
  onView,
  onToggleBlock,
  onDelete,
}: Props) {
  return (
  <div className="space-y-2 md:hidden">
    <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <input
        type="checkbox"
        aria-label="Select all customers"
        className="h-5 w-5 cursor-pointer accent-emerald-600"
        checked={allSelected}
        onChange={onToggleAll}
        disabled={!canSelectAny}
      />
      Select all on this page
    </label>
    {users.map((user) => (
      <div
        key={user._id}
        className={`rounded-xl border p-3 ${selectedIds.has(user._id) ? "border-red-200 bg-red-50/60" : "bg-card"}`}
      >
        <div className="flex items-start gap-3">
          {user.role !== "admin" ? (
            <input
              type="checkbox"
              aria-label={`Select ${user.name || user.email}`}
              className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-emerald-600"
              checked={selectedIds.has(user._id)}
              onChange={() => onToggle(user._id)}
            />
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{user.name || "—"}</p>
              {user.role === "admin" && (
                <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">Admin</span>
              )}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${user.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
              >
                {user.isActive !== false ? "Active" : "Blocked"}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.orderCount ?? 0} order{(user.orderCount ?? 0) !== 1 ? "s" : ""}
              {(user.totalSpent ?? 0) > 0 ? ` · ₹${(user.totalSpent ?? 0).toLocaleString("en-IN")}` : ""}
              {" · joined "}
              {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="h-11 flex-1" onClick={() => onView(user)}>
            <Eye className="mr-1.5 h-4 w-4" /> View
          </Button>
          {user.role !== "admin" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => onToggleBlock(user._id, user.isActive !== false)}
              >
                {user.isActive !== false ? (
                  <><Ban className="mr-1.5 h-4 w-4" /> Block</>
                ) : (
                  <><CheckCircle className="mr-1.5 h-4 w-4" /> Unblock</>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 w-11 shrink-0 p-0 text-red-600"
                aria-label={`Delete ${user.name || user.email}`}
                onClick={() => onDelete(user._id, user.name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    ))}
  </div>
  );
}
