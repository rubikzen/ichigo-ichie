"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBytes, optimizeImageFile } from "@/lib/image-optimize";

type MediaItem = { name: string; path: string; url: string; created_at?: string | null };

type MediaGuide = {
  size: string;
  ratio: string;
  safe: string;
  targetRatio?: number;
  tolerance?: number;
};

const MEDIA_GUIDES: Record<string, MediaGuide> = {
  logo: {
    size: "800 × 800 px",
    ratio: "1:1",
    safe: "Logo centré, gardez environ 15 % de marge autour. PNG/WebP transparent conseillé.",
    targetRatio: 1,
    tolerance: 0.08,
  },
  hero: {
    size: "1600 × 2000 px",
    ratio: "4:5",
    safe: "Placez le sujet principal au centre. Gardez les éléments importants dans les ~60 % centraux : le cadrage s’adapte sur tablette/mobile.",
    targetRatio: 4 / 5,
    tolerance: 0.12,
  },
  story: {
    size: "1600 × 1200 px",
    ratio: "4:3",
    safe: "Gardez le sujet dans les ~70 % centraux et évitez du texte intégré près des bords.",
    targetRatio: 4 / 3,
    tolerance: 0.14,
  },
};

type FieldProps = {
  supabase: SupabaseClient;
  label: string;
  value: string;
  onChange: (value: string) => void;
  slot: string;
  help?: string;
  compact?: boolean;
};

const BUCKET = "site-media";
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function readImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire les dimensions de l’image."));
    };
    image.src = url;
  });
}

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

async function listMedia(supabase: SupabaseClient): Promise<MediaItem[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list("ui", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return (data ?? []).filter((item) => item.name && !item.name.endsWith("/")).map((item) => {
    const path = `ui/${item.name}`;
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { name: item.name, path, url: publicData.publicUrl, created_at: item.created_at };
  });
}

function optimizationForSlot(slot: string) {
  if (slot === "logo") return { maxWidth: 1000, maxHeight: 1000, quality: 0.9 };
  if (slot === "hero") return { maxWidth: 1800, maxHeight: 2250, quality: 0.88 };
  if (slot === "story") return { maxWidth: 1800, maxHeight: 1400, quality: 0.88 };
  return { maxWidth: 2000, maxHeight: 2000, quality: 0.88 };
}

async function uploadMedia(supabase: SupabaseClient, file: File, slot: string) {
  if (!ACCEPTED.includes(file.type)) throw new Error("Format accepté : JPG, PNG, WebP ou AVIF.");
  if (file.size > MAX_BYTES) throw new Error("Image trop lourde : maximum 20 Mo avant optimisation.");
  let optimized = file;
  try {
    optimized = await optimizeImageFile(file, optimizationForSlot(slot));
  } catch {
    // Upload the original file if this browser cannot decode/convert the image.
  }
  const safe = safeFileName(optimized.name || "image.webp");
  const path = `ui/${Date.now()}-${slot}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, optimized, { cacheControl: "31536000", upsert: false, contentType: optimized.type });
  if (error) throw error;
  return {
    url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    originalBytes: file.size,
    uploadedBytes: optimized.size,
  };
}

export function SiteMediaField({ supabase, label, value, onChange, slot, help, compact = false }: FieldProps) {
  const guide = MEDIA_GUIDES[slot];
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    try { setItems(await listMedia(supabase)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger les médias."); }
  }

  useEffect(() => { if (libraryOpen) refresh(); }, [libraryOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      let dimensionNote = "";
      if (guide?.targetRatio) {
        try {
          const dimensions = await readImageSize(file);
          const ratio = dimensions.width / Math.max(1, dimensions.height);
          const delta = Math.abs(ratio - guide.targetRatio) / guide.targetRatio;
          dimensionNote = `${dimensions.width} × ${dimensions.height} px`;
          if (delta > (guide.tolerance ?? 0.12)) {
            dimensionNote += ` · format différent du ${guide.ratio} recommandé : vérifiez le cadrage dans l’aperçu.`;
          } else {
            dimensionNote += " · format adapté ✓";
          }
        } catch {
          // Upload remains available even when the browser cannot decode dimensions.
        }
      }
      const uploaded = await uploadMedia(supabase, file, slot);
      onChange(uploaded.url);
      const optimizationNote = uploaded.uploadedBytes < uploaded.originalBytes
        ? ` · optimisée ${formatBytes(uploaded.originalBytes)} → ${formatBytes(uploaded.uploadedBytes)}`
        : "";
      setMessage(`Image sélectionnée ✓${dimensionNote ? ` — ${dimensionNote}` : ""}${optimizationNote} — cliquez sur Enregistrer le site.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur pendant l’envoi.");
    } finally { setBusy(false); }
  }

  return <div className={`site-media-field ${compact ? "compact" : ""}`} data-media-slot={slot}>
    <div className="site-media-field-head"><strong>{label}</strong>{help && <small>{help}</small>}</div>
    {guide && <div className="image-format-guide" role="note">
      <div><span>Format idéal</span><strong>{guide.size}</strong><em>{guide.ratio}</em></div>
      <p>{guide.safe}</p>
    </div>}
    <div className="site-media-preview">
      {value ? <img src={value} alt="" /> : <div className="site-media-empty">Aucune image</div>}
    </div>
    <div className="site-media-actions">
      <label className="button ghost small media-upload-button">{busy ? "Envoi…" : "Téléverser"}<input hidden disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => handleUpload(event.target.files?.[0])} /></label>
      <button type="button" className="button ghost small" onClick={() => setLibraryOpen((open) => !open)}>{libraryOpen ? "Fermer la bibliothèque" : "Choisir un média"}</button>
      {value && <button type="button" className="button ghost small" onClick={() => onChange("")}>Retirer</button>}
    </div>
    <label className="site-media-url-label">URL / chemin<input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder="https://… ou /image.webp" /></label>
    {message && <small className={message.includes("✓") ? "success" : "error"}>{message}</small>}
    {libraryOpen && <div className="site-media-library-inline">
      {items.length === 0 ? <p>Aucun média UI pour le moment.</p> : <div className="site-media-grid">{items.map((item) => <button type="button" key={item.path} className={value === item.url ? "selected" : ""} onClick={() => { onChange(item.url); setLibraryOpen(false); setMessage("Média sélectionné ✓ — enregistrez le site."); }}><img src={item.url} alt="" /><span>{item.name.replace(/^\d+-[^-]+-/, "")}</span></button>)}</div>}
    </div>}
  </div>;
}

