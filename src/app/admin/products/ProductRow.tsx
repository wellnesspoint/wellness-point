"use client";

import {
  Pencil,
  Trash2,
  Package,
  Archive,
  ArchiveRestore,
  History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cloudinaryUrl } from "@/lib/utils";
import type { Product } from "./types";

export interface StockMovementRow {
  _id: string;
  delta: number;
  reason: string;
  variantName?: string;
  actorName?: string;
  balance?: number;
  createdAt: string;
}

interface Props {
  product: Product;
  checked: boolean;
  onToggle: () => void;
  historyOpen: boolean;
  history: StockMovementRow[];
  loadingHistory: boolean;
  onToggleHistory: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
}

/** One product in the admin list, with its inline stock-history panel. */
export default function ProductRow({
  product,
  checked,
  onToggle,
  historyOpen,
  history,
  loadingHistory,
  onToggleHistory,
  onEdit,
  onArchive,
  onRestore,
  onDeleteForever,
}: Props) {
  return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Select ${product.name}`}
            className="h-4 w-4 shrink-0"
          />
          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
            {product.images?.[0] ? (
              <img
                src={cloudinaryUrl(product.images[0], 160)}
                loading="lazy"
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-6 w-6 text-muted" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {product.name}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-wellness-700">
                ₹{product.discountPrice && product.discountPrice < product.price ? product.discountPrice : product.price}
              </span>
              {product.discountPrice && product.discountPrice < product.price && (
                <span className="text-muted-foreground line-through text-xs">
                  ₹{product.price}
                </span>
              )}
              <span className={`text-xs ${product.stock <= (product.lowStockThreshold ?? 10) ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                {product.stock <= 0 ? "Out of Stock" : product.stock <= (product.lowStockThreshold ?? 10) ? `Low: ${product.stock}` : `Stock: ${product.stock}`}
              </span>
              {(product.variants?.length ?? 0) > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  {product.variants!.length} variants
                </span>
              )}
              {product.archivedAt && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  Archived
                </span>
              )}
              {product.isFeatured && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  Featured
                </span>
              )}
              {product.isActive === false && !product.archivedAt && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                  Disabled
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onToggleHistory}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
              title="Stock history"
              aria-label="Stock history"
            >
              <History className="h-4 w-4" />
            </button>
            {product.archivedAt ? (
              <>
                <button
                  onClick={onRestore}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                  title="Restore"
                  aria-label="Restore"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </button>
                <button
                  onClick={onDeleteForever}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  title="Delete permanently"
                  aria-label="Delete permanently"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onEdit}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-muted-foreground"
                  title="Edit"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={onArchive}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                  title="Archive"
                  aria-label="Archive"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </CardContent>
        {historyOpen && (
          <div className="border-t px-4 pb-4 pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Stock history (latest 50)</p>
            {loadingHistory ? (
              <Skeleton className="h-10 w-full rounded" />
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No stock changes recorded yet.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                {history.map((m) => (
                  <li key={m._id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1">
                    <span>
                      <span className={`font-semibold ${m.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>{" "}
                      <span className="capitalize">{m.reason.replace("_", " ")}</span>
                      {m.variantName ? ` · ${m.variantName}` : ""}
                      {m.actorName ? ` · ${m.actorName}` : ""}
                      {m.balance !== undefined ? ` · now ${m.balance}` : ""}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
  );
}
