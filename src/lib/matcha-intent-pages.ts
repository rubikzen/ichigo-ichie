import type { Metadata } from "next";
import {
  MATCHA_INTENT_SUMMARIES,
  configureMatchaIntentSummary,
  getMatchaIntentSummary,
  matchaIntentSettingPrefix,
  type MatchaIntentSettings,
  type MatchaIntentSummary,
} from "@/lib/matcha-intent-index";

export type MatchaIntentFaq = {
  questionFr: string;
  questionEn: string;
  answerFr: string;
  answerEn: string;
};

export type MatchaIntentSection = {
  titleFr: string;
  titleEn: string;
  paragraphsFr: string[];
  paragraphsEn: string[];
  bulletsFr?: string[];
  bulletsEn?: string[];
};

export type MatchaIntentPage = MatchaIntentSummary & {
  eyebrowFr: string;
  eyebrowEn: string;
  metaTitleFr: string;
  metaDescriptionFr: string;
  introFr: string;
  introEn: string;
  factsFr: string[];
  factsEn: string[];
  selectionTitleFr: string;
  selectionTitleEn: string;
  selectionIntroFr: string;
  selectionIntroEn: string;
  sections: MatchaIntentSection[];
  faq: MatchaIntentFaq[];
};

function summary(tag: MatchaIntentSummary["tag"]) {
  const found = getMatchaIntentSummary(tag);
  if (!found) throw new Error(`Missing matcha intent summary: ${tag}`);
  return found;
}