export function SiteMediaLibrary({ supabase }: { supabase: SupabaseClient }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "name">("recent");
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const inputId = useMemo(() => `media-upload-${Math.random().toString(36).slice(2)}`, []);

  async function refresh() {
    try { setItems(await listMedia(supabase)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Impossible de charger les médias."); }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("fr");
    const filtered = query
      ? items.filter((item) => item.name.toLocaleLowerCase("fr").includes(query))
      : items;

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });

      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortMode === "oldest" ? timeA - timeB : timeB - timeA;
    });
  }, [items, searchQuery, sortMode]);

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewItem]);

  async function uploadMany(files?: FileList | null) {
    const selected = files ? Array.from(files) : [];
    if (!selected.length) return;

    setBusy(true);
    setMessage("");
    setUploadProgress({ current: 0, total: selected.length });

    let successCount = 0;
    let optimizedCount = 0;
    let originalBytes = 0;
    let uploadedBytes = 0;
    const errors: string[] = [];

    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      setUploadProgress({ current: index + 1, total: selected.length });

      try {
        const uploaded = await uploadMedia(supabase, file, "library");
        successCount += 1;
        originalBytes += uploaded.originalBytes;
        uploadedBytes += uploaded.uploadedBytes;
        if (uploaded.uploadedBytes < uploaded.originalBytes) optimizedCount += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "Erreur pendant l’envoi."}`);
      }
    }

    try {
      await refresh();
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }

    if (errors.length === 0) {
      const optimizationNote = optimizedCount > 0
        ? ` · ${optimizedCount} optimisée${optimizedCount > 1 ? "s" : ""} · ${formatBytes(originalBytes)} → ${formatBytes(uploadedBytes)}`
        : "";
      setMessage(`${successCount} image${successCount > 1 ? "s" : ""} ajoutée${successCount > 1 ? "s" : ""} ✓${optimizationNote}`);
      return;
    }

    if (successCount > 0) {
      setMessage(`${successCount} image${successCount > 1 ? "s" : ""} ajoutée${successCount > 1 ? "s" : ""} · ${errors.length} erreur${errors.length > 1 ? "s" : ""} — ${errors.slice(0, 2).join(" · ")}`);
      return;
    }

    setMessage(`Échec de l’envoi — ${errors.slice(0, 2).join(" · ")}`);
  }

  async function remove(item: MediaItem) {
    if (!window.confirm("Supprimer définitivement ce média de la bibliothèque ?")) return;
    const { error } = await supabase.storage.from(BUCKET).remove([item.path]);
    if (error) return setMessage(error.message);
    setMessage("Média supprimé ✓");
    await refresh();
  }

  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setMessage("URL copiée ✓"); }
    catch { setMessage("Copie impossible sur ce navigateur."); }
  }

  return <div className="site-media-manager">
    <div className="site-media-manager-head">
      <div><h3>Bibliothèque médias UI</h3><p>Logo, hero, présentation et images générales du site. Les photos produits restent dans leur propre galerie.</p></div>
      <label htmlFor={inputId} className="button primary small">
        {busy && uploadProgress
          ? `Envoi ${uploadProgress.current} / ${uploadProgress.total}…`
          : "+ Ajouter des images"}
      </label>
      <input
        id={inputId}
        hidden
        multiple
        disabled={busy}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => {
          const files = event.target.files;
          void uploadMany(files);
          event.currentTarget.value = "";
        }}
      />
    </div>

    {message && <p className={message.includes("✓") ? "success" : message.includes("ajoutée") ? "media-upload-warning-v383" : "error"}>{message}</p>}

    {items.length > 0 && (
      <div className="media-library-toolbar-v384">
        <label className="media-library-search-v384">
          <span className="sr-only">Rechercher un média</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Rechercher un média…"
            aria-label="Rechercher un média"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} aria-label="Effacer la recherche">×</button>
          )}
        </label>

        <label className="media-library-sort-v384">
          <span>Trier</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "recent" | "oldest" | "name")}>
            <option value="recent">Plus récent</option>
            <option value="oldest">Plus ancien</option>
            <option value="name">Nom</option>
          </select>
        </label>

        <small className="media-library-count-v384" role="status" aria-live="polite">
          {visibleItems.length} / {items.length}
        </small>
      </div>
    )}

    {items.length === 0 ? (
      <div className="site-media-manager-empty">Aucune image UI. Ajoutez votre logo ou une photo hero.</div>
    ) : visibleItems.length === 0 ? (
      <div className="site-media-manager-empty media-library-empty-v384">
        <strong>Aucun média trouvé</strong>
        <span>Essayez un autre nom de fichier.</span>
        <button type="button" className="button ghost small" onClick={() => setSearchQuery("")}>Effacer la recherche</button>
      </div>
    ) : (
      <div className="site-media-manager-grid media-library-grid-v384">
        {visibleItems.map((item) => (
          <article key={item.path}>
            <button
              type="button"
              className="media-library-preview-button-v384"
              onClick={() => setPreviewItem(item)}
              aria-label={`Aperçu de ${item.name}`}
            >
              <img src={item.url} alt="" />
              <span>Aperçu</span>
            </button>
            <div>
              <span title={item.name}>{item.name.replace(/^\d+-[^-]+-/, "")}</span>
              <div>
                <button type="button" onClick={() => setPreviewItem(item)}>Aperçu</button>
                <button type="button" onClick={() => copy(item.url)}>Copier URL</button>
                <button type="button" className="text-danger" onClick={() => remove(item)}>Supprimer</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    )}

    {previewItem && (
      <div
        className="media-preview-modal-v384"
        role="dialog"
        aria-modal="true"
        aria-label={`Aperçu de ${previewItem.name}`}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPreviewItem(null);
        }}
      >
        <div className="media-preview-dialog-v384">
          <div className="media-preview-head-v384">
            <div>
              <strong>{previewItem.name.replace(/^\d+-[^-]+-/, "")}</strong>
              <small>{previewItem.created_at ? new Date(previewItem.created_at).toLocaleString("fr-FR") : "Date inconnue"}</small>
            </div>
            <button type="button" onClick={() => setPreviewItem(null)} aria-label="Fermer l’aperçu">×</button>
          </div>
          <div className="media-preview-stage-v384">
            <img src={previewItem.url} alt="" />
          </div>
          <div className="media-preview-actions-v384">
            <button type="button" className="button ghost small" onClick={() => copy(previewItem.url)}>Copier URL</button>
            <a className="button ghost small" href={previewItem.url} target="_blank" rel="noreferrer">Ouvrir l’image ↗</a>
          </div>
        </div>
      </div>
    )}
  </div>;
}
