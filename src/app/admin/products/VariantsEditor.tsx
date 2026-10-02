"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** One row of the variants editor (all strings, as typed). */
export interface VariantForm {
  _id?: string;
  name: string;
  sku: string;
  price: string;
  discountPrice: string;
  stock: string;
  isActive: boolean;
}

interface Props {
  variants: VariantForm[];
  /** price pre-filled into a newly added variant (the product form's price field) */
  defaultPrice: string;
  onChange: (variants: VariantForm[]) => void;
}

/** Variants (size, flavour...) of a product, each with its own price and stock. */
export default function VariantsEditor({ variants, defaultPrice, onChange }: Props) {
  return (
      <div className="sm:col-span-2 space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>Variants (optional)</Label>
            <p className="text-[11px] text-muted-foreground">
              Sizes, flavours, packs... each with its own price and stock. Customers must pick one.
              Product price and stock then follow the variants.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...variants, { name: "", sku: "", price: defaultPrice, discountPrice: "", stock: "0", isActive: true }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Add variant
          </Button>
        </div>
        {variants.map((v, i) => {
          const set = (patch: Partial<VariantForm>) =>
                onChange(variants.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={v._id ?? `new-${i}`} className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-6">
              <Input className="col-span-2" placeholder="Name e.g. 1kg Chocolate" value={v.name} onChange={(e) => set({ name: e.target.value })} aria-label="Variant name" />
              <Input placeholder="SKU" value={v.sku} onChange={(e) => set({ sku: e.target.value })} aria-label="Variant SKU" />
              <Input type="number" placeholder="Price" value={v.price} onChange={(e) => set({ price: e.target.value })} aria-label="Variant price" />
              <Input type="number" placeholder="Discount" value={v.discountPrice} onChange={(e) => set({ discountPrice: e.target.value })} aria-label="Variant discount price" />
              <Input type="number" placeholder="Stock" value={v.stock} onChange={(e) => set({ stock: e.target.value })} aria-label="Variant stock" />
              <label className="col-span-2 flex items-center gap-2 text-xs sm:col-span-5">
                <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
                Available to customers
              </label>
              <button
                type="button"
                onClick={() => onChange(variants.filter((_, j) => j !== i))}
                className="justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                aria-label="Remove variant"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
  );
}
