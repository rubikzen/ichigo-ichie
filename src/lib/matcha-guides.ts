import {
  MATCHA_GUIDE_SUMMARIES,
  type MatchaGuideSummary,
} from "@/lib/matcha-guide-index";
import type { MatchaFinderTag } from "@/lib/product-merchandising";

export type MatchaGuideSection = {
  titleFr: string;
  titleEn: string;
  bodyFr: string[];
  bodyEn: string[];
  bulletsFr?: string[];
  bulletsEn?: string[];
  noteFr?: string;
  noteEn?: string;
};

export type MatchaGuideFaq = {
  questionFr: string;
  questionEn: string;
  answerFr: string;
  answerEn: string;
};

export type MatchaGuide = MatchaGuideSummary & {
  updatedAt: string;
  introFr: string;
  introEn: string;
  takeawaysFr: string[];
  takeawaysEn: string[];
  sections: MatchaGuideSection[];
  faq: MatchaGuideFaq[];
  recommendedTags: MatchaFinderTag[];
};

const summaries = Object.fromEntries(
  MATCHA_GUIDE_SUMMARIES.map((guide) => [guide.slug, guide]),
) as Record<string, MatchaGuideSummary>;

export const MATCHA_GUIDES: MatchaGuide[] = [
  {
    ...summaries["comment-choisir-son-matcha"],
    updatedAt: "2026-08-22",
    introFr:
      "Un bon matcha ne se choisit pas uniquement à sa couleur ou à une mention marketing. Le meilleur choix dépend surtout de la façon dont vous allez le préparer, du profil gustatif que vous aimez et de la fraîcheur du produit.",
    introEn:
      "Good matcha is not chosen by colour or a marketing label alone. The best choice depends mainly on how you plan to prepare it, the flavour profile you enjoy and freshness.",
    takeawaysFr: [
      "Choisissez d’abord par usage : usucha, koicha ou latte.",
      "Pour boire à l’eau, recherchez équilibre, umami et faible astringence.",
      "Pour un latte, privilégiez un matcha capable de rester présent avec le lait.",
      "La fraîcheur, l’étanchéité du conditionnement et une petite boîte comptent autant que les mots sur l’étiquette.",
    ],
    takeawaysEn: [
      "Choose by use first: usucha, koicha or latte.",
      "For water, look for balance, umami and low astringency.",
      "For latte, choose a matcha with enough presence to remain expressive with milk.",
      "Freshness, airtight packaging and a small tin matter as much as label wording.",
    ],
    sections: [
      {
        titleFr: "1. Commencer par l’usage",
        titleEn: "1. Start with how you will use it",
        bodyFr: [
          "Le même matcha ne donne pas forcément son meilleur résultat dans toutes les préparations. Un profil très fin et délicat peut être magnifique en usucha mais disparaître dans un grand latte.",
          "À l’inverse, un matcha plus franc, légèrement plus intense, peut être excellent avec du lait tout en étant moins adapté à une dégustation très concentrée à l’eau.",
        ],
        bodyEn: [
          "The same matcha will not necessarily perform best in every preparation. A very delicate profile can be beautiful as usucha yet disappear in a large latte.",
          "Conversely, a more assertive matcha can be excellent with milk while being less suited to a very concentrated water preparation.",
        ],
        bulletsFr: [
          "Usucha : matcha fouetté léger, quotidien ou dégustation.",
          "Koicha : préparation épaisse, très concentrée, qui demande un matcha doux et peu astringent.",
          "Latte : profil suffisamment intense pour rester lisible avec le lait.",
          "Cuisine/pâtisserie : priorité à l’intensité et au rapport qualité-prix plutôt qu’à la finesse aromatique.",
        ],
        bulletsEn: [
          "Usucha: light whisked matcha for everyday drinking or tasting.",
          "Koicha: thick, concentrated preparation requiring a gentle, low-astringency matcha.",
          "Latte: enough intensity to remain clear through milk.",
          "Cooking/baking: prioritise intensity and value rather than subtle aromatic detail.",
        ],
      },
      {
        titleFr: "2. Lire le profil plutôt que le mot « grade »",
        titleEn: "2. Read the flavour profile, not just the “grade”",
        bodyFr: [
          "Les mentions comme « ceremonial grade » ne constituent pas une classification légale universelle au Japon. Elles peuvent aider à comprendre le positionnement d’un produit, mais elles ne remplacent pas les informations concrètes sur l’origine, l’usage conseillé et le goût.",
          "Pour une dégustation à l’eau, recherchez un équilibre entre umami, douceur, amertume et astringence. Une légère amertume n’est pas un défaut : c’est l’équilibre général qui compte.",
        ],
        bodyEn: [
          "Labels such as “ceremonial grade” are not a universal legal grading system in Japan. They can indicate positioning, but they do not replace concrete information about origin, intended use and taste.",
          "For drinking with water, look for balance between umami, sweetness, bitterness and astringency. A little bitterness is not automatically a flaw; overall balance matters.",
        ],
      },
      {
        titleFr: "3. Origine, cultivar et récolte : utiles, mais pas seuls",
        titleEn: "3. Origin, cultivar and harvest: useful, but not enough alone",
        bodyFr: [
          "Uji, Yame, Shizuoka ou Kagoshima peuvent produire d’excellents matchas avec des styles différents. Le nom d’une région n’est donc pas, à lui seul, une garantie de qualité.",
          "Le cultivar peut donner des indices : certains sont connus pour leur douceur ou leur umami, d’autres pour une expression plus végétale. Mais le terroir, l’ombrage, la transformation et la fraîcheur influencent également fortement la tasse.",
        ],
        bodyEn: [
          "Uji, Yame, Shizuoka and Kagoshima can all produce excellent matcha in different styles. A regional name alone is not a guarantee of quality.",
          "Cultivar can offer clues: some are known for sweetness or umami, others for a greener expression. Terroir, shading, processing and freshness also strongly influence the cup.",
        ],
      },
      {
        titleFr: "4. Fraîcheur et conservation",
        titleEn: "4. Freshness and storage",
        bodyFr: [
          "Le matcha est une poudre très fine : l’air, la lumière, la chaleur et l’humidité accélèrent la perte d’arômes. Une boîte de 20 à 40 g est souvent pratique si vous buvez une portion par jour.",
          "Après ouverture, gardez le matcha parfaitement fermé, au frais, au sec et à l’abri de la lumière. Si vous le conservez au réfrigérateur, laissez le contenant fermé revenir à température avant de l’ouvrir afin d’éviter la condensation.",
        ],
        bodyEn: [
          "Matcha is an extremely fine powder, so air, light, heat and moisture accelerate flavour loss. A 20–40 g tin is often practical if you drink one serving a day.",
          "After opening, keep matcha tightly sealed, cool, dry and away from light. If refrigerated, allow the closed container to come back toward room temperature before opening to reduce condensation risk.",
        ],
      },
      {
        titleFr: "5. Une règle simple pour commencer",
        titleEn: "5. A simple starting rule",
        bodyFr: [
          "Pour découvrir un matcha à l’eau, commencez autour de 2 g de poudre pour 60 à 70 ml d’eau à environ 70–80 °C. Ajustez ensuite la quantité d’eau selon votre goût.",
          "Si vous hésitez entre plusieurs références, choisissez celle dont l’usage recommandé correspond réellement à votre rituel. C’est généralement plus fiable qu’un classement abstrait du « moins bon » au « meilleur ».",
        ],
        bodyEn: [
          "To discover a matcha with water, start around 2 g of powder for 60–70 ml of water at roughly 70–80 °C, then adjust the water to your taste.",
          "If you are choosing between several matchas, pick the one whose recommended use matches your actual ritual. That is usually more useful than an abstract “good to best” ladder.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Comment reconnaître un bon matcha ?",
        questionEn: "How can I recognise good matcha?",
        answerFr:
          "Regardez surtout la fraîcheur, le goût, l’usage conseillé, l’origine et la transparence des informations. Une couleur vive est intéressante, mais elle ne suffit pas à juger seule la qualité.",
        answerEn:
          "Look at freshness, taste, intended use, origin and how transparent the product information is. A vivid colour can be positive, but colour alone is not enough to judge quality.",
      },
      {
        questionFr: "Le matcha « cérémonie » est-il toujours le meilleur ?",
        questionEn: "Is “ceremonial” matcha always the best?",
        answerFr:
          "Non. « Cérémonie » n’est pas un grade légal universel. Un matcha très fin pour l’eau peut aussi être inutilement subtil et coûteux dans un latte.",
        answerEn:
          "No. “Ceremonial” is not a universal legal grade. A very refined matcha for water can also be unnecessarily subtle and expensive in a latte.",
      },
      {
        questionFr: "Quel matcha choisir pour débuter ?",
        questionEn: "Which matcha should a beginner choose?",
        answerFr:
          "Un matcha équilibré recommandé pour l’usucha est généralement le point de départ le plus simple. Il permet de découvrir le goût pur et reste facile à ajuster.",
        answerEn:
          "A balanced matcha recommended for usucha is usually the easiest starting point. It lets you discover the pure flavour while remaining easy to adjust.",
      },
      {
        questionFr: "Combien de temps utiliser une boîte après ouverture ?",
        questionEn: "How quickly should I use a tin after opening?",
        answerFr:
          "Il n’existe pas un nombre de jours unique pour tous les produits, mais le matcha perd progressivement son éclat après ouverture. Une petite boîte consommée régulièrement limite le temps d’exposition à l’air.",
        answerEn:
          "There is no single number of days for every product, but matcha gradually loses vibrancy once opened. A small tin used regularly limits exposure time.",
      },
    ],
    recommendedTags: ["daily", "usucha", "ceremonial"],
  },
  {
    ...summaries["usucha-vs-koicha"],
    updatedAt: "2026-08-22",
    introFr:
      "Usucha et koicha utilisent tous les deux du matcha et de l’eau, mais le résultat est très différent. L’usucha est léger et fouetté ; le koicha est dense, concentré et travaillé sans chercher une mousse abondante.",
    introEn:
      "Usucha and koicha both use matcha and water, but the result is very different. Usucha is light and whisked; koicha is dense, concentrated and mixed without aiming for a large foam.",
    takeawaysFr: [
      "Usucha : environ 2 g de matcha pour 60–70 ml d’eau.",
      "Koicha : environ 3,5–4 g pour 25–35 ml d’eau.",
      "Le koicha concentre beaucoup plus le goût et révèle immédiatement l’astringence.",
      "Un matcha agréable en usucha n’est pas automatiquement adapté au koicha.",
    ],
    takeawaysEn: [
      "Usucha: around 2 g matcha for 60–70 ml water.",
      "Koicha: around 3.5–4 g for 25–35 ml water.",
      "Koicha concentrates flavour much more and exposes astringency immediately.",
      "A matcha that is pleasant as usucha is not automatically suitable for koicha.",
    ],
    sections: [
      {
        titleFr: "1. Qu’est-ce que l’usucha ?",
        titleEn: "1. What is usucha?",
        bodyFr: [
          "Usucha signifie littéralement « thé léger ». C’est la forme de matcha fouetté la plus facile à intégrer au quotidien : fluide, aromatique et généralement recouverte d’une mousse fine.",
          "Un point de départ pratique est 2 g de matcha pour 60 à 70 ml d’eau autour de 70–80 °C. Fouettez rapidement au chasen jusqu’à obtenir une texture homogène.",
        ],
        bodyEn: [
          "Usucha literally means “thin tea”. It is the easiest whisked matcha style to make part of an everyday ritual: fluid, aromatic and usually finished with a fine foam.",
          "A practical starting point is 2 g matcha for 60–70 ml water around 70–80 °C. Whisk briskly with a chasen until smooth.",
        ],
      },
      {
        titleFr: "2. Qu’est-ce que le koicha ?",
        titleEn: "2. What is koicha?",
        bodyFr: [
          "Koicha signifie « thé épais ». On utilise beaucoup plus de matcha et nettement moins d’eau. La texture devient dense, presque sirupeuse, et la préparation se travaille lentement plutôt qu’en cherchant une mousse.",
          "Commencez autour de 3,5 à 4 g de matcha pour 25 à 35 ml d’eau. Le koicha étant très concentré, un matcha doux, riche en umami et peu astringent est généralement préférable.",
        ],
        bodyEn: [
          "Koicha means “thick tea”. It uses much more matcha and far less water. The texture becomes dense, almost syrupy, and it is worked slowly rather than whisked to create foam.",
          "Start around 3.5–4 g matcha for 25–35 ml water. Because koicha is highly concentrated, a gentle, umami-rich, low-astringency matcha is generally preferable.",
        ],
      },
      {
        titleFr: "3. Comparaison rapide",
        titleEn: "3. Quick comparison",
        bodyFr: [
          "L’usucha met en avant l’équilibre général et convient à une grande variété de matchas. Le koicha grossit chaque détail : douceur, umami, amertume, astringence et texture.",
        ],
        bodyEn: [
          "Usucha highlights overall balance and suits a wide range of matchas. Koicha magnifies every detail: sweetness, umami, bitterness, astringency and texture.",
        ],
        bulletsFr: [
          "Usucha : 2 g · 60–70 ml · texture fluide · mousse fine.",
          "Koicha : 3,5–4 g · 25–35 ml · texture dense · peu ou pas de mousse.",
          "Usucha : idéal pour découvrir une référence.",
          "Koicha : à réserver aux matchas explicitement adaptés ou très doux.",
        ],
        bulletsEn: [
          "Usucha: 2 g · 60–70 ml · fluid texture · fine foam.",
          "Koicha: 3.5–4 g · 25–35 ml · dense texture · little or no foam.",
          "Usucha: ideal for discovering a matcha.",
          "Koicha: best reserved for matchas specifically suited to it or naturally very gentle.",
        ],
      },
      {
        titleFr: "4. Pourquoi le choix du matcha change",
        titleEn: "4. Why the matcha choice changes",
        bodyFr: [
          "En usucha, l’eau dilue davantage les composés aromatiques et l’on peut apprécier des profils végétaux, frais ou légèrement toniques. En koicha, la concentration rend une astringence excessive beaucoup plus évidente.",
          "C’est pourquoi un matcha vendu comme haut de gamme n’est pas automatiquement un matcha à koicha : le profil réel et la recommandation du producteur restent plus utiles que le prix seul.",
        ],
        bodyEn: [
          "In usucha, more water dilutes the aromatic compounds, allowing fresh, vegetal or gently brisk profiles to work well. In koicha, concentration makes excessive astringency far more obvious.",
          "That is why an expensive matcha is not automatically a koicha matcha: its actual profile and the producer’s intended use are more useful than price alone.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Peut-on préparer n’importe quel matcha en koicha ?",
        questionEn: "Can any matcha be prepared as koicha?",
        answerFr:
          "Techniquement oui, mais le résultat peut devenir très amer ou astringent. Pour le koicha, choisissez de préférence un matcha explicitement recommandé pour cet usage ou connu pour sa douceur.",
        answerEn:
          "Technically yes, but the result can become very bitter or astringent. For koicha, prefer a matcha explicitly recommended for that use or known for gentleness.",
      },
      {
        questionFr: "Faut-il faire de la mousse avec le koicha ?",
        questionEn: "Should koicha be foamy?",
        answerFr:
          "Non. Le koicha se travaille pour obtenir une texture lisse et dense ; on ne cherche pas la mousse abondante typique de l’usucha.",
        answerEn:
          "No. Koicha is worked into a smooth, dense texture; the abundant foam associated with usucha is not the goal.",
      },
      {
        questionFr: "Quelle température d’eau utiliser ?",
        questionEn: "What water temperature should I use?",
        answerFr:
          "Autour de 70–80 °C est un bon point de départ pour l’usucha. Pour le koicha, une eau autour de 70 °C permet souvent de préserver davantage de douceur. Ajustez selon le matcha.",
        answerEn:
          "Around 70–80 °C is a useful starting point for usucha. For koicha, water around 70 °C often helps preserve sweetness. Adjust to the matcha.",
      },
    ],
    recommendedTags: ["usucha", "koicha"],
  },
  {
    ...summaries["matcha-ceremonie-vs-latte"],
    updatedAt: "2026-08-22",
    introFr:
      "Le mot « cérémonie » est souvent utilisé comme raccourci pour parler d’un matcha destiné à être bu à l’eau. Mais ce n’est pas une norme légale universelle. Pour bien acheter, mieux vaut comparer le profil et l’usage conseillé.",
    introEn:
      "The word “ceremonial” is often used as shorthand for matcha intended to be drunk with water, but it is not a universal legal standard. A better purchase decision comes from flavour profile and intended use.",
    takeawaysFr: [
      "« Ceremonial grade » n’est pas une classification légale universelle au Japon.",
      "Pour l’eau, la finesse, l’umami et la faible astringence sont prioritaires.",
      "Pour un latte, l’intensité et la présence aromatique avec le lait comptent davantage.",
      "Utiliser un matcha très délicat dans beaucoup de lait peut masquer ce que vous payez en plus.",
    ],
    takeawaysEn: [
      "“Ceremonial grade” is not a universal legal classification in Japan.",
      "For water, refinement, umami and low astringency matter most.",
      "For latte, intensity and aromatic presence through milk matter more.",
      "Using a very delicate matcha in lots of milk can hide the qualities you paid extra for.",
    ],
    sections: [
      {
        titleFr: "1. Ce que signifie vraiment « cérémonie »",
        titleEn: "1. What “ceremonial” really means",
        bodyFr: [
          "Dans le commerce international, « ceremonial grade » indique généralement un positionnement destiné à la dégustation à l’eau. Il n’existe cependant pas une autorité japonaise unique attribuant ce grade à tous les matchas.",
          "Il faut donc lire cette mention comme une indication commerciale, puis regarder le goût, l’origine, le cultivar et surtout l’usage recommandé.",
        ],
        bodyEn: [
          "In international retail, “ceremonial grade” generally signals a matcha positioned for drinking with water. However, there is no single Japanese authority assigning this grade to every matcha.",
          "Treat the term as a commercial indication, then look at taste, origin, cultivar and, most importantly, intended use.",
        ],
      },
      {
        titleFr: "2. Ce qui fonctionne à l’eau",
        titleEn: "2. What works with water",
        bodyFr: [
          "Sans lait ni sucre, rien ne masque le matcha. Un produit destiné à l’usucha ou au koicha doit donc rester équilibré seul : douceur, umami, texture et astringence maîtrisée.",
          "C’est ici que les nuances aromatiques et la longueur en bouche justifient le plus facilement une référence plus fine.",
        ],
        bodyEn: [
          "With no milk or sugar, nothing masks the matcha. A product for usucha or koicha should therefore remain balanced on its own: sweetness, umami, texture and controlled astringency.",
          "This is where aromatic nuance and finish most clearly justify a more refined matcha.",
        ],
      },
      {
        titleFr: "3. Ce qui fonctionne dans un latte",
        titleEn: "3. What works in a latte",
        bodyFr: [
          "Le lait adoucit l’amertume mais atténue aussi les notes délicates. Un matcha à latte réussi a donc besoin d’une couleur agréable, mais surtout d’une expression végétale et aromatique assez nette pour rester perceptible.",
          "Un matcha de bonne qualité conçu pour le latte n’est pas un « mauvais matcha ». Il est simplement optimisé pour une préparation différente.",
        ],
        bodyEn: [
          "Milk softens bitterness but also mutes delicate notes. A successful latte matcha therefore needs pleasant colour, but above all a clear vegetal and aromatic presence that remains noticeable.",
          "A good-quality matcha designed for latte is not “bad matcha”. It is simply optimised for a different preparation.",
        ],
      },
      {
        titleFr: "4. Choisir selon votre tasse réelle",
        titleEn: "4. Choose for the cup you actually drink",
        bodyFr: [
          "Si vous buvez principalement votre matcha pur, investissez dans le profil que vous aimez à l’eau. Si vous préparez presque toujours des lattes, choisissez une référence recommandée pour le lait plutôt que de payer davantage pour des nuances qui seront masquées.",
          "Si vous alternez les deux, un matcha polyvalent recommandé à la fois pour usucha et latte constitue souvent le meilleur compromis.",
        ],
        bodyEn: [
          "If you mainly drink matcha pure, invest in the profile you enjoy with water. If you almost always make lattes, choose a matcha recommended for milk instead of paying more for nuances that will be masked.",
          "If you alternate between both, a versatile matcha recommended for both usucha and latte is often the best compromise.",
        ],
        bulletsFr: [
          "Eau / usucha : finesse et équilibre.",
          "Koicha : douceur et très faible astringence.",
          "Latte : intensité, corps et présence aromatique.",
          "Polyvalent : profil suffisamment doux à l’eau mais assez expressif avec le lait.",
        ],
        bulletsEn: [
          "Water / usucha: refinement and balance.",
          "Koicha: gentleness and very low astringency.",
          "Latte: intensity, body and aromatic presence.",
          "Versatile: gentle enough with water but expressive enough with milk.",
        ],
      },
    ],
    faq: [
      {
        questionFr: "Le matcha cérémonie est-il un grade officiel ?",
        questionEn: "Is ceremonial matcha an official grade?",
        answerFr:
          "Il n’existe pas de système légal universel japonais définissant un « ceremonial grade » pour tous les producteurs. Le terme décrit surtout un positionnement destiné à la dégustation à l’eau.",
        answerEn:
          "There is no universal Japanese legal system defining “ceremonial grade” for all producers. The term mainly describes positioning for drinking with water.",
      },
      {
        questionFr: "Peut-on utiliser un matcha cérémonie en latte ?",
        questionEn: "Can ceremonial matcha be used in a latte?",
        answerFr:
          "Oui, mais un lait abondant peut masquer ses nuances les plus fines. Ce n’est donc pas toujours le meilleur rapport entre plaisir et prix.",
        answerEn:
          "Yes, but a generous amount of milk can hide its finest nuances, so it is not always the best balance of enjoyment and price.",
      },
      {
        questionFr: "Un matcha à latte peut-il se boire à l’eau ?",
        questionEn: "Can latte matcha be drunk with water?",
        answerFr:
          "Oui s’il vous plaît ainsi, mais il peut être plus intense ou astringent. Les recommandations d’usage servent à indiquer le contexte dans lequel son profil est généralement le plus équilibré.",
        answerEn:
          "Yes, if you enjoy it that way, but it may taste more intense or astringent. Intended-use recommendations indicate where its profile is generally most balanced.",
      },
    ],
    recommendedTags: ["ceremonial", "latte"],
  },
];

export function getMatchaGuide(slug: string) {
  return MATCHA_GUIDES.find((guide) => guide.slug === slug) ?? null;
}
