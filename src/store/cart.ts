import { create } from "zustand";
import { persist } from "zustand/middleware";
import { lineKey } from "@/lib/variants";

export interface CartItem {
  _id: string;
  /** set for products that are sold as variants (size, flavour...) */
  variantId?: string;
  variantName?: string;
  name: string;
  slug: string;
  price: number;
  discountPrice?: number;
  image: string;
  quantity: number;
  stock: number;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  /** `key` is lineKey(productId, variantId) — the product id alone for plain products */
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const items = get().items;
        const key = lineKey(item._id, item.variantId);
        const existing = items.find((i) => lineKey(i._id, i.variantId) === key);

        if (existing) {
          if (existing.quantity >= item.stock) return;
          set({
            items: items.map((i) =>
              lineKey(i._id, i.variantId) === key
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          });
        } else {
          set({ items: [...items, { ...item, quantity: 1 }] });
        }
      },

      removeItem: (key) => {
        set({ items: get().items.filter((i) => lineKey(i._id, i.variantId) !== key) });
      },

      updateQuantity: (key, quantity) => {
        if (quantity < 1) {
          get().removeItem(key);
          return;
        }
        set({
          items: get().items.map((i) =>
            lineKey(i._id, i.variantId) === key ? { ...i, quantity: Math.min(quantity, i.stock) } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),
      toggleCart: () => set({ isOpen: !get().isOpen }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getSubtotal: () =>
        get().items.reduce(
          (sum, i) => sum + (i.discountPrice || i.price) * i.quantity,
          0
        ),
    }),
    {
      name: "wellness-point-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
