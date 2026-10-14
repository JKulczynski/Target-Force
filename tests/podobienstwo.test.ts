import { describe, expect, it } from "vitest";
import { ileKopii, podobienstwo, PROG_KOPII } from "@/lib/podobienstwo";

const baza =
  "Dzień dobry, piszę w sprawie oświetlenia przejść przy szkołach w naszej gminie. Rano jest ciemno, a dzieci przechodzą przez jezdnię bez świateł. Proszę o interwencję w zarządzie dróg, żeby przed zimą zamontowano lampy przy trzech przejściach. Wystarczy jedno pismo z biura poselskiego.";

describe("podobieństwo wiadomości mieszkańców", () => {
  it("ta sama treść z innym podpisem to kopia", () => {
    expect(podobienstwo(`${baza}\n\nAnna Kowalska\nKraków`, `${baza}\n\nJan Nowak\nWieliczka`)).toBe(1);
  });
  it("jedno własne zdanie wystarcza, żeby nie była kopią", () => {
    const zeZdaniem = `${baza}\n\nCodziennie rano prowadzę tędy córkę do pierwszej klasy i dwa razy prawie potrącił nas samochód.\n\nAnna Kowalska\nKraków`;
    expect(podobienstwo(zeZdaniem, `${baza}\n\nJan Nowak\nWieliczka`)).toBeLessThan(PROG_KOPII);
  });
  it("inna treść nie jest kopią", () => {
    expect(ileKopii(`${baza}\n\nA\nB`, ["Zupełnie inna wiadomość o budżecie gminy na drogi i chodniki.\n\nX\nY"])).toBe(0);
  });
});
