import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { youtubeId } from "@/lib/akcja";
import { AkcjaFormularz } from "@/components/AkcjaFormularz";

export const dynamic = "force-dynamic";

/**
 * Publiczna strona akcji (wariant A, 07.10): mieszkaniec czyta o sprawie, podaje imię i gminę,
 * dostaje gotową wiadomość do swojego posła albo urzędu i wysyła ją sam ze swojej poczty.
 * Dane czyta klient serwisowy (strona jest bez logowania), ale tylko pola oznaczone jako publiczne.
 */
type Akcja = {
  tytul: string;
  opis: string;
  nadawca: string;
  administrator: string;
  film: string;
  podpisy: number;
  gotowa: boolean;
};

async function akcja(slug: string): Promise<Akcja | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: k } = await admin
    .from("kampanie")
    .select(
      "id, nadawca, link_film, akcja_wlaczona, akcja_tytul, akcja_opis, akcja_administrator",
    )
    .eq("akcja_slug", slug)
    .maybeSingle();
  if (!k || !k.akcja_wlaczona) return null;
  const [{ count: podpisy }, { count: warianty }, { count: odbiorcy }] =
    await Promise.all([
      admin
        .from("podpisy")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", k.id),
      admin
        .from("warianty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", k.id)
        .eq("rola", "sympatyk")
        .eq("status", "zatwierdzony"),
      admin
        .from("kontakty")
        .select("id", { count: "exact", head: true })
        .eq("kampania_id", k.id)
        .eq("wypisany", false)
        .not("email", "is", null),
    ]);
  return {
    tytul: String(k.akcja_tytul || "Napisz do swojego posła"),
    opis: String(k.akcja_opis ?? ""),
    nadawca: String(k.nadawca ?? ""),
    administrator: String(k.akcja_administrator || k.nadawca || ""),
    film: String(k.link_film ?? ""),
    podpisy: podpisy ?? 0,
    gotowa: (warianty ?? 0) > 0 && (odbiorcy ?? 0) > 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await akcja(slug);
  if (!a) return { title: "Nie ma takiej akcji" };
  return {
    title: a.tytul,
    description: a.opis.split("\n")[0]?.slice(0, 160),
    robots: { index: true, follow: true },
  };
}

export default async function StronaAkcjiPubliczna({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await akcja(slug);
  if (!a) notFound();
  const yt = a.film ? youtubeId(a.film) : null;
  const akapity = a.opis
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <article>
          {a.nadawca && (
            <p className="text-sm font-medium text-brand-700">{a.nadawca}</p>
          )}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {a.tytul}
          </h1>
          {yt ? (
            <div className="mt-6 aspect-video overflow-hidden rounded-xl bg-slate-900">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${yt}`}
                title="Film"
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            a.film && (
              <a
                href={a.film}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-block text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
              >
                Zobacz film albo stronę sprawy
              </a>
            )
          )}
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-slate-700">
            {akapity.length ? (
              akapity.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-slate-500">Opis sprawy pojawi się wkrótce.</p>
            )}
          </div>
          <div className="mt-8 rounded-xl bg-slate-100 p-5 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Jak to działa</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Podajesz imię i gminę. Dobieramy posła z Twojego okręgu albo Twój urząd.</li>
              <li>Dostajesz gotową wiadomość. Możesz ją zmienić po swojemu.</li>
              <li>Klikasz „Otwórz w poczcie” i wysyłasz ze swojej skrzynki. Odpowiedź przyjdzie do Ciebie.</li>
            </ol>
          </div>
        </article>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AkcjaFormularz
            slug={slug}
            razem={a.podpisy}
            gotowa={a.gotowa}
            administrator={a.administrator}
          />
        </aside>
      </div>
    </div>
  );
}
