import { describe, expect, it } from "vitest";

import type { SchedulingState } from "@modules/cards";

import { MvpScheduler } from "./MvpScheduler";

const reviewedAt = new Date("2026-09-04T08:00:00.000Z");
const current: SchedulingState = {
  phase: "review",
  dueAt: reviewedAt,
  intervalDays: 10,
  easeFactor: 2.5,
  repetitions: 3,
  lapses: 1,
};

describe("MvpScheduler", () => {
  const scheduler = new MvpScheduler();

  it.each([
    ["again", "relearning", 0, "2026-09-04T08:10:00.000Z"],
    ["hard", "review", 12, "2026-09-16T08:00:00.000Z"],
    ["good", "review", 25, "2026-09-29T08:00:00.000Z"],
    ["easy", "review", 33, "2026-10-07T08:00:00.000Z"],
  ] as const)(
    "schedules %s deterministically",
    (rating, phase, intervalDays, dueAt) => {
      const result = scheduler.schedule(current, rating, reviewedAt).state;
      expect(result).toMatchObject({ phase, intervalDays });
      expect(result.dueAt.toISOString()).toBe(dueAt);
    },
  );

  it("graduates a new card according to the selected rating", () => {
    const newCard = {
      ...current,
      phase: "new" as const,
      intervalDays: 0,
      repetitions: 0,
    };
    expect(
      scheduler.schedule(newCard, "good", reviewedAt).state.intervalDays,
    ).toBe(1);
    expect(
      scheduler.schedule(newCard, "easy", reviewedAt).state.intervalDays,
    ).toBe(4);
  });
});
