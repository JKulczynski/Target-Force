import { describe, expect, it } from "vitest";
import { nazwaNadawcy, trybProbny, wyslijPrzezWinOver } from "@/lib/poczta-winover";

describe("nazwaNadawcy", () => {
  it("składa imię i nazwisko", () => {
    expect(nazwaNadawcy("Anna", "Kowalska")).toBe("Anna Kowalska");
  });
  it("usuwa znaki, które psują nagłówek From", () => {
    expect(nazwaNadawcy('Anna"<x@y.pl>', "Ko\r\nwalska")).toBe("Anna x@y.pl Ko walska");
  });
  it("pusty zestaw daje bezpieczną nazwę", () => {
    expect(nazwaNadawcy(" ", "")).toBe("Mieszkaniec");
  });
});

describe("tryb próbny", () => {
  it("bez klucza Resend nic nie wysyła i mówi o tym", async () => {
    delete process.env.RESEND_API_KEY;
    expect(trybProbny()).toBe(true);
    const w = await wyslijPrzezWinOver({ doKogo: "posel@sejm.pl", temat: "T", tresc: "X", nadawca: "Anna Kowalska" });
    expect(w.ok && w.proba).toBe(true);
  });
});
