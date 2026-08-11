"use client";

import Link from "next/link";
import { Fragment, ReactNode } from "react";
import { useLanguage } from "./LanguageProvider";

export type LegalPageContent = { titleFr: string; titleEn: string; bodyFr: string; bodyEn: string };

function renderLegalContent(value: string): ReactNode[] {
  const lines = (value || "").replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i += 1; continue; }
    if (line.startsWith("### ")) { blocks.push(<h3 key={key++}>{line.slice(4)}</h3>); i += 1; continue; }
    if (line.startsWith("## ") || line.startsWith("# ")) { blocks.push(<h2 key={key++}>{line.replace(/^#{1,2}\s+/, "")}</h2>); i += 1; continue; }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) { items.push(lines[i].trim().slice(2)); i += 1; }
      blocks.push(<ul key={key++}>{items.map((item, idx) => <li key={idx}>{item}</li>)}</ul>); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i += 1; }
      blocks.push(<ol key={key++}>{items.map((item, idx) => <li key={idx}>{item}</li>)}</ol>); continue;
    }
    const paragraph: string[] = [raw.trim()];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (!next || next.startsWith("#") || next.startsWith("- ") || /^\d+\.\s+/.test(next)) break;
      paragraph.push(next); i += 1;
    }
    blocks.push(<p key={key++}>{paragraph.map((part, idx) => <Fragment key={idx}>{idx > 0 && <br />}{part}</Fragment>)}</p>);
  }
  return blocks;
}

export function LegalPage({ content }: { content: LegalPageContent }) {
  const { language } = useLanguage();
  const title = language === "fr" ? content.titleFr : content.titleEn || content.titleFr;
  const body = language === "fr" ? content.bodyFr : content.bodyEn || content.bodyFr;
  return <main className="legal-page-v227 legal-page-v231">
    <section className="legal-card-v227 legal-card-v231">
      <p className="eyebrow">ICHIGO ICHIE</p>
      <h1>{title}</h1>
      <div className="legal-body-v227 legal-rich-body-v231">{renderLegalContent(body)}</div>
      <Link className="button ghost" href="/">{language === "fr" ? "Retour au site" : "Back to site"}</Link>
    </section>
  </main>;
}
