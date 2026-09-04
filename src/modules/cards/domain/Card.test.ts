import { describe, expect, it } from "vitest";

import { testClock, testIds } from "@test/domainFixtures";

import { createCard } from "./Card";

describe("Basic card", () => {
  it("starts due in the new phase", () => {
    const result = createCard(
      {
        deckId: testIds.next(),
        front: " Capital of Egypt? ",
        back: " Cairo ",
        deviceId: testIds.next(),
      },
      { clock: testClock, ids: testIds },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.front).toBe("Capital of Egypt?");
      expect(result.value.scheduling).toMatchObject({
        phase: "new",
        intervalDays: 0,
      });
      expect(result.value.scheduling.dueAt).toEqual(testClock.now());
    }
  });

  it("requires front and back content", () => {
    const result = createCard(
      {
        deckId: testIds.next(),
        front: "Question",
        back: "",
        deviceId: testIds.next(),
      },
      { clock: testClock, ids: testIds },
    );
    expect(result.ok).toBe(false);
  });
});
