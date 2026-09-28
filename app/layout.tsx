import type { Metadata } from "next";
import Link from "next/link";
import { wyloguj } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Target Force",
  description: "Prospecting do decydentów i B2B: listy kontaktów, psychografia, kampanie.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">Target Force</span>
              <span className="text-xs text-slate-400">MVP</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/" className="transition hover:text-slate-900">
                Kampanie
              </Link>
              <Link href="/zrodla" className="transition hover:text-slate-900">
                Źródła
              </Link>
              <Link href="/ustawienia" className="transition hover:text-slate-900">
                Ustawienia
              </Link>
              <form action={wyloguj}>
                <button className="transition hover:text-slate-900">Wyloguj</button>
              </form>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
