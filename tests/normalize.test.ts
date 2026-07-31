import { describe, expect, it } from "vitest";
import { createDedupeKey, normalizeForKey, validateCompany } from "../lib/normalize";

const valid = {
  id: "c_000001",
  name: "ООО «Тест»",
  category: "IT-интегратор",
  city: "Москва",
  address: "ул. Мира, д. 1",
  rating: 4.5,
  reviews_count: 10,
  site: "https://example.com",
  phone: "+7 (999) 000-00-00",
};

describe("normalizeForKey", () => {
  it("normalizes whitespace, case and quotes", () => {
    expect(normalizeForKey("  ООО  «ТЕСТ» ")).toBe("ооо тест");
  });
});

describe("createDedupeKey", () => {
  it("returns the same key for formatting-only differences", () => {
    expect(createDedupeKey("ООО «Тест»", "Москва", "ул. Мира, д. 1")).toBe(
      createDedupeKey("ооо тест", " МОСКВА ", "ул.  Мира, д. 1"),
    );
  });
});

describe("validateCompany", () => {
  it("accepts a valid record and trims its values", () => {
    const result = validateCompany({ ...valid, name: "  ООО «Тест»  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("ООО «Тест»");
  });

  it("normalizes a decimal comma with a warning", () => {
    const result = validateCompany({ ...valid, rating: "4,5" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rating).toBe(4.5);
      expect(result.warnings).toHaveLength(1);
    }
  });

  it.each([
    [{ ...valid, rating: "N/A" }, "not numeric"],
    [{ ...valid, rating: 7.2 }, "outside 0..5"],
    [{ ...valid, reviews_count: -10 }, "non-negative integer"],
    [{ ...valid, reviews_count: "45.5" }, "non-negative integer"],
    [{ ...valid, id: "" }, "invalid id"],
  ])("rejects invalid records", (input, message) => {
    const result = validateCompany(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toContain(message);
  });

  it("turns empty optional fields into null", () => {
    const result = validateCompany({ ...valid, site: " ", phone: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.site).toBeNull();
      expect(result.value.phone).toBeNull();
    }
  });

  it.each([
    ["Moscow", "Москва"],
    ["москва", "Москва"],
    ["Санкат-Петербург", "Санкт-Петербург"],
  ])("normalizes known city variant %s", (city, expected) => {
    const result = validateCompany({ ...valid, city });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.city).toBe(expected);
  });

  it("rejects mojibake instead of polluting the database", () => {
    const result = validateCompany({ ...valid, name: "РћРћРћ В«Р—Р°СЂСЏ РўРµС…В»" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("text contains broken character encoding (mojibake)");
  });
});
