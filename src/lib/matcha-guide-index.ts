export type MatchaGuideSummary = {
  slug: string;
  href: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  eyebrowFr: string;
  eyebrowEn: string;
  readingMinutes: number;
};

export const MATCHA_GUIDE_SUMMARIES: MatchaGuideSummary[] = [
  {
    slug: "comment-choisir-son-matcha",
    href: "/guides/comment-choisir-son-matcha",
    titleFr: "Comment choisir son matcha japonais ?",
    titleEn: "How to choose Japanese matcha",
    descriptionFr:
      "Usucha, koicha, latte, origine, cultivar et fraîcheur : les critères utiles pour choisir sans se fier uniquement au mot « cérémonie ».",
    descriptionEn:
      "Usucha, koicha, latte, origin, cultivar and freshness: the useful criteria for choosing beyond the word “ceremonial”.",
    eyebrowFr: "GUIDE D’ACHAT",
    eyebrowEn: "BUYING GUIDE",
    readingMinutes: 6,
  },
  {
    slug: "usucha-vs-koicha",
    href: "/guides/usucha-vs-koicha",
    titleFr: "Usucha vs koicha : quelle différence ?",
    titleEn: "Usucha vs koicha: what is the difference?",
    descriptionFr:
      "Dosage, quantité d’eau, texture et profil de matcha : comprendre les deux préparations traditionnelles avant de choisir.",
    descriptionEn:
      "Dose, water, texture and matcha profile: understand the two traditional preparations before choosing.",
    eyebrowFr: "PRÉPARATION",
    eyebrowEn: "PREPARATION",
    readingMinutes: 5,
  },
  {
    slug: "matcha-ceremonie-vs-latte",
    href: "/guides/matcha-ceremonie-vs-latte",
    titleFr: "Matcha cérémonie ou matcha latte ?",
    titleEn: "Ceremonial matcha or matcha latte?",
    descriptionFr:
      "Pourquoi le meilleur matcha à l’eau n’est pas toujours le meilleur avec du lait, et comment choisir selon l’usage réel.",
    descriptionEn:
      "Why the best matcha for water is not always the best with milk, and how to choose for the way you actually drink it.",
    eyebrowFr: "CHOISIR PAR USAGE",
    eyebrowEn: "CHOOSE BY USE",
    readingMinutes: 5,
  },
];

export function getMatchaGuideSummary(slug: string) {
  return MATCHA_GUIDE_SUMMARIES.find((guide) => guide.slug === slug) ?? null;
}
