/** Bez zależności od danych gmin: bezpieczne do użycia w komponentach przeglądarki. */
/** Identyfikator filmu z YouTube do osadzenia na stronie akcji; null dla innych adresów. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}
