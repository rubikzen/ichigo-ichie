import Link from "next/link";

export type SeoBreadcrumbItem = {
  href?: string;
  label: string;
};

export function SeoBreadcrumbs({
  items,
  className = "",
  ariaLabel = "Breadcrumb",
}: {
  items: SeoBreadcrumbItem[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <nav
      className={`seo-breadcrumbs-v472 ${className}`.trim()}
      aria-label={ariaLabel}
      data-seo-breadcrumbs-v472
    >
      <ol>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li key={`${item.href || "current"}:${item.label}`}>
              {item.href && !current ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={current ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
