export type MatchaNiceStoreInfo = {
  address: string;
  openingHours: string;
  phone: string;
  email: string;
  mapsHref: string;
  instagramHref: string;
  menuInfoFr: string;
  menuInfoEn: string;
};

export type MatchaNiceFaq = {
  questionFr: string;
  questionEn: string;
  answerFr: string;
  answerEn: string;
};

export const MATCHA_NICE_META = {
  title: "Matcha Nice | Boutique de matcha japonais dans le Vieux Nice",
  description:
    "Découvrez Ichigo Ichie, maison de matcha japonais dans le Vieux Nice : matcha à boire sur place, matcha japonais et accessoires en boutique, retrait à Nice et vente en ligne.",
  canonical: "/matcha-nice",
} as const;

export const MATCHA_NICE_SECTIONS = [
  {
    titleFr: "Une maison dédiée au matcha dans le Vieux Nice",
    titleEn: "A matcha house in Vieux Nice",
    bodyFr: [
      "Ichigo Ichie réunit au même endroit une carte de boissons et douceurs japonaises ainsi qu’une sélection de matchas et d’accessoires à emporter. Cette page rassemble les informations utiles si vous cherchez du matcha à Nice ou souhaitez venir découvrir la maison.",
      "Les boissons et desserts de la carte se découvrent sur place. Les produits de la Boutique peuvent aussi être commandés en ligne avec retrait à Nice ou livraison en France métropolitaine selon les conditions affichées au moment de la commande.",
    ],
    bodyEn: [
      "Ichigo Ichie brings together Japanese matcha drinks and sweets with a selection of matcha and accessories to take home. This page gathers the practical information you need when looking for matcha in Nice or planning a visit.",
      "Drinks and desserts from the menu are enjoyed at the shop. Shop products can also be ordered online for pickup in Nice or delivery across metropolitan France under the conditions shown at checkout.",
    ],
  },
  {
    titleFr: "Boire un matcha à Nice",
    titleEn: "Drink matcha in Nice",
    bodyFr: [
      "La carte permet de découvrir le matcha sous plusieurs formes, du matcha préparé simplement aux boissons gourmandes. La sélection affichée plus bas est tirée du menu actuel afin de ne pas présenter de références qui ne figurent plus à la carte.",
      "Si vous souhaitez surtout comprendre quel type de matcha choisir pour la maison, nos guides expliquent les différences entre usucha, koicha, matcha pour latte et références orientées dégustation.",
    ],
    bodyEn: [
      "The menu lets you discover matcha in several forms, from simple preparations to more indulgent drinks. The selection shown below is taken from the current menu so this page does not advertise items that are no longer listed.",
      "If your main goal is choosing matcha to prepare at home, our guides explain the differences between usucha, koicha, latte-focused matcha and tasting-oriented selections.",
    ],
  },
  {
    titleFr: "Acheter du matcha japonais à Nice",
    titleEn: "Buy Japanese matcha in Nice",
    bodyFr: [
      "La Boutique présente les références actuellement disponibles avec leurs formats, prix, stock, usages conseillés et avis clients lorsqu’ils sont activés. Les cartes produits de cette page utilisent exactement les mêmes données que la Boutique principale.",
      "Vous pouvez donc comparer ici une sélection puis ouvrir chaque fiche produit pour consulter l’origine, le profil et les formats disponibles avant de commander.",
    ],
    bodyEn: [
      "The Shop shows currently available products with pack sizes, prices, stock, intended uses and customer reviews when enabled. The product cards on this page use exactly the same data as the main Shop.",
      "You can compare a selection here, then open each product page to review origin, profile and available formats before ordering.",
    ],
  },
] as const;

export function buildMatchaNiceFaq(
  store: MatchaNiceStoreInfo,
): MatchaNiceFaq[] {
  const addressFr =
    store.address ||
    "Consultez la section « La maison » du site pour l’adresse à jour.";
  const addressEn =
    store.address ||
    "See the “Our house” section of the website for the current address.";
  const hoursFr =
    store.openingHours ||
    "Les horaires à jour sont affichés dans la section « La maison » et dans le pied de page.";
  const hoursEn =
    store.openingHours ||
    "Current opening hours are shown in the “Our house” section and in the footer.";

  return [
    {
      questionFr: "Où boire du matcha à Nice ?",
      questionEn: "Where can I drink matcha in Nice?",
      answerFr:
        "Ichigo Ichie est une maison de matcha dans le Vieux Nice avec une carte de boissons et douceurs japonaises. La disponibilité exacte des boissons dépend de la carte actuelle affichée sur le site.",
      answerEn:
        "Ichigo Ichie is a matcha house in Vieux Nice with Japanese matcha drinks and sweets. Exact drink availability follows the current menu shown on the website.",
    },
    {
      questionFr: "Où se trouve Ichigo Ichie à Nice ?",
      questionEn: "Where is Ichigo Ichie in Nice?",
      answerFr: `La maison se trouve à ${addressFr}. Utilisez le lien Itinéraire de cette page pour ouvrir l’adresse dans Maps.`,
      answerEn: `The shop is located at ${addressEn}. Use the Directions link on this page to open the address in Maps.`,
    },
    {
      questionFr: "Quels sont les horaires de la boutique ?",
      questionEn: "What are the shop opening hours?",
      answerFr: `Horaires affichés actuellement : ${hoursFr}.`,
      answerEn: `Opening hours currently displayed: ${hoursEn}.`,
    },
    {
      questionFr: "Peut-on acheter du matcha japonais sur place à Nice ?",
      questionEn: "Can I buy Japanese matcha in person in Nice?",
      answerFr:
        "La Boutique Ichigo Ichie propose des matchas et accessoires. Les références présentées sur cette page proviennent du catalogue actuel ; ouvrez une fiche produit pour vérifier le stock et les formats disponibles.",
      answerEn:
        "The Ichigo Ichie Shop offers matcha and accessories. Products shown on this page come from the current catalogue; open a product page to check stock and available formats.",
    },
    {
      questionFr: "Peut-on commander en ligne et retirer à Nice ?",
      questionEn: "Can I order online and pick up in Nice?",
      answerFr:
        "Oui, le checkout propose le retrait à Nice pour les produits commandables en ligne lorsque cette option est disponible pour la commande.",
      answerEn:
        "Yes. Checkout offers pickup in Nice for online-orderable products when that option is available for the order.",
    },
  ];
}
