"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ProductImage } from "@/lib/types";
import { formatBytes, optimizeImageFile } from "@/lib/image-optimize";

type Props = {
  productId: string;
  productName: string;
  fallbackImageUrl?: string | null;
  onMainImageChange?: (url: string) => void;
};

const MAX_IMAGES = 3;
const PRODUCT_TARGET_RATIO = 6 / 5;

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

export function ProductGalleryAdmin({ productId, productName, fallbackImageUrl, onMainImageChange }: Props) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabase || !productId) return setImages([]);
    const { data, error } = await supabase.from("product_images").select("*").eq("product_id", productId).order("sort_order");
    if (error) return setMessage(error.message);
    setImages((data ?? []) as ProductImage[]);
  }

  useEffect(() => { load(); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncOrder(next: ProductImage[]) {
    if (!supabase) return;
    await Promise.all(next.map((image, index) => supabase.from("product_images").update({ sort_order: index }).eq("id", image.id)));
  }

  async function upload(file: File) {
    if (!supabase || !productId) return setMessage("Enregistrez d’abord le produit.");
    if (images.length >= MAX_IMAGES) return setMessage("Maximum 3 photos par produit.");
    setLoading(true); setMessage("");
    let dimensionNote = "";
    try {
      const dimensions = await readImageSize(file);
      const ratio = dimensions.width / Math.max(1, dimensions.height);
      const delta = Math.abs(ratio - PRODUCT_TARGET_RATIO) / PRODUCT_TARGET_RATIO;
      dimensionNote = `${dimensions.width} × ${dimensions.height} px`;
      if (delta > 0.14) dimensionNote += " · ratio différent du 6:5 recommandé, vérifiez le cadrage.";
      else dimensionNote += " · format adapté ✓";
    } catch {
      // Keep upload available even when dimensions cannot be decoded.
    }
    if (file.size > 20 * 1024 * 1024) { setLoading(false); return setMessage("Image trop lourde : maximum 20 Mo avant optimisation."); }
    let optimized = file;
    try {
      optimized = await optimizeImageFile(file, { maxWidth: 1600, maxHeight: 1400, quality: 0.88 });
    } catch {
      // Keep the original file if browser-side optimization is unavailable.
    }
    const safeName = optimized.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `products/${productId}/gallery/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, optimized, { upsert: false, cacheControl: "31536000", contentType: optimized.type });
    if (uploadError) { setLoading(false); return setMessage(uploadError.message); }
    const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(path);
    const url = publicData.publicUrl;
    const { error: insertError } = await supabase.from("product_images").insert({ product_id: productId, url, sort_order: images.length });
    if (insertError) { setLoading(false); return setMessage(insertError.message); }
    if (images.length === 0) {
      await supabase.from("products").update({ image_url: url }).eq("id", productId);
      onMainImageChange?.(url);
    }
    const optimizationNote = optimized.size < file.size ? ` · optimisée ${formatBytes(file.size)} → ${formatBytes(optimized.size)}` : "";
    setMessage(`Photo ajoutée ✓${dimensionNote ? ` — ${dimensionNote}` : ""}${optimizationNote}`);
    setLoading(false);
    await load();
  }

  async function remove(image: ProductImage) {
    if (!supabase || !window.confirm("Supprimer cette photo ?")) return;
    const remaining = images.filter((item) => item.id !== image.id);
    const { error } = await supabase.from("product_images").delete().eq("id", image.id);
    if (error) return setMessage(error.message);
    await syncOrder(remaining);
    if (images[0]?.id === image.id) {
      const nextMain = remaining[0]?.url ?? "";
      await supabase.from("products").update({ image_url: nextMain || null }).eq("id", productId);
      onMainImageChange?.(nextMain);
    }
    setMessage("Photo supprimée ✓");
    await load();
  }

  async function makeMain(image: ProductImage) {
    if (!supabase || images[0]?.id === image.id) return;
    const next = [image, ...images.filter((item) => item.id !== image.id)];
    await syncOrder(next);
    await supabase.from("products").update({ image_url: image.url }).eq("id", productId);
    onMainImageChange?.(image.url);
    setMessage("Photo principale mise à jour ✓");
    await load();
  }

  if (!productId) return <div className="product-gallery-admin empty"><p>Enregistrez d’abord le produit pour ajouter ses photos.</p></div>;

  const slots = Array.from({ length: MAX_IMAGES }, (_, index) => images[index] ?? null);
  return <div className="product-gallery-admin">
    <div className="gallery-admin-head">
      <div><strong>Galerie du produit</strong><p>3 photos communes à tous les formats : Boîte, Sachet, 30 g, 100 g…</p></div>
      <span>{images.length}/{MAX_IMAGES} photos</span>
    </div>
    <div className="image-format-guide product-image-guide" role="note">
      <div><span>Format idéal</span><strong>1200 × 1000 px</strong><em>6:5</em></div>
      <p>Centrez le produit et gardez 10–15 % d’espace libre autour. Évitez les textes ou détails importants collés aux bords.</p>
    </div>
    <div className="gallery-admin-grid">
      {slots.map((image, index) => image ? <article className={`gallery-admin-card ${index === 0 ? "is-main" : ""}`} key={image.id}>
        <div className="gallery-admin-image"><img src={image.url} alt={`${productName} ${index + 1}`} />{index === 0 && <span>Principale</span>}</div>
        <div className="gallery-admin-actions">
          {index !== 0 && <button type="button" onClick={() => makeMain(image)}>Mettre en principale</button>}
          <button type="button" className="text-danger" onClick={() => remove(image)}>Supprimer</button>
        </div>
      </article> : <label className="gallery-upload-slot" key={`empty-${index}`}>
        <span>＋</span><strong>Photo {index + 1}</strong><small>1200 × 1000 px · 6:5</small>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={loading} onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
      </label>)}
    </div>
    {fallbackImageUrl && images.length === 0 && <p className="gallery-legacy-note">L’image actuelle sera automatiquement reprise comme photo principale après la migration.</p>}
    {message && <p className={message.includes("✓") ? "save-message success" : "save-message"}>{message}</p>}
  </div>;
}
