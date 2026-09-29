import type { Metadata } from "next";
import Link from "next/link";
import { wyloguj } from "./login/actions";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Target Force",
  description: "Prospecting do decydentów i B2B: listy kontaktów, psychografia, kampanie.",
  robots: { index: false, follow: false },
};

async function statusDostepu(): Promise<{ email: string; wZespole: boolean } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!data?.claims || !email) return null;
  const { data: wZespole } = await supabase.rpc("czy_w_zespole");
  return { email, wZespole: Boolean(wZespole) };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const dostep = await statusDostepu();
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
        {dostep && !dostep.wZespole && (
          <div className="border-b border-amber-200 bg-amber-50">
            <p className="mx-auto max-w-5xl px-6 py-3 text-sm text-amber-900">
              <span className="font-semibold">Nie masz jeszcze dostępu do danych zespołu.</span> Jesteś zalogowany jako{" "}
              {dostep.email}. Poproś Jana o dodanie do zespołu. Do tego czasu nie zobaczysz ani nie zapiszesz kampanii.
            </p>
          </div>
        )}
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