export const MATCHA_INTENT_PAGES: MatchaIntentPage[] = [
  {
    ...summary("usucha"),
    eyebrowFr: "MATCHA À L’EAU",
    eyebrowEn: "MATCHA WITH WATER",
    metaTitleFr: "Matcha Usucha japonais | Sélection pour thé fouetté",
    metaDescriptionFr:
      "Découvrez nos matchas japonais recommandés pour l’usucha : profils équilibrés à boire à l’eau, conseils de dosage et sélection issue du catalogue Ichigo Ichie.",
    introFr:
      "L’usucha est la préparation la plus accessible pour découvrir un matcha pur. La tasse reste fluide, aromatique et suffisamment légère pour révéler l’équilibre entre umami, douceur, végétal, amertume et astringence.",
    introEn:
      "Usucha is the most accessible way to discover matcha on its own. The cup stays fluid and aromatic, making it easier to read the balance between umami, sweetness, vegetal notes, bitterness and astringency.",
    factsFr: [
      "Point de départ : environ 2 g de matcha",
      "60–70 ml d’eau",
      "Environ 70–80 °C",
    ],
    factsEn: [
      "Starting point: about 2 g matcha",
      "60–70 ml water",
      "Around 70–80 °C",
    ],
    selectionTitleFr: "Nos matchas recommandés pour l’usucha",
    selectionTitleEn: "Our matcha recommended for usucha",
    selectionIntroFr:
      "Cette sélection est générée depuis les usages renseignés dans notre catalogue actuel. Prix, formats, stock et avis restent ceux des fiches produits en temps réel.",
    selectionIntroEn:
      "This selection is generated from the intended uses in our current catalogue. Prices, formats, stock and reviews remain the live product-page values.",
    sections: [
      {
        titleFr: "Quel profil choisir pour l’usucha ?",
        titleEn: "What profile works well for usucha?",
        paragraphsFr: [
          "Pour une dégustation sans lait ni sucre, le matcha doit être agréable par lui-même. Un bon usucha n’a pas besoin d’être totalement dépourvu d’amertume : le plus important est que l’ensemble reste harmonieux et que l’astringence ne domine pas.",
          "Si vous débutez, un profil équilibré et polyvalent est généralement plus simple qu’un matcha extrêmement concentré en umami ou très végétal.",
        ],
        paragraphsEn: [
          "Without milk or sugar, matcha has to be enjoyable on its own. Good usucha does not need to be completely free of bitterness; what matters is harmony and keeping astringency from dominating.",
          "If you are starting out, a balanced and versatile profile is usually easier than an extremely umami-heavy or intensely vegetal matcha.",
        ],
      },
      {
        titleFr: "Comment préparer une première tasse",
        titleEn: "How to prepare a first bowl",
        paragraphsFr: [
          "Tamisez environ 2 g de matcha, ajoutez 60 à 70 ml d’eau autour de 70–80 °C, puis fouettez rapidement au chasen. Ajustez ensuite l’eau plutôt que de changer plusieurs variables à la fois.",
        ],
        paragraphsEn: [
          "Sift about 2 g matcha, add 60–70 ml water around 70–80 °C, then whisk briskly with a chasen. Adjust the water afterwards rather than changing several variables at once.",
        ],
        bulletsFr: [
          "Plus d’eau : tasse plus douce et légère.",
          "Moins d’eau : profil plus dense et intense.",
          "Eau trop chaude : l’amertume peut devenir plus présente.",
        ],
        bulletsEn: [
          "More water: softer, lighter cup.",
          "Less water: denser, more intense profile.",
          "Water that is too hot can make bitterness more prominent.",
        ],
      },
      {
        titleFr: "Usucha et fraîcheur",
        titleEn: "Usucha and freshness",
        paragraphsFr: [
          "Comme rien ne masque le thé, la fraîcheur se ressent rapidement. Refermez soigneusement la boîte après chaque utilisation et évitez chaleur, lumière et humidité.",
        ],
        paragraphsEn: [
          "Because nothing masks the tea, freshness is easy to notice. Seal the tin carefully after every use and protect it from heat, light and moisture.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Combien de grammes de matcha pour un usucha ?",
        questionEn: "How much matcha for usucha?",
        answerFr:
          "Environ 2 g pour 60 à 70 ml d’eau est un bon point de départ. Vous pouvez ensuite ajuster selon le matcha et votre goût.",
        answerEn:
          "About 2 g for 60–70 ml water is a useful starting point. You can then adjust for the matcha and your taste.",
      },
      {
        questionFr: "Peut-on utiliser un matcha à koicha en usucha ?",
        questionEn: "Can koicha matcha be used for usucha?",
        answerFr:
          "Oui. Un matcha suffisamment doux pour le koicha peut généralement être préparé en usucha avec davantage d’eau.",
        answerEn:
          "Yes. A matcha gentle enough for koicha can generally be prepared as usucha with more water.",
      },
      {
        questionFr: "Faut-il absolument obtenir beaucoup de mousse ?",
        questionEn: "Do I need a lot of foam?",
        answerFr:
          "Non. Une mousse fine peut rendre la texture agréable, mais la qualité de la tasse ne se résume pas à son volume de mousse.",
        answerEn:
          "No. Fine foam can make the texture pleasant, but cup quality is not defined by foam volume alone.",
      },
    ],
  },
  {
    ...summary("koicha"),
    eyebrowFr: "THÉ ÉPAIS",
    eyebrowEn: "THICK TEA",
    metaTitleFr: "Matcha Koicha japonais | Sélection pour thé épais",
    metaDescriptionFr:
      "Découvrez nos matchas japonais recommandés pour le koicha : douceur, umami, faible astringence, conseils de dosage et sélection actuelle Ichigo Ichie.",
    introFr:
      "Le koicha utilise beaucoup plus de matcha et beaucoup moins d’eau que l’usucha. Cette concentration amplifie chaque sensation : douceur, umami, texture, amertume et astringence. Le choix du matcha devient donc particulièrement important.",
    introEn:
      "Koicha uses much more matcha and far less water than usucha. That concentration magnifies every sensation: sweetness, umami, texture, bitterness and astringency. Choosing the right matcha therefore matters especially here.",
    factsFr: [
      "Point de départ : environ 3,5–4 g",
      "25–35 ml d’eau",
      "Texture dense, peu ou pas de mousse",
    ],
    factsEn: [
      "Starting point: about 3.5–4 g",
      "25–35 ml water",
      "Dense texture, little or no foam",
    ],
    selectionTitleFr: "Nos matchas recommandés pour le koicha",
    selectionTitleEn: "Our matcha recommended for koicha",
    selectionIntroFr:
      "Nous affichons ici uniquement les références dont l’usage koicha est renseigné dans le catalogue actuel. La sélection évolue donc avec nos produits disponibles.",
    selectionIntroEn:
      "Only matcha currently marked for koicha use in our catalogue appear here, so the selection evolves with the products we carry.",
    sections: [
      {
        titleFr: "Pourquoi le koicha demande un matcha différent",
        titleEn: "Why koicha asks more from the matcha",
        paragraphsFr: [
          "Avec 25 à 35 ml d’eau, le matcha n’a presque aucune dilution. Une astringence discrète en usucha peut devenir très présente en koicha. C’est pourquoi on recherche généralement un profil doux, ample et riche en umami.",
          "Le prix seul ne suffit pas : une référence coûteuse n’est pas automatiquement conçue pour le koicha. L’usage recommandé et le profil réel restent plus utiles.",
        ],
        paragraphsEn: [
          "With only 25–35 ml water, there is very little dilution. Astringency that feels subtle in usucha can become obvious in koicha, so a gentle, broad and umami-rich profile is generally preferred.",
          "Price alone is not enough: an expensive matcha is not automatically designed for koicha. Intended use and actual flavour profile are more useful.",
        ],
      },
      {
        titleFr: "Préparer le koicha",
        titleEn: "Preparing koicha",
        paragraphsFr: [
          "Tamisez le matcha, versez une petite quantité d’eau autour de 70 °C, puis travaillez lentement au chasen pour obtenir une pâte lisse et brillante. On ne cherche pas la mousse abondante de l’usucha.",
        ],
        paragraphsEn: [
          "Sift the matcha, add a small amount of water around 70 °C, then work it slowly with the chasen into a smooth, glossy texture. The abundant foam of usucha is not the goal.",
        ],
      },
      {
        titleFr: "Commencer par l’usucha si vous hésitez",
        titleEn: "Start with usucha if you are unsure",
        paragraphsFr: [
          "Si vous découvrez une nouvelle référence, préparez-la d’abord en usucha. Vous comprendrez son équilibre avant de la concentrer en koicha.",
        ],
        paragraphsEn: [
          "When discovering a new matcha, preparing it as usucha first lets you understand its balance before concentrating it into koicha.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Peut-on faire du koicha avec n’importe quel matcha ?",
        questionEn: "Can I make koicha with any matcha?",
        answerFr:
          "Techniquement oui, mais le résultat peut être très amer ou astringent. Une référence explicitement adaptée au koicha est généralement plus sûre.",
        answerEn:
          "Technically yes, but the result can be very bitter or astringent. A matcha explicitly suited to koicha is generally a safer choice.",
      },
      {
        questionFr: "Le koicha doit-il mousser ?",
        questionEn: "Should koicha be foamy?",
        answerFr:
          "Non. Le but est une texture dense, lisse et homogène, pas une couche importante de mousse.",
        answerEn:
          "No. The goal is a dense, smooth, uniform texture rather than a large layer of foam.",
      },
      {
        questionFr: "Quelle différence avec l’usucha ?",
        questionEn: "How is it different from usucha?",
        answerFr:
          "Le koicha utilise environ deux fois plus de matcha avec beaucoup moins d’eau. Il est donc nettement plus concentré et épais.",
        answerEn:
          "Koicha uses roughly twice as much matcha with much less water, making it far more concentrated and thick.",
      },
    ],
  },
  {
    ...summary("latte"),
    eyebrowFr: "MATCHA + LAIT",
    eyebrowEn: "MATCHA + MILK",
    metaTitleFr: "Matcha Latte japonais | Quel matcha choisir pour latte",
    metaDescriptionFr:
      "Découvrez nos matchas japonais recommandés pour latte : profils aromatiques présents avec le lait, conseils de dosage et sélection actuelle Ichigo Ichie.",
    introFr:
      "Dans un latte, le lait adoucit l’amertume mais atténue aussi les notes les plus délicates. Le meilleur choix n’est donc pas nécessairement le matcha le plus subtil ou le plus cher, mais celui qui conserve une vraie présence aromatique dans votre recette.",
    introEn:
      "In a latte, milk softens bitterness but also mutes the most delicate notes. The best choice is therefore not necessarily the subtlest or most expensive matcha, but the one that keeps real aromatic presence in your recipe.",
    factsFr: [
      "Profil net et suffisamment intense",
      "Le lait masque une partie des nuances fines",
      "Choisir selon la taille réelle du latte",
    ],
    factsEn: [
      "Clear, sufficiently intense profile",
      "Milk masks some of the finest nuances",
      "Choose for the actual size of your latte",
    ],
    selectionTitleFr: "Nos matchas recommandés pour latte",
    selectionTitleEn: "Our matcha recommended for latte",
    selectionIntroFr:
      "Ces références sont identifiées comme adaptées au latte dans notre catalogue. Vous pouvez ouvrir chaque fiche pour comparer origine, formats, stock, prix et avis.",
    selectionIntroEn:
      "These matcha are identified as latte-friendly in our catalogue. Open each product page to compare origin, formats, stock, price and reviews.",
    sections: [
      {
        titleFr: "Pourquoi un matcha très fin peut disparaître dans le lait",
        titleEn: "Why a very delicate matcha can disappear in milk",
        paragraphsFr: [
          "Le lait apporte matières grasses, protéines et douceur. Ces éléments arrondissent la tasse mais réduisent la perception de certaines nuances végétales ou florales. Dans un grand latte, un matcha très délicat peut sembler moins expressif qu’une référence plus franche.",
          "Un bon matcha pour latte n’est donc pas un matcha de moindre qualité : il est choisi pour un autre contexte de dégustation.",
        ],
        paragraphsEn: [
          "Milk brings fat, protein and sweetness. These round out the drink but reduce the perception of some delicate vegetal or floral nuances. In a large latte, a very subtle matcha can feel less expressive than a more assertive one.",
          "Good latte matcha is therefore not lower-quality matcha; it is chosen for a different drinking context.",
        ],
      },
      {
        titleFr: "Dosage : adaptez-le à votre recette",
        titleEn: "Dose according to your recipe",
        paragraphsFr: [
          "Pour un latte, la quantité idéale dépend fortement du volume de lait. Commencez autour de 2 g pour une boisson modérée, puis augmentez légèrement si le goût du matcha disparaît au lieu d’ajouter systématiquement plus de sucre.",
        ],
        paragraphsEn: [
          "For latte, the ideal dose depends heavily on milk volume. Start around 2 g for a moderate drink, then increase slightly if matcha disappears instead of automatically adding more sugar.",
        ],
      },
      {
        titleFr: "Latte chaud ou glacé",
        titleEn: "Hot or iced latte",
        paragraphsFr: [
          "Dans les deux cas, délayez d’abord le matcha avec une petite quantité d’eau afin d’obtenir une base homogène. Pour une boisson glacée, cette étape limite les grumeaux avant d’ajouter lait et glaçons.",
        ],
        paragraphsEn: [
          "For both, first mix the matcha with a small amount of water to create a smooth base. For iced drinks, this helps prevent clumps before adding milk and ice.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Quel grade de matcha faut-il pour un latte ?",
        questionEn: "What matcha grade do I need for latte?",
        answerFr:
          "Il n’existe pas un grade légal universel à choisir. Regardez plutôt l’usage recommandé, l’intensité et le profil gustatif du matcha.",
        answerEn:
          "There is no universal legal grade you need. Look instead at intended use, intensity and the matcha’s flavour profile.",
      },
      {
        questionFr: "Peut-on utiliser un matcha cérémonie dans un latte ?",
        questionEn: "Can I use ceremonial matcha in a latte?",
        answerFr:
          "Oui, mais beaucoup de lait peut masquer les nuances pour lesquelles vous payez davantage. Ce n’est donc pas toujours le meilleur rapport plaisir-prix.",
        answerEn:
          "Yes, but a lot of milk can hide the nuances you are paying extra for, so it is not always the best enjoyment-to-price balance.",
      },
      {
        questionFr: "Combien de matcha mettre dans un latte ?",
        questionEn: "How much matcha should go in a latte?",
        answerFr:
          "Environ 2 g est un point de départ courant, à ajuster selon la taille de la boisson, le lait utilisé et l’intensité du matcha.",
        answerEn:
          "About 2 g is a common starting point, adjusted for drink size, milk choice and matcha intensity.",
      },
    ],
  },
  {
    ...summary("ceremonial"),
    eyebrowFr: "DÉGUSTATION",
    eyebrowEn: "TASTING",
    metaTitleFr: "Matcha cérémonie japonais | Sélection dégustation",
    metaDescriptionFr:
      "Découvrez notre sélection de matcha japonais positionnés pour la dégustation à l’eau, avec une explication transparente du terme matcha cérémonie.",
    introFr:
      "« Matcha cérémonie » est une expression courante dans le commerce pour désigner des références orientées vers la dégustation à l’eau. Ce n’est toutefois pas un grade légal universel attribué par une autorité japonaise unique. Nous l’utilisons donc comme indication d’usage, pas comme promesse absolue de qualité.",
    introEn:
      "“Ceremonial matcha” is a common retail expression for matcha positioned for drinking with water. It is not, however, a universal legal grade assigned by a single Japanese authority. We therefore use it as an intended-use signal, not as an absolute quality promise.",
    factsFr: [
      "Pensé principalement pour être bu à l’eau",
      "Le terme « cérémonie » n’est pas un grade légal universel",
      "Comparer goût, origine, cultivar et usage",
    ],
    factsEn: [
      "Primarily positioned for drinking with water",
      "“Ceremonial” is not a universal legal grade",
      "Compare taste, origin, cultivar and intended use",
    ],
    selectionTitleFr: "Notre sélection « cérémonie » actuelle",
    selectionTitleEn: "Our current “ceremonial” selection",
    selectionIntroFr:
      "Cette page reprend les références actuellement identifiées comme « cérémonie » dans les informations marchandes du catalogue. Chaque fiche produit reste la source de vérité pour ses usages, prix et disponibilités.",
    selectionIntroEn:
      "This page uses the products currently identified as “ceremonial” in our catalogue merchandising. Each product page remains the source of truth for intended use, price and availability.",
    sections: [
      {
        titleFr: "Que signifie « matcha cérémonie » ?",
        titleEn: "What does “ceremonial matcha” mean?",
        paragraphsFr: [
          "Le terme aide souvent à distinguer des matchas pensés pour l’eau de références orientées cuisine ou latte. Mais il n’existe pas de définition légale universelle qui permettrait de comparer automatiquement deux producteurs sur cette seule mention.",
          "Pour choisir, lisez donc aussi l’origine, le cultivar lorsqu’il est indiqué, les usages conseillés et surtout le profil gustatif.",
        ],
        paragraphsEn: [
          "The term often helps distinguish matcha positioned for water from products aimed at cooking or latte. But there is no universal legal definition that automatically makes two producers comparable on this wording alone.",
          "When choosing, also read the origin, cultivar when provided, intended uses and, above all, the flavour profile.",
        ],
      },
      {
        titleFr: "À l’eau, l’équilibre devient prioritaire",
        titleEn: "With water, balance becomes the priority",
        paragraphsFr: [
          "Sans lait ni sucre, douceur, umami, texture, amertume et astringence sont directement perceptibles. Une référence destinée à la dégustation doit rester plaisante dans cette configuration simple.",
        ],
        paragraphsEn: [
          "Without milk or sugar, sweetness, umami, texture, bitterness and astringency are directly perceptible. A matcha intended for tasting should remain enjoyable in this simple preparation.",
        ],
      },
      {
        titleFr: "Cérémonie ne veut pas dire koicha",
        titleEn: "Ceremonial does not automatically mean koicha",
        paragraphsFr: [
          "Un matcha agréable en usucha peut être trop astringent une fois concentré en koicha. Si le koicha est votre objectif, vérifiez que cet usage est explicitement recommandé plutôt que de vous fier au seul mot « cérémonie ».",
        ],
        paragraphsEn: [
          "A matcha that is pleasant as usucha may become too astringent when concentrated into koicha. If koicha is your goal, check that this use is explicitly recommended rather than relying on the word “ceremonial” alone.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Le matcha cérémonie est-il un grade officiel au Japon ?",
        questionEn: "Is ceremonial matcha an official grade in Japan?",
        answerFr:
          "Non, il n’existe pas de grade légal universel « ceremonial » attribué à tous les matchas japonais par une autorité unique.",
        answerEn:
          "No. There is no universal legal “ceremonial” grade assigned to all Japanese matcha by one authority.",
      },
      {
        questionFr: "Un matcha cérémonie est-il toujours meilleur ?",
        questionEn: "Is ceremonial matcha always better?",
        answerFr:
          "Non. La pertinence dépend de votre usage et de vos goûts. Une référence excellente à l’eau n’est pas forcément le meilleur choix pour un latte.",
        answerEn:
          "No. Suitability depends on how you drink it and your taste. A matcha excellent with water is not necessarily the best latte choice.",
      },
      {
        questionFr: "Comment choisir entre deux matchas cérémonie ?",
        questionEn: "How do I choose between two ceremonial matcha?",
        answerFr:
          "Comparez leur usage conseillé, leur profil gustatif, leur origine, leur cultivar lorsqu’il est indiqué, leurs formats et leur fraîcheur.",
        answerEn:
          "Compare intended use, flavour profile, origin, cultivar when listed, pack sizes and freshness.",
      },
    ],
  },
];

export function getMatchaIntentPage(
  tag: MatchaIntentSummary["tag"],
) {
  return MATCHA_INTENT_PAGES.find((page) => page.tag === tag) ?? null;
}

type ParsedIntentSection = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};

function configuredPageValue(
  settings: MatchaIntentSettings,
  key: string,
  fallback: string,
) {
  if (!Object.prototype.hasOwnProperty.call(settings, key)) return fallback;
  return settings[key] ?? fallback;
}

function configuredLines(
  settings: MatchaIntentSettings,
  key: string,
  fallback: string[],
) {
  if (!Object.prototype.hasOwnProperty.call(settings, key)) return fallback;
  return String(settings[key] ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseIntentBody(value: string): ParsedIntentSection[] {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const sections: ParsedIntentSection[] = [];
  let current: ParsedIntentSection = { title: "", paragraphs: [], bullets: [] };
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    if (text) current.paragraphs.push(text);
    paragraph = [];
  };

  const flushSection = () => {
    flushParagraph();
    if (current.title || current.paragraphs.length || current.bullets.length) {
      sections.push(current);
    }
    current = { title: "", paragraphs: [], bullets: [] };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      flushSection();
      current.title = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      const bullet = line.slice(2).trim();
      if (bullet) current.bullets.push(bullet);
      continue;
    }
    if (!line) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }

  flushSection();
  return sections;
}

export function serializeMatchaIntentBody(
  page: MatchaIntentPage,
  language: "fr" | "en",
) {
  return page.sections
    .map((section) => {
      const title = language === "fr" ? section.titleFr : section.titleEn;
      const paragraphs =
        language === "fr" ? section.paragraphsFr : section.paragraphsEn;
      const bullets = language === "fr" ? section.bulletsFr : section.bulletsEn;
      return [
        `## ${title}`,
        ...paragraphs.flatMap((paragraph) => ["", paragraph]),
        ...(bullets?.length
          ? ["", ...bullets.map((bullet) => `- ${bullet}`)]
          : []),
      ].join("\n").trim();
    })
    .join("\n\n");
}

function mergeIntentSections(
  page: MatchaIntentPage,
  bodyFr: string | undefined,
  bodyEn: string | undefined,
): MatchaIntentSection[] {
  const frOverride = bodyFr == null ? null : parseIntentBody(bodyFr);
  const enOverride = bodyEn == null ? null : parseIntentBody(bodyEn);
  if (!frOverride && !enOverride) return page.sections;

  const count = Math.max(
    frOverride?.length ?? 0,
    enOverride?.length ?? 0,
    page.sections.length,
  );

  return Array.from({ length: count }, (_, index) => {
    const fallback = page.sections[index];
    const fr = frOverride?.[index];
    const en = enOverride?.[index];

    return {
      titleFr: fr?.title || fallback?.titleFr || "",
      titleEn: en?.title || fallback?.titleEn || "",
      paragraphsFr:
        frOverride == null ? fallback?.paragraphsFr ?? [] : fr?.paragraphs ?? [],
      paragraphsEn:
        enOverride == null ? fallback?.paragraphsEn ?? [] : en?.paragraphs ?? [],
      bulletsFr: frOverride == null ? fallback?.bulletsFr : fr?.bullets,
      bulletsEn: enOverride == null ? fallback?.bulletsEn : en?.bullets,
    };
  }).filter(
    (section) =>
      section.titleFr ||
      section.titleEn ||
      section.paragraphsFr.length ||
      section.paragraphsEn.length ||
      section.bulletsFr?.length ||
      section.bulletsEn?.length,
  );
}

function parseIntentFaq(
  value: string,
): Array<{ question: string; answer: string }> {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const questionLine = lines.find((line) => /^Q\s*:/i.test(line));
      const answerIndex = lines.findIndex((line) => /^A\s*:/i.test(line));
      if (!questionLine || answerIndex < 0) return null;
      const question = questionLine.replace(/^Q\s*:\s*/i, "").trim();
      const answer = [
        lines[answerIndex].replace(/^A\s*:\s*/i, "").trim(),
        ...lines.slice(answerIndex + 1),
      ].join(" ").trim();
      return question && answer ? { question, answer } : null;
    })
    .filter(
      (item): item is { question: string; answer: string } => Boolean(item),
    );
}

export function serializeMatchaIntentFaq(
  page: MatchaIntentPage,
  language: "fr" | "en",
) {
  return page.faq
    .map((faq) =>
      language === "fr"
        ? `Q: ${faq.questionFr}\nA: ${faq.answerFr}`
        : `Q: ${faq.questionEn}\nA: ${faq.answerEn}`,
    )
    .join("\n\n");
}

function mergeIntentFaq(
  page: MatchaIntentPage,
  faqFr: string | undefined,
  faqEn: string | undefined,
): MatchaIntentFaq[] {
  const frOverride = faqFr == null ? null : parseIntentFaq(faqFr);
  const enOverride = faqEn == null ? null : parseIntentFaq(faqEn);
  if (!frOverride && !enOverride) return page.faq;

  const count = Math.max(
    frOverride?.length ?? 0,
    enOverride?.length ?? 0,
    page.faq.length,
  );

  return Array.from({ length: count }, (_, index) => {
    const fallback = page.faq[index];
    const fr = frOverride?.[index];
    const en = enOverride?.[index];
    return {
      questionFr: fr?.question || fallback?.questionFr || "",
      answerFr: fr?.answer || fallback?.answerFr || "",
      questionEn: en?.question || fallback?.questionEn || "",
      answerEn: en?.answer || fallback?.answerEn || "",
    };
  }).filter(
    (faq) =>
      faq.questionFr && faq.answerFr && faq.questionEn && faq.answerEn,
  );
}

export function getConfiguredMatchaIntentPage(
  tag: MatchaIntentSummary["tag"],
  settings: MatchaIntentSettings,
): MatchaIntentPage | null {
  const page = getMatchaIntentPage(tag);
  if (!page) return null;

  const prefix = matchaIntentSettingPrefix(tag);
  const summary = configureMatchaIntentSummary(page, settings);
  const optional = (suffix: string) =>
    Object.prototype.hasOwnProperty.call(settings, `${prefix}_${suffix}`)
      ? settings[`${prefix}_${suffix}`]
      : undefined;

  return {
    ...page,
    ...summary,
    eyebrowFr: configuredPageValue(settings, `${prefix}_eyebrow_fr`, page.eyebrowFr),
    eyebrowEn: configuredPageValue(settings, `${prefix}_eyebrow_en`, page.eyebrowEn),
    introFr: configuredPageValue(settings, `${prefix}_intro_fr`, page.introFr),
    introEn: configuredPageValue(settings, `${prefix}_intro_en`, page.introEn),
    factsFr: configuredLines(settings, `${prefix}_facts_fr`, page.factsFr),
    factsEn: configuredLines(settings, `${prefix}_facts_en`, page.factsEn),
    selectionTitleFr: configuredPageValue(
      settings,
      `${prefix}_selection_title_fr`,
      page.selectionTitleFr,
    ),
    selectionTitleEn: configuredPageValue(
      settings,
      `${prefix}_selection_title_en`,
      page.selectionTitleEn,
    ),
    selectionIntroFr: configuredPageValue(
      settings,
      `${prefix}_selection_intro_fr`,
      page.selectionIntroFr,
    ),
    selectionIntroEn: configuredPageValue(
      settings,
      `${prefix}_selection_intro_en`,
      page.selectionIntroEn,
    ),
    metaTitleFr: configuredPageValue(
      settings,
      `${prefix}_meta_title_fr`,
      page.metaTitleFr,
    ),
    metaDescriptionFr: configuredPageValue(
      settings,
      `${prefix}_meta_description_fr`,
      page.metaDescriptionFr,
    ),
    sections: mergeIntentSections(
      page,
      optional("body_fr"),
      optional("body_en"),
    ),
    faq: mergeIntentFaq(page, optional("faq_fr"), optional("faq_en")),
  };
}

export function getMatchaIntentMetadata(
  tag: MatchaIntentSummary["tag"],
  settings: MatchaIntentSettings = {},
): Metadata {
  const page =
    Object.keys(settings).length > 0
      ? getConfiguredMatchaIntentPage(tag, settings)
      : getMatchaIntentPage(tag);
  if (!page) return {};

  return {
    title: page.metaTitleFr,
    description: page.metaDescriptionFr,
    alternates: { canonical: page.href },
    openGraph: {
      type: "website",
      title: `${page.metaTitleFr} | Ichigo Ichie`,
      description: page.metaDescriptionFr,
      url: page.href,
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitleFr,
      description: page.metaDescriptionFr,
    },
  };
}
