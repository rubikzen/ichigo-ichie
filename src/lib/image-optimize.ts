export type ImageOptimizeOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  skipBelowBytes?: number;
};

type LoadedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close?: () => void;
};

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
        close: () => bitmap.close(),
      };
    } catch {
      // Fallback below for browsers/codecs createImageBitmap cannot decode.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
        close: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible d’optimiser cette image dans le navigateur."));
    };
    image.src = url;
  });
}

function webpName(name: string) {
  const base = (name || "image").replace(/\.[^.]+$/, "");
  return `${base}.webp`;
}

export async function optimizeImageFile(file: File, options: ImageOptimizeOptions): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const quality = options.quality ?? 0.88;
  const loaded = await loadImage(file);
  try {
    const ratio = Math.min(1, options.maxWidth / Math.max(1, loaded.width), options.maxHeight / Math.max(1, loaded.height));
    const targetWidth = Math.max(1, Math.round(loaded.width * ratio));
    const targetHeight = Math.max(1, Math.round(loaded.height * ratio));
    const alreadySmallEnough = ratio >= 1 && file.size <= (options.skipBelowBytes ?? 900_000);
    if (alreadySmallEnough && (file.type === "image/webp" || file.type === "image/avif")) return file;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    loaded.draw(ctx, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob) return file;
    if (blob.size >= file.size && ratio >= 1) return file;
    return new File([blob], webpName(file.name), { type: "image/webp", lastModified: Date.now() });
  } finally {
    loaded.close?.();
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} Mo`;
}
