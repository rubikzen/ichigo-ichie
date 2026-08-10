"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  replaceItem: (oldKey: string, item: CartItem) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  subtotal: 0,
  addItem: () => undefined,
  setQuantity: () => undefined,
  removeItem: () => undefined,
  replaceItem: () => undefined,
  clear: () => undefined,
});

const STORAGE_KEY = "ichigo-ichie-v2-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore invalid old cart */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  // Stable reference: consumers can safely use `clear` in an effect dependency.
  // Returning the current array when already empty also avoids a needless render.
  const clear = useCallback(() => {
    setItems((current) => current.length ? [] : current);
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    addItem: (item) => setItems((current) => {
      const existing = current.find((candidate) => candidate.key === item.key);
      if (existing) {
        return current.map((candidate) => candidate.key === item.key
          ? { ...candidate, quantity: candidate.quantity + (item.quantity ?? 1) }
          : candidate);
      }
      return [...current, { ...item, quantity: item.quantity ?? 1 }];
    }),
    setQuantity: (key, quantity) => setItems((current) => quantity <= 0
      ? current.filter((item) => item.key !== key)
      : current.map((item) => item.key === key ? { ...item, quantity } : item)),
    removeItem: (key) => setItems((current) => current.filter((item) => item.key !== key)),
    replaceItem: (oldKey, nextItem) => setItems((current) => {
      if (oldKey === nextItem.key) {
        return current.map((item) => item.key === oldKey ? nextItem : item);
      }
      const existing = current.find((item) => item.key === nextItem.key);
      if (existing) {
        return current
          .filter((item) => item.key !== oldKey)
          .map((item) => item.key === nextItem.key
            ? { ...item, quantity: item.quantity + nextItem.quantity }
            : item);
      }
      return current.map((item) => item.key === oldKey ? nextItem : item);
    }),
    clear,
  }), [items, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
