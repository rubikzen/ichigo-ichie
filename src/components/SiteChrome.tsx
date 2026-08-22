"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MatchaExploreNav } from "@/components/MatchaExploreNav";

export function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPickupStaff =
    pathname === "/retrait" || pathname.startsWith("/retrait/");
  const isStandaloneApp = isAdmin || isPickupStaff;

  if (isStandaloneApp) {
    return <main>{children}</main>;
  }

  return (
    <>
      <SiteHeader />
      <MatchaExploreNav />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}