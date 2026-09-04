export interface ProgressDay {
  readonly date: string;
  readonly reviewedCards: number;
  readonly correctReviews: number;
  readonly studyTimeMs: number;
}

export interface ProgressSnapshot {
  readonly reviewedCards: number;
  readonly retentionPercent: number;
  readonly studyTimeMs: number;
  readonly days: readonly ProgressDay[];
}

export interface ProgressRepository {
  getSnapshot(limitDays: number): Promise<ProgressSnapshot>;
}
