import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Retrait boutique · Ichigo Ichie",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function RetraitLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
