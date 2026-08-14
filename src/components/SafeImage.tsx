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

export function SafeImage({ src, alt, ...props }: SafeImageProps) {
  if (!canUseNextImageOptimizer(src)) {
    return <Image {...props} src={src} alt={alt} loader={passthroughLoader} unoptimized />;
  }

  return <Image {...props} src={src} alt={alt} />;
}
