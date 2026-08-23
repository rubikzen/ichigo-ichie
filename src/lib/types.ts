export type ProductType = "product" | "drink" | "dessert" | "accessory" | "combo";

export type Category = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  kind: "menu" | "shop";
  sort_order: number;
  active: boolean;
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
};

export type Variant = {
  id: string;
  product_id: string;
  name: string;
  packaging?: "can" | "bag" | "other" | null;
  weight?: string | null;
  price: number;
  stock: number;
  sku?: string | null;
  active: boolean;
  image_url?: string | null;
  shipping_weight_g?: number | null;
};

export type OptionValue = {
  id: string;
  label_fr: string;
  label_en: string;
  price_delta: number;
  sort_order: number;
};

export type OptionGroup = {
  id: string;
  name_fr: string;
  name_en: string;
  required: boolean;
  min_select: number;
  max_select: number;
  values: OptionValue[];
};

export type FoodInformation = {
  legal_name_fr?: string;
  legal_name_en?: string;
  ingredients_fr?: string;
  ingredients_en?: string;
  allergens_fr?: string;
  allergens_en?: string;
  net_quantity?: string;
  storage_fr?: string;
  storage_en?: string;
  operator_fr?: string;
  operator_en?: string;
  preparation_fr?: string;
  preparation_en?: string;
};

export type Product = {
  id: string;
  slug: string;
  category_id: string;
  type: ProductType;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  long_description_fr?: string | null;
  long_description_en?: string | null;
  origin?: string | null;
  cultivar?: string | null;
  badge?: string | null;
  base_price: number;
  stock: number;
  pickup_only: boolean;
  active: boolean;
  featured: boolean;
  sort_order: number;
  image_url?: string | null;
  images?: ProductImage[];
  ideal_for: string[];
  food_info?: FoodInformation | null;
  variants: Variant[];
  option_groups: OptionGroup[];
};

export type CartChoice = {
  groupId: string;
  groupName: string;
  valueId: string;
  valueName: string;
  priceDelta: number;
};

export type CartItem = {
  key: string;
  productId: string;
  variantId?: string | null;
  name: string;
  imageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  pickupOnly: boolean;
  bundleId?: string | null;
  bundleGroupId?: string | null;
  choices: CartChoice[];
};
