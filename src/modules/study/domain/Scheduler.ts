import type { SchedulingState } from "@modules/cards";

import type { Rating } from "./Review";

export interface SchedulingResult {
  readonly state: SchedulingState;
}

export interface Scheduler {
  schedule(
    current: SchedulingState,
    rating: Rating,
    reviewedAt: Date,
  ): SchedulingResult;
}
