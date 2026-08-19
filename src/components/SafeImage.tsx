import Image from "next/image";
import type { ComponentProps } from "react";

type SafeImageProps = ComponentProps<typeof Image>;

function canUseNextImageOptimizer(src: SafeImageProps["src"]) {
  if (typeof src !== "string") return true;
  if (src.startsWith("/")) return true;

  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

const passthroughLoader = ({ src }: { src: string }) => src;

const fallbackImage = "/product-placeholder.svg";

export function SafeImage({ src, alt, onError, ...props }: SafeImageProps) {
  const handleError: NonNullable<SafeImageProps["onError"]> = (event) => {
    onError?.(event);

    const image = event.currentTarget;
    if (image.dataset.safeImageFallback === "true") return;

    image.dataset.safeImageFallback = "true";
    image.srcset = "";
    image.src = fallbackImage;
  };

  if (!canUseNextImageOptimizer(src)) {
    return (
      <Image
        {...props}
        src={src}
        alt={alt}
        loader={passthroughLoader}
        unoptimized
        onError={handleError}
      />
    );
  }

  return <Image {...props} src={src} alt={alt} onError={handleError} />;
}
