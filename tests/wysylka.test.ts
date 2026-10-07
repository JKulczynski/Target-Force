import { describe, expect, it } from "vitest";
import { zLinkamiSledzacymi } from "@/lib/wysylka-serwer";

describe("zLinkamiSledzacymi", () => {
  it("podmienia każdy link na krótki adres z kolejnym numerem", () => {
    const tresc = "Film: https://youtu.be/abc. Strona https://example.com/x?y=1, dziękuję.";
    expect(zLinkamiSledzacymi(tresc, "https://tf.app", "1a2b3c4d")).toBe(
      "Film: https://tf.app/r/1a2b3c4d/1. Strona https://tf.app/r/1a2b3c4d/2, dziękuję.",
    );
  });
  it("nie zjada kropki ani przecinka za linkiem", () => {
    expect(zLinkamiSledzacymi("Zobacz https://a.pl/b.", "https://tf.app", "00000000")).toBe("Zobacz https://tf.app/r/00000000/1.");
  });
  it("zostawia tekst bez linków", () => {
    expect(zLinkamiSledzacymi("bez linku", "https://tf.app", "00000000")).toBe("bez linku");
  });
});
