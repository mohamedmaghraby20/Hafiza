import type { HafizaDatabase } from "@shared/infrastructure/database";

import type {
  ProgressRepository,
  ProgressSnapshot,
} from "../application/ProgressRepository";

export class DexieProgressRepository implements ProgressRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async getSnapshot(limitDays: number): Promise<ProgressSnapshot> {
    const days = (
      await this.database.dailyStats
        .orderBy("date")
        .reverse()
        .limit(limitDays)
        .toArray()
    ).reverse();
    const reviewedCards = days.reduce((sum, day) => sum + day.reviewedCards, 0);
    const correctReviews = days.reduce(
      (sum, day) => sum + day.correctReviews,
      0,
    );
    return {
      reviewedCards,
      retentionPercent:
        reviewedCards === 0
          ? 0
          : Math.round((correctReviews / reviewedCards) * 100),
      studyTimeMs: days.reduce((sum, day) => sum + day.studyTimeMs, 0),
      days,
    };
  }
}
