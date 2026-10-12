/**
 * Poczta WinOver (wysyłka w imieniu mieszkańca, 12.10): maile wychodzą z naszej domeny przez Resend
 * (REST, bez SDK). Nadawca widoczny jako "Imię Nazwisko", odpowiedź trafia do mieszkańca (Reply-To).
 * Z adresu mieszkańca wysłać nie wolno: DMARC jego dostawcy odrzuci maila, a to byłoby podszywanie się.
 *
 * Bez RESEND_API_KEY działa TRYB PRÓBNY: nic nie wychodzi, wynik ma `proba: true`, a interfejs mówi o tym wprost.
 * Zmienne: RESEND_API_KEY, WINOVER_NADAWCA (np. akcja@getwinover.com, domena zweryfikowana w Resend).
 */
export type WynikWysylki = { ok: true; id: string; proba: boolean } | { ok: false; blad: string };

export const trybProbny = () => !process.env.RESEND_API_KEY;

/** Nazwa wyświetlana bez znaków, które psują nagłówek From (cudzysłowy, nawiasy kątowe, nowe linie). */
export function nazwaNadawcy(imie: string, nazwisko: string): string {
  return `${imie} ${nazwisko}`.replace(/["<>\r\n,;]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70) || "Mieszkaniec";
}

export async function wyslijPrzezWinOver(o: {
  doKogo: string;
  temat: string;
  tresc: string;
  nadawca: string;
  odpowiedzDo?: string;
}): Promise<WynikWysylki> {
  const klucz = process.env.RESEND_API_KEY;
  const adres = process.env.WINOVER_NADAWCA ?? "akcja@getwinover.com";
  if (!klucz) {
    console.log(`[poczta-winover PROBA] do=${o.doKogo} od="${o.nadawca}" temat="${o.temat.slice(0, 60)}"`);
    return { ok: true, id: `proba-${Date.now()}`, proba: true };
  }
  try {
    const odp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${klucz}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${o.nadawca} <${adres}>`,
        to: [o.doKogo],
        ...(o.odpowiedzDo ? { reply_to: o.odpowiedzDo } : {}),
        subject: o.temat.slice(0, 200),
        text: o.tresc,
      }),
    });
    const d = (await odp.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!odp.ok || !d.id) return { ok: false, blad: d.message ?? `HTTP ${odp.status}` };
    return { ok: true, id: d.id, proba: false };
  } catch (e) {
    return { ok: false, blad: e instanceof Error ? e.message : "nieznany błąd" };
  }
}

type Mail = { doKogo: string; temat: string; tresc: string; nadawca: string; odpowiedzDo?: string };

/** Wiele maili naraz (mail do sympatyków): endpoint wsadowy Resend, po 100 w paczce. W trybie próbnym tylko liczy. */
export async function wyslijWiele(maile: Mail[]): Promise<{ wyslane: number; bledy: number }> {
  const klucz = process.env.RESEND_API_KEY;
  const adres = process.env.WINOVER_NADAWCA ?? "akcja@getwinover.com";
  if (!klucz) {
    console.log(`[poczta-winover PROBA] wsadowo ${maile.length} maili`);
    return { wyslane: maile.length, bledy: 0 };
  }
  let wyslane = 0;
  let bledy = 0;
  for (let i = 0; i < maile.length; i += 100) {
    const paczka = maile.slice(i, i + 100);
    try {
      const odp = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${klucz}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          paczka.map((m) => ({
            from: `${m.nadawca} <${adres}>`,
            to: [m.doKogo],
            ...(m.odpowiedzDo ? { reply_to: m.odpowiedzDo } : {}),
            subject: m.temat.slice(0, 200),
            text: m.tresc,
          })),
        ),
      });
      if (odp.ok) wyslane += paczka.length;
      else bledy += paczka.length;
    } catch {
      bledy += paczka.length;
    }
  }
  return { wyslane, bledy };
}

/** Ile wiadomości mieszkańców może dostać jeden odbiorca w ciągu doby; nadmiar czeka w kolejce na automat. */
export const LIMIT_NA_ODBIORCE_DZIENNIE = 40;
/** Ile maili z potwierdzeniem może dostać jeden adres w ciągu doby (ochrona przed zasypaniem cudzej skrzynki). */
export const LIMIT_POTWIERDZEN_NA_ADRES = 5;
