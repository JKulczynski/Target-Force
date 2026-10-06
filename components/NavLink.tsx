"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pozycja nawigacji z zaznaczeniem bieżącej sekcji (Kampanie obejmuje też /kampanie/...). */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const sciezka = usePathname();
  const aktywny =
    href === "/"
      ? sciezka === "/" || sciezka.startsWith("/kampanie")
      : sciezka.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={aktywny ? "page" : undefined}
      className={`relative rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
        aktywny
          ? "bg-white/10 text-white"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
