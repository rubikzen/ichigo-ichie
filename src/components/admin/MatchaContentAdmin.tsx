"use client";

import {
  MATCHA_INTENT_PAGES,
  serializeMatchaIntentBody,
  serializeMatchaIntentFaq,
} from "@/lib/matcha-intent-pages";
import { matchaIntentSettingPrefix } from "@/lib/matcha-intent-index";

type Props = {
  settings: Record<string, string>;
  setValue: (key: string, value: string) => void;
  toggleValue: (key: string) => void;
};

function has(settings: Record<string, string>, key: string) {
  return Object.prototype.hasOwnProperty.call(settings, key);
}

export function MatchaContentAdmin({
  settings,
  setValue,
  toggleValue,
}: Props) {
  const value = (key: string, fallback: string) =>
    has(settings, key) ? settings[key] ?? "" : fallback;

  const input = (key: string, label: string, fallback: string) => (
    <label>
      {label}
      <input
        value={value(key, fallback)}
        onChange={(event) => setValue(key, event.target.value)}
      />
    </label>
  );

  const textarea = (
    key: string,
    label: string,
    fallback: string,
    rows = 4,
    help?: string,
  ) => {
    const current = value(key, fallback);
    return (
      <label className="cms-wide-field">
        {label}
        {help && <small>{help}</small>}
        <textarea
          rows={rows}
          value={current}
          onChange={(event) => setValue(key, event.target.value)}
        />
        <small>{current.length.toLocaleString("fr-FR")} caractères</small>
      </label>
    );
  };

  const bilingualInputs = (
    prefix: string,
    label: string,
    fallbackFr: string,
    fallbackEn: string,
  ) => (
    <div className="cms-bilingual">
      <h4>{label}</h4>
      <div className="form-grid">
        {input(`${prefix}_fr`, "FR", fallbackFr)}
        {input(`${prefix}_en`, "EN", fallbackEn)}
      </div>
    </div>
  );

  const bilingualAreas = (
    prefix: string,
    label: string,
    fallbackFr: string,
    fallbackEn: string,
    rows = 4,
    help?: string,
  ) => (
    <div className="cms-bilingual">
      <h4>{label}</h4>
      {help && <p className="matcha-cms-help-v482">{help}</p>}
      <div className="form-grid">
        {textarea(`${prefix}_fr`, "FR", fallbackFr, rows)}
        {textarea(`${prefix}_en`, "EN", fallbackEn, rows)}
      </div>
    </div>
  );

  return (
    <div className="matcha-content-admin-v482" data-matcha-content-admin-v482>
      <section className="cms-subsection matcha-cms-nav-v482">
        <div className="matcha-cms-section-head-v482">
          <div>
            <p className="eyebrow">NAVIGATION MATCHA</p>
            <h3>Barre Explorer</h3>
            <p>
              Modifiez les noms visibles dans la barre horizontale de la
              Boutique, des Guides et des pages matcha.
            </p>
          </div>
        </div>
        {bilingualInputs(
          "matcha_explore_label",
          "Libellé Explorer",
          "Explorer",
          "Explore",
        )}
        <div className="form-grid">
          {input("matcha_nav_shop_fr", "Boutique · FR", "Boutique")}
          {input("matcha_nav_shop_en", "Boutique · EN", "Shop")}
          {input("matcha_nav_nice_fr", "Nice · FR", "Nice")}
          {input("matcha_nav_nice_en", "Nice · EN", "Nice")}
          {input("matcha_nav_guides_fr", "Guides · FR", "Guides")}
          {input("matcha_nav_guides_en", "Guides · EN", "Guides")}
        </div>
      </section>

      <div className="matcha-cms-pages-v482">
        {MATCHA_INTENT_PAGES.map((page) => {
          const prefix = matchaIntentSettingPrefix(page.tag);
          const visibleKey = `${prefix}_visible`;
          const visible = has(settings, visibleKey)
            ? settings[visibleKey] !== "false"
            : true;

          return (
            <details
              className="matcha-cms-page-v482"
              key={page.tag}
            >
              <summary>
                <div>
                  <span>{page.labelFr}</span>
                  <strong>{value(`${prefix}_title_fr`, page.titleFr)}</strong>
                </div>
                <div className="matcha-cms-page-actions-v482">
                  <span className={visible ? "is-visible" : "is-hidden"}>
                    {visible ? "Visible" : "Masquée"}
                  </span>
                  <a
                    href={page.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Aperçu ↗
                  </a>
                </div>
              </summary>

              <div className="matcha-cms-page-body-v482">
                <label className="cms-toggle-row matcha-cms-visible-v482">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => toggleValue(visibleKey)}
                  />
                  Afficher cette page dans la navigation Matcha et le hub Guides
                </label>
                <p className="matcha-cms-help-v482">
                  Masquer ici retire les liens internes, mais conserve l’URL
                  publique afin de ne pas casser les liens et le référencement.
                </p>

                {bilingualInputs(
                  `${prefix}_label`,
                  "Nom court dans la navigation",
                  page.labelFr,
                  page.labelEn,
                )}
                {bilingualInputs(
                  `${prefix}_title`,
                  "Titre principal H1",
                  page.titleFr,
                  page.titleEn,
                )}
                {bilingualAreas(
                  `${prefix}_short`,
                  "Résumé court",
                  page.shortFr,
                  page.shortEn,
                  3,
                )}
                {bilingualInputs(
                  `${prefix}_eyebrow`,
                  "Petit titre au-dessus du H1",
                  page.eyebrowFr,
                  page.eyebrowEn,
                )}
                {bilingualAreas(
                  `${prefix}_intro`,
                  "Introduction",
                  page.introFr,
                  page.introEn,
                  5,
                )}
                {bilingualAreas(
                  `${prefix}_facts`,
                  "Repères rapides",
                  page.factsFr.join("\n"),
                  page.factsEn.join("\n"),
                  4,
                  "Une ligne = un repère affiché dans le hero.",
                )}

                <div className="matcha-cms-divider-v482" />

                {bilingualInputs(
                  `${prefix}_selection_title`,
                  "Titre de la sélection produits",
                  page.selectionTitleFr,
                  page.selectionTitleEn,
                )}
                {bilingualAreas(
                  `${prefix}_selection_intro`,
                  "Introduction de la sélection",
                  page.selectionIntroFr,
                  page.selectionIntroEn,
                  4,
                )}

                <div className="matcha-cms-divider-v482" />

                {bilingualAreas(
                  `${prefix}_body`,
                  "Contenu éditorial",
                  serializeMatchaIntentBody(page, "fr"),
                  serializeMatchaIntentBody(page, "en"),
                  16,
                  "Syntaxe simple : ## titre de section · ligne vide = nouveau paragraphe · - = puce.",
                )}
                {bilingualAreas(
                  `${prefix}_faq`,
                  "FAQ",
                  serializeMatchaIntentFaq(page, "fr"),
                  serializeMatchaIntentFaq(page, "en"),
                  12,
                  "Chaque question : Q: … puis A: … · laissez une ligne vide entre deux questions.",
                )}

                <div className="matcha-cms-divider-v482" />

                <div className="cms-bilingual">
                  <h4>SEO de la page</h4>
                  <p className="matcha-cms-help-v482">
                    Le site utilise actuellement le français comme métadonnée
                    canonique principale.
                  </p>
                  <div className="form-grid">
                    {input(
                      `${prefix}_meta_title_fr`,
                      "Titre SEO · FR",
                      page.metaTitleFr,
                    )}
                    {textarea(
                      `${prefix}_meta_description_fr`,
                      "Meta description · FR",
                      page.metaDescriptionFr,
                      4,
                    )}
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
