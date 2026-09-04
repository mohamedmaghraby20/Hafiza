import type { SchedulingState } from "@modules/cards";

import type { Rating } from "./Review";
import type { Scheduler, SchedulingResult } from "./Scheduler";

const DAY_MS = 86_400_000;
const MINIMUM_EASE = 1.3;

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

export class MvpScheduler implements Scheduler {
  schedule(
    current: SchedulingState,
    rating: Rating,
    reviewedAt: Date,
  ): SchedulingResult {
    switch (rating) {
      case "again":
        return {
          state: {
            phase: current.phase === "new" ? "learning" : "relearning",
            dueAt: addMilliseconds(reviewedAt, 10 * 60_000),
            intervalDays: 0,
            easeFactor: Math.max(MINIMUM_EASE, current.easeFactor - 0.2),
            repetitions: 0,
            lapses: current.lapses + (current.phase === "review" ? 1 : 0),
          },
        };
      case "hard": {
        const intervalDays = Math.max(
          1,
          Math.round(current.intervalDays * 1.2),
        );
        return {
          state: {
            ...current,
            phase: "review",
            dueAt: addMilliseconds(reviewedAt, intervalDays * DAY_MS),
            intervalDays,
            easeFactor: Math.max(MINIMUM_EASE, current.easeFactor - 0.15),
            repetitions: current.repetitions + 1,
          },
        };
      }
      case "good": {
        const intervalDays =
          current.intervalDays === 0
            ? 1
            : Math.max(
                1,
                Math.round(current.intervalDays * current.easeFactor),
              );
        return {
          state: {
            ...current,
            phase: "review",
            dueAt: addMilliseconds(reviewedAt, intervalDays * DAY_MS),
            intervalDays,
            repetitions: current.repetitions + 1,
          },
        };
      }
      case "easy": {
        const intervalDays =
          current.intervalDays === 0
            ? 4
            : Math.max(
                2,
                Math.round(current.intervalDays * current.easeFactor * 1.3),
              );
        return {
          state: {
            ...current,
            phase: "review",
            dueAt: addMilliseconds(reviewedAt, intervalDays * DAY_MS),
            intervalDays,
            easeFactor: current.easeFactor + 0.15,
            repetitions: current.repetitions + 1,
          },
        };
      }
    }
  }
}
