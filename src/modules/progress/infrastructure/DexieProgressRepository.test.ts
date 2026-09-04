import { afterEach, describe, expect, it } from "vitest";

import { HafizaDatabase } from "@shared/infrastructure/database";
import { testIds } from "@test/domainFixtures";

import { DexieProgressRepository } from "./DexieProgressRepository";

describe("DexieProgressRepository", () => {
  const database = new HafizaDatabase(`progress-${testIds.next()}`);

  afterEach(async () => database.delete());

  it("aggregates precomputed daily statistics", async () => {
    await database.dailyStats.bulkPut([
      {
        date: "2026-09-03",
        reviewedCards: 4,
        correctReviews: 3,
        studyTimeMs: 60_000,
      },
      {
        date: "2026-09-04",
        reviewedCards: 6,
        correctReviews: 5,
        studyTimeMs: 120_000,
      },
    ]);
    await expect(
      new DexieProgressRepository(database).getSnapshot(30),
    ).resolves.toMatchObject({
      reviewedCards: 10,
      retentionPercent: 80,
      studyTimeMs: 180_000,
    });
  });
});
