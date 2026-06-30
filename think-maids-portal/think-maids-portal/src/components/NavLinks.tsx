"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <div className="flex">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center py-3 text-sm font-medium border-t-2 transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
