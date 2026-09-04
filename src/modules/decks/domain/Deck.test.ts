import { describe, expect, it } from "vitest";

import { testClock, testIds } from "@test/domainFixtures";

import { createDeck } from "./Deck";

describe("Deck", () => {
  it("creates a normalized deck with synchronization metadata", () => {
    const deviceId = testIds.next();
    const result = createDeck(
      { name: "  Spanish  ", description: " Basics ", deviceId },
      { clock: testClock, ids: testIds },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        name: "Spanish",
        description: "Basics",
        revision: 1,
        updatedByDeviceId: deviceId,
        deletedAt: null,
      });
    }
  });

  it("rejects a blank name", () => {
    const result = createDeck(
      { name: " ", deviceId: testIds.next() },
      { clock: testClock, ids: testIds },
    );
    expect(result.ok).toBe(false);
  });
});
