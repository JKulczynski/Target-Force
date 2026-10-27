/** Postawa odbiorcy wobec sprawy (kolumna kontakty.postawa). null = nie wiadomo. */
export type Postawa = "za" | "waha_sie" | "przeciw";

export const POSTAWY: Postawa[] = ["za", "waha_sie", "przeciw"];

export function czyPostawa(v: unknown): v is Postawa {
  return typeof v === "string" && (POSTAWY as string[]).includes(v);
}

/** Liczniki postaw + próg większości (ponad połowa wszystkich odbiorców) i ile głosów "za" brakuje. */
export function liczPostawy(lista: { postawa: Postawa | null }[]) {
  const za = lista.filter((o) => o.postawa === "za").length;
  const wahaSie = lista.filter((o) => o.postawa === "waha_sie").length;
  const przeciw = lista.filter((o) => o.postawa === "przeciw").length;
  const wszyscy = lista.length;
  const prog = Math.floor(wszyscy / 2) + 1;
  return { za, wahaSie, przeciw, nieWiadomo: wszyscy - za - wahaSie - przeciw, wszyscy, prog, brakuje: Math.max(0, prog - za) };
}
