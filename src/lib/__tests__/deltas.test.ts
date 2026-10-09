import { describe, it, expect } from "vitest";
import { deltaFor } from "../deltas";

describe("deltaFor", () => {
  it("turns a passive opener into a strong verb", () => {
    const d = deltaFor(
      "3 bullet(s) start with passive openers",
      'Phrases like "Responsible for" describe a job description, not your impact.',
      'Rewrite the opener as a strong verb — e.g. "Responsible for…" becomes "Owned …".',
    );
    expect(d?.before).toBe("Responsible for");
    expect(d?.after).toBe("Owned");
  });

  it("ignores a fabricated metric when the fix mentions a real one", () => {
    const d = deltaFor(
      "Quantify your bullets",
      "Only 2 of 5 bullets have metrics.",
      'Add scale and outcome: "Reduced deploy time 40%".',
    );
    expect(d?.after).toBe("Reduced deploy time 40%");
  });

  it("returns null for something with no transform", () => {
    const d = deltaFor("Add a phone number", "No phone found.", "Add +1 555 123 4567.");
    expect(d).toBeNull();
  });
});