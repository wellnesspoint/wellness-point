"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Boxes, Upload, Download, AlertTriangle, PackageX } from "lucide-react";
import toast from "react-hot-toast";
import Pagination, { useDebounced } from "@/components/admin/Pagination";
import { downloadCsv } from "@/lib/csv";
import { parseCsv } from "@/lib/csv-parse";

interface Product {
  _id: string;
  name: string;
  sku?: string;
  stock: number;
  lowStockThreshold?: number;
  category?: string;
  variants?: { _id: string; name: string; sku?: string; stock: number }[];
}

interface ImportResult {
  row: number;
  ok: boolean;
  action?: "created" | "updated";
  error?: string;
}

const PAGE_SIZE = 25;
const TEMPLATE_HEADERS = [
  "name", "sku", "category", "price", "discountPrice", "stock",
  "weight", "gst", "description", "image", "ingredients", "benefits",
];

export default function InventoryPage() {
  const [tab, setTab] = useState<"stock" | "import">("stock");

  // ---- Stock tab ----
  const [stockFilter, setStockFilter] = useState<"low" | "out" | "all">("low");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (stockFilter !== "all") p.set("stock", stockFilter);
      if (debounced.trim()) p.set("q", debounced.trim());
      const res = await fetch(`/api/admin/products?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      setProducts(data.products || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setInputs({});
    } catch {
      toast.error("Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [page, stockFilter, debounced]);

  useEffect(() => {
    setPage(1);
  }, [stockFilter, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  // `variantId` is set for rows of a variant product (inputs are keyed by variant then)
  const adjust = async (p: Product, mode: "delta" | "set", variantId?: string) => {
    const raw = (inputs[variantId ?? p._id] ?? "").trim();
    if (raw === "") return;
    setBusy(p._id);
    try {
      const res = await fetch("/api/admin/products/stock-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustments: [{ id: p._id, variantId, [mode]: Number(raw) }] }),
      });
      const data = await res.json();
      const r = data.results?.[0];
      if (!res.ok || !r?.ok) throw new Error(r?.error || data.error || "Failed");
      const vName = variantId ? p.variants?.find((v) => v._id === variantId)?.name : undefined;
      toast.success(`${p.name}${vName ? ` (${vName})` : ""}: stock is now ${r.balance}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const exportLowStock = async () => {
    try {
      const p = new URLSearchParams({ all: "1" });
      if (stockFilter !== "all") p.set("stock", stockFilter);
      const res = await fetch(`/api/admin/products?${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      downloadCsv(
        `stock-${stockFilter}-${new Date().toISOString().slice(0, 10)}.csv`,
        ["name", "sku", "category", "stock", "alert level"],
        (data.products as Product[]).map((x) => [x.name, x.sku ?? "", x.category ?? "", x.stock, x.lowStockThreshold ?? 10])
      );
    } catch {
      toast.error("Export failed");
    }
  };

  // ---- Import tab ----
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportResult[] | null>(null);
  const [importing, setImporting] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("File is too large (max 2 MB)");
      return;
    }
    const parsed = parseCsv(await f.text());
    if (parsed.length === 0) {
      toast.error("No rows found. The first line must be the header.");
      return;
    }
    if (parsed.length > 500) {
      toast.error("Max 500 rows per import");
      return;
    }
    setRows(parsed);
    setFileName(f.name);
    setPreview(null);
    await runImport(parsed, true);
  };

  const runImport = async (data: Record<string, string>[], dryRun: boolean) => {
    setImporting(true);
    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: data, dryRun }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setPreview(json.results);
      if (!dryRun) {
        const ok = (json.results as ImportResult[]).filter((r) => r.ok).length;
        toast.success(`Imported ${ok} of ${json.results.length} rows`);
        setRows([]);
        setFileName("");
        load();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const okCount = preview?.filter((r) => r.ok).length ?? 0;
  const errCount = (preview?.length ?? 0) - okCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Boxes className="h-7 w-7 text-emerald-500" /> Inventory
        </h1>
        <div className="flex gap-2">
          {(["stock", "import"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-wellness-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t === "stock" ? "Stock levels" : "Import CSV"}
            </button>
          ))}
        </div>
      </div>

      {tab === "stock" && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Search name, SKU or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-72"
            />
            <div className="flex flex-wrap gap-2">
              {([
                ["low", "Low stock", AlertTriangle],
                ["out", "Out of stock", PackageX],
                ["all", "All", Boxes],
              ] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setStockFilter(v)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    stockFilter === v ? "bg-wellness-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              <Button variant="outline" size="sm" className="h-auto" onClick={exportLowStock}>
                <Download className="mr-1 h-4 w-4" /> CSV
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : products.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                {stockFilter === "all" ? "No products" : "Nothing needs restocking"}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {total} product{total !== 1 ? "s" : ""}. Use <b>±</b> to add or remove units (restock or damage), or <b>Set</b> for a stocktake count.
              </p>
              {products.map((p) => {
                const low = p.stock <= (p.lowStockThreshold ?? 10);
                return (
                  <Card key={p._id} className="border-0 shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.sku ? `SKU ${p.sku} · ` : ""}
                          {p.category ? `${p.category} · ` : ""}alert at {p.lowStockThreshold ?? 10}
                        </p>
                      </div>
                      <span className={`w-24 text-sm font-semibold ${p.stock <= 0 ? "text-red-600" : low ? "text-amber-600" : "text-foreground"}`}>
                        {p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`}
                      </span>
                      {(p.variants?.length ?? 0) > 0 ? (
                        <div className="w-full space-y-2 sm:w-auto">
                          {p.variants!.map((v) => (
                            <div key={v._id} className="flex flex-wrap items-center gap-2">
                              <span className="w-32 truncate text-xs text-muted-foreground" title={v.name}>
                                {v.name}: <b className={v.stock <= 0 ? "text-red-600" : "text-foreground"}>{v.stock}</b>
                              </span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                step="1"
                                placeholder="+20 / -3"
                                value={inputs[v._id] ?? ""}
                                onChange={(e) => setInputs((prev) => ({ ...prev, [v._id]: e.target.value }))}
                                className="h-10 w-24"
                                aria-label={`Stock change for ${p.name} ${v.name}`}
                              />
                              <Button size="sm" variant="outline" className="h-10" disabled={busy === p._id || !(inputs[v._id] ?? "").trim()} onClick={() => adjust(p, "delta", v._id)}>
                                ± Apply
                              </Button>
                              <Button size="sm" variant="outline" className="h-10" disabled={busy === p._id || !(inputs[v._id] ?? "").trim()} onClick={() => adjust(p, "set", v._id)}>
                                Set
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          step="1"
                          placeholder="e.g. 20 or -3"
                          value={inputs[p._id] ?? ""}
                          onChange={(e) => setInputs((prev) => ({ ...prev, [p._id]: e.target.value }))}
                          className="h-10 w-32"
                          aria-label={`Stock change for ${p.name}`}
                        />
                        <Button size="sm" variant="outline" className="h-10" disabled={busy === p._id || !(inputs[p._id] ?? "").trim()} onClick={() => adjust(p, "delta")}>
                          ± Apply
                        </Button>
                        <Button size="sm" variant="outline" className="h-10" disabled={busy === p._id || !(inputs[p._id] ?? "").trim()} onClick={() => adjust(p, "set")}>
                          Set
                        </Button>
                      </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <Pagination page={page} pages={pages} total={total} limit={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      {tab === "import" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="font-semibold text-foreground">Import / update products from CSV</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Rows whose <b>sku</b> already exists update that product (price, stock, details); other rows create new products.
                New products without an <b>image</b> URL are created inactive. Use <code>|</code> between ingredients/benefits. Max 500 rows.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  downloadCsv("product-import-template.csv", TEMPLATE_HEADERS, [
                    ["Sample Whey Protein", "WP-001", "Protein", 1999, 1799, 50, 1000, 18, "Clean whey isolate", "https://res.cloudinary.com/.../sample.jpg", "Whey|Cocoa", "Muscle recovery|High protein"],
                  ])
                }
              >
                <Download className="mr-1 h-4 w-4" /> Download template
              </Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-md bg-wellness-600 px-4 text-sm font-medium text-white hover:bg-wellness-700">
                <Upload className="h-4 w-4" /> Choose CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              </label>
            </div>

            {fileName && (
              <p className="text-sm text-muted-foreground">
                {fileName}: {rows.length} row{rows.length !== 1 ? "s" : ""}
                {importing && " · checking…"}
              </p>
            )}

            {preview && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium text-green-700">{okCount} ready</span>
                  {errCount > 0 && <span className="ml-3 font-medium text-red-600">{errCount} with errors (will be skipped)</span>}
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                  {preview.map((r) => (
                    <li key={r.row} className={`rounded px-2 py-1 ${r.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                      Row {r.row}: {r.ok ? `will be ${r.action}` : r.error}
                    </li>
                  ))}
                </ul>
                {rows.length > 0 && okCount > 0 && (
                  <Button variant="wellness" disabled={importing} onClick={() => runImport(rows, false)}>
                    Import {okCount} row{okCount !== 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
