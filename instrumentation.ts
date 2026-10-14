import type { Instrumentation } from "next";

// Błąd serwera na produkcji = mail do administratorów (14.10). Najwyżej jeden mail na trasę co 30 min
// z jednej instancji, żeby awaria nie zasypała skrzynek. Mail nigdy nie psuje obsługi błędu.
const ostatnio = new Map<string, number>();

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL_ENV !== "production") return;
  const klucz = `${request.method} ${context.routePath}`;
  const teraz = Date.now();
  if (teraz - (ostatnio.get(klucz) ?? 0) < 30 * 60 * 1000) return;
  ostatnio.set(klucz, teraz);
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { powiadomAdminow } = await import("@/lib/powiadomienia");
    const admin = createAdminClient();
    if (!admin) return;
    const e = err as Error & { digest?: string };
    await powiadomAdminow(
      admin,
      `WinOver: błąd serwera (${context.routePath})`,
      `Trasa: ${klucz}\nAdres: ${request.path}\nRodzaj: ${context.routeType}\nBłąd: ${e?.message ?? String(err)}\nDigest: ${e?.digest ?? "-"}\nKiedy: ${new Date().toISOString()}\n\nSzczegóły: Vercel -> target-force -> Logs.`,
    );
  } catch (blad) {
    console.error("onRequestError powiadomienie", blad);
  }
};
