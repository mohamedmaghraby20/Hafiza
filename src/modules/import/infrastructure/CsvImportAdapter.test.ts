import { describe, expect, it } from "vitest";

import { CsvImportAdapter } from "./CsvImportAdapter";

describe("CsvImportAdapter", () => {
  it("maps supported headers, quoted fields, and tags", () => {
    const preview = new CsvImportAdapter().parse(
      "cards.csv",
      'Question,Answer,Tags\n"Which, nerve?","Axillary ""nerve""","anatomy;upper limb"',
    );
    expect(preview.issues).toEqual([]);
    expect(preview.cards[0]).toMatchObject({
      front: "Which, nerve?",
      back: 'Axillary "nerve"',
      tags: ["anatomy", "upper limb"],
    });
  });

  it("reports invalid rows without importing them", () => {
    const preview = new CsvImportAdapter().parse(
      "cards.csv",
      "Front,Back\nValid,Answer\nMissing,",
    );
    expect(preview.cards).toHaveLength(1);
    expect(preview.issues).toEqual([
      { row: 3, message: "Question and answer are required." },
    ]);
  });
});
