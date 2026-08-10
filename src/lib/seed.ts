import type { Category, Product } from "./types";

export const seedCategories: Category[] = [
  { id: "cat-matcha-drinks", slug: "matcha", name_fr: "Matcha", name_en: "Matcha", kind: "menu", sort_order: 1, active: true },
  { id: "cat-cafe-bubble", slug: "cafe-bubble", name_fr: "Café & Bubble Tea", name_en: "Coffee & Bubble Tea", kind: "menu", sort_order: 2, active: true },
  { id: "cat-desserts", slug: "desserts", name_fr: "Desserts", name_en: "Desserts", kind: "menu", sort_order: 3, active: true },
  { id: "cat-ceremony", slug: "ceremonie", name_fr: "Matcha cérémonie", name_en: "Ceremonial matcha", kind: "shop", sort_order: 1, active: true },
  { id: "cat-latte", slug: "latte", name_fr: "Matcha latte", name_en: "Matcha for latte", kind: "shop", sort_order: 2, active: true },
  { id: "cat-accessories", slug: "accessoires", name_fr: "Accessoires", name_en: "Accessories", kind: "shop", sort_order: 3, active: true },
];

const milkOptions = {
  id: "milk",
  name_fr: "Lait",
  name_en: "Milk",
  required: true,
  min_select: 1,
  max_select: 1,
  values: [
    { id: "milk-dairy", label_fr: "Lait", label_en: "Dairy milk", price_delta: 0, sort_order: 1 },
    { id: "milk-oat", label_fr: "Avoine", label_en: "Oat", price_delta: 0.5, sort_order: 2 },
    { id: "milk-coco", label_fr: "Coco", label_en: "Coconut", price_delta: 0.5, sort_order: 3 },
  ],
};

const tempOptions = {
  id: "temperature",
  name_fr: "Température",
  name_en: "Temperature",
  required: true,
  min_select: 1,
  max_select: 1,
  values: [
    { id: "iced", label_fr: "Glacé", label_en: "Iced", price_delta: 0, sort_order: 1 },
    { id: "hot", label_fr: "Chaud", label_en: "Hot", price_delta: 0, sort_order: 2 },
  ],
};

const sugarOptions = {
  id: "sugar",
  name_fr: "Sucre",
  name_en: "Sugar",
  required: true,
  min_select: 1,
  max_select: 1,
  values: [
    { id: "sugar-0", label_fr: "0 %", label_en: "0%", price_delta: 0, sort_order: 1 },
    { id: "sugar-30", label_fr: "30 %", label_en: "30%", price_delta: 0, sort_order: 2 },
    { id: "sugar-50", label_fr: "50 %", label_en: "50%", price_delta: 0, sort_order: 3 },
    { id: "sugar-100", label_fr: "100 %", label_en: "100%", price_delta: 0, sort_order: 4 },
  ],
};

const toppings = {
  id: "toppings",
  name_fr: "Suppléments",
  name_en: "Extras",
  required: false,
  min_select: 0,
  max_select: 3,
  values: [
    { id: "tapioca", label_fr: "Tapioca", label_en: "Tapioca", price_delta: 0.7, sort_order: 1 },
    { id: "brown-sugar", label_fr: "Sucre brun", label_en: "Brown sugar", price_delta: 0.5, sort_order: 2 },
    { id: "matcha-cream", label_fr: "Crème matcha", label_en: "Matcha cream", price_delta: 1, sort_order: 3 },
  ],
};

