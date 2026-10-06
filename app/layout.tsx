import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { NavLink } from "@/components/NavLink";
import { wyloguj } from "./login/actions";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Target Force",
  description:
    "Kampanie do decydentów: wiadomości, odbiorcy, wysyłka, przypomnienia i raport wpływu.",
  robots: { index: false, follow: false },
};

async function statusDostepu(): Promise<{
  email: string;
  wZespole: boolean;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!data?.claims || !email) return null;
  const { data: wZespole } = await supabase.rpc("czy_w_zespole");
  return { email, wZespole: Boolean(wZespole) };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dostep = await statusDostepu();
  return (
    <html lang="pl" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-20 bg-slate-950 text-white print:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-md bg-brand-600"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <circle cx="8" cy="8" r="5.5" />
                  <circle
                    cx="8"
                    cy="8"
                    r="2"
                    fill="currentColor"
                    stroke="none"
                  />
                  <path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" />
                </svg>
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Target Force
              </span>
            </Link>
            {dostep && (
              <nav className="flex items-center gap-1">
                <NavLink href="/">Kampanie</NavLink>
                <NavLink href="/zrodla">Źródła</NavLink>
                <NavLink href="/ustawienia">Ustawienia</NavLink>
                <span className="mx-2 h-5 w-px bg-white/15" aria-hidden />
                <span className="hidden max-w-48 truncate text-xs text-slate-400 md:inline">
                  {dostep.email}
                </span>
                <form action={wyloguj}>
                  <button className="rounded-md px-3 py-1.5 text-sm text-slate-300 transition-colors duration-150 hover:bg-white/5 hover:text-white">
                    Wyloguj
                  </button>
                </form>
              </nav>
            )}
          </div>
        </header>
        {dostep && !dostep.wZespole && (
          <div className="border-b border-amber-200 bg-amber-50 print:hidden">
            <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-amber-900">
              <span className="font-semibold">
                Nie masz jeszcze dostępu do danych zespołu.
              </span>{" "}
              Jesteś zalogowany jako {dostep.email}. Poproś Jana o dodanie do
              zespołu. Do tego czasu nie zobaczysz ani nie zapiszesz kampanii.
            </p>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
