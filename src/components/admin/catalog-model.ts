import type { Category, FoodInformation, ProductType } from "@/lib/types";

export type AdminProduct = {
  id: string;
  slug: string;
  category_id: string;
  type: ProductType;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  long_description_fr: string | null;
  long_description_en: string | null;
  origin: string | null;
  cultivar: string | null;
  badge: string | null;
  base_price: number;
  stock: number;
  pickup_only: boolean;
  active: boolean;
  featured: boolean;
  sort_order: number;
  image_url: string | null;
  ideal_for: string[];
  food_info: FoodInformation;
  shipping_weight_g: number;
};

export const blankProduct: AdminProduct = {
  id: "",
  slug: "",
  category_id: "",
  type: "drink",
  name_fr: "",
  name_en: "",
  description_fr: "",
  description_en: "",
  long_description_fr: "",
  long_description_en: "",
  origin: "",
  cultivar: "",
  badge: "",
  base_price: 0,
  stock: 99,
  pickup_only: true,
  active: true,
  featured: false,
  sort_order: 1,
  image_url: "",
  ideal_for: [],
  food_info: {},
  shipping_weight_g: 0,
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCategoryName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function inferProductPreset(
  category: Category | undefined,
  zone: "menu" | "shop",
) {
  const name = normalizeCategoryName(
    `${category?.name_fr ?? ""} ${category?.name_en ?? ""} ${category?.slug ?? ""}`,
  );

  if (zone === "menu") {
    const type: ProductType =
      /dessert|douceur|patis|gateau|cake|mochi|cookie|cheesecake/.test(name)
        ? "dessert"
        : /combo|formule|menu-duo|set/.test(name)
          ? "combo"
          : "drink";

    return {
      type,
      pickup_only: true,
      stock: 0,
      shipping_weight_g: 0,
      title:
        type === "dessert" ? "Dessert" : type === "combo" ? "Combo" : "Boisson",
      fulfillment: "Carte uniquement",
      note:
        "Article informatif : nom, prix, badge, description et photos. Aucun order en ligne.",
    };
  }

  const type: ProductType =
    /accessoire|accessory|ustensile|chasen|chawan|bol|fouet|chashaku|cuillere/.test(
      name,
    )
      ? "accessory"
      : "product";

  return {
    type,
    pickup_only: false,
    stock: 0,
    shipping_weight_g: 0,
    title: type === "accessory" ? "Accessoire" : "Matcha / produit",
    fulfillment: "Livraison + retrait",
    note:
      type === "accessory"
        ? "Préconfiguré pour un accessoire expédiable."
        : "Préconfiguré pour un produit Boutique avec variantes possibles.",
  };
}