export const seedProducts: Product[] = [
  {
    id: "drink-matcha-latte", slug: "matcha-latte", category_id: "cat-matcha-drinks", type: "drink",
    name_fr: "Matcha Latte", name_en: "Matcha Latte",
    description_fr: "Matcha japonais fouetté, doux et crémeux, avec le lait de votre choix.",
    description_en: "Whisked Japanese matcha, smooth and creamy, with your choice of milk.",
    origin: "Préparé à Nice", cultivar: "Matcha japonais", badge: "Classique",
    base_price: 6.5, stock: 99, pickup_only: true, active: true, featured: true, sort_order: 1,
    image_url: "/product-placeholder.svg", ideal_for: ["Matcha latte", "Débutant"], shipping_weight_g: 0, variants: [],
    option_groups: [tempOptions, milkOptions, sugarOptions, toppings],
  },
  {
    id: "drink-strawberry", slug: "strawberry-matcha", category_id: "cat-matcha-drinks", type: "drink",
    name_fr: "Strawberry Matcha", name_en: "Strawberry Matcha",
    description_fr: "Fraise, lait onctueux et matcha dans une boisson fraîche et gourmande.",
    description_en: "Strawberry, smooth milk and matcha in a fresh, indulgent drink.",
    badge: "Fruité", base_price: 7.5, stock: 99, pickup_only: true, active: true, featured: true, sort_order: 2,
    image_url: "/product-placeholder.svg", ideal_for: ["Matcha latte", "Boisson fruitée"], shipping_weight_g: 0, variants: [],
    option_groups: [{ ...tempOptions, values: [tempOptions.values[0]] }, milkOptions, sugarOptions, toppings],
  },
  {
    id: "drink-mango", slug: "mango-matcha", category_id: "cat-matcha-drinks", type: "drink",
    name_fr: "Mango Matcha", name_en: "Mango Matcha",
    description_fr: "Mangue fruitée, lait et matcha végétal dans une création douce et lumineuse.",
    description_en: "Fruity mango, milk and vegetal matcha in a soft, vibrant creation.",
    badge: "Fruité", base_price: 7.5, stock: 99, pickup_only: true, active: true, featured: true, sort_order: 3,
    image_url: "/product-placeholder.svg", ideal_for: ["Matcha latte", "Été"], shipping_weight_g: 0, variants: [],
    option_groups: [{ ...tempOptions, values: [tempOptions.values[0]] }, milkOptions, sugarOptions, toppings],
  },
  {
    id: "drink-coconut-cloud", slug: "matcha-coconut-cloud", category_id: "cat-matcha-drinks", type: "drink",
    name_fr: "Matcha Coconut Cloud", name_en: "Matcha Coconut Cloud",
    description_fr: "Eau de coco fraîche surmontée d’une mousse nuageuse au matcha.",
    description_en: "Fresh coconut water topped with a cloud-like matcha foam.",
    badge: "Signature", base_price: 8, stock: 99, pickup_only: true, active: true, featured: true, sort_order: 4,
    image_url: "/products/matcha-coconut-cloud.webp", ideal_for: ["Rafraîchissant", "Été"], shipping_weight_g: 0, variants: [],
    option_groups: [{ ...tempOptions, values: [tempOptions.values[0]] }, sugarOptions],
  },
  {
    id: "dessert-lava", slug: "matcha-lava", category_id: "cat-desserts", type: "dessert",
    name_fr: "Matcha Lava", name_en: "Matcha Lava",
    description_fr: "Dessert fondant au matcha avec un cœur intensément coulant.",
    description_en: "A soft matcha dessert with an intensely molten centre.",
    badge: "Gourmand", base_price: 7.5, stock: 20, pickup_only: true, active: true, featured: true, sort_order: 1,
    image_url: "/products/matcha-lava.webp", ideal_for: ["Dessert", "Matcha intense"], shipping_weight_g: 0, variants: [], option_groups: [],
  },
  {
    id: "matcha-sen", slug: "kyocha-sen", category_id: "cat-ceremony", type: "product",
    name_fr: "KYOCHA Sen", name_en: "KYOCHA Sen",
    description_fr: "Un matcha lumineux et facile à boire, agréable en usucha et suffisamment net pour un latte.",
    description_en: "A bright, easy-drinking matcha for usucha and clean enough for lattes.",
    origin: "Japon", cultivar: "Blend", badge: "Usucha", base_price: 24.9, stock: 30, pickup_only: false,
    active: true, featured: true, sort_order: 1, image_url: "/products/matcha-packaging.webp",
    ideal_for: ["Usucha", "Matcha latte", "Débutant", "Matcha quotidien"], shipping_weight_g: 90,
    variants: [
      { id: "sen-30", product_id: "matcha-sen", name: "30 g", packaging: "can", weight: "30 g", price: 24.9, stock: 18, active: true, image_url: "/products/matcha-packaging.webp", shipping_weight_g: 90 },
      { id: "sen-50", product_id: "matcha-sen", name: "50 g", packaging: "bag", weight: "50 g", price: 36.9, stock: 8, active: true, image_url: "/products/matcha-packaging.webp", shipping_weight_g: 75 },
      { id: "sen-100", product_id: "matcha-sen", name: "100 g", packaging: "bag", weight: "100 g", price: 64.9, stock: 4, active: true, image_url: "/products/matcha-packaging.webp", shipping_weight_g: 125 },
    ],
    option_groups: [],
  },
  {
    id: "accessory-chasen", slug: "chasen-takayama", category_id: "cat-accessories", type: "accessory",
    name_fr: "Chasen Takayama", name_en: "Takayama Chasen",
    description_fr: "Fouet en bambou pour obtenir une mousse fine et homogène.",
    description_en: "Bamboo whisk for a fine, even foam.",
    origin: "Nara, Japon", badge: "Artisanal", base_price: 24, stock: 14, pickup_only: false,
    active: true, featured: false, sort_order: 2, image_url: "/product-placeholder.svg",
    ideal_for: ["Usucha", "Matcha latte"], shipping_weight_g: 80, variants: [], option_groups: [],
  },
];
