import type { EntityId } from "@shared/index";

export interface DailyStudyStatsRecord {
  readonly date: string;
  readonly reviewedCards: number;
  readonly correctReviews: number;
  readonly studyTimeMs: number;
}

export interface DailyStudyStatsRepository {
  findByDate(date: string): Promise<DailyStudyStatsRecord | null>;
  save(stats: DailyStudyStatsRecord): Promise<void>;
}

export interface PendingSyncOperation {
  readonly id: EntityId;
  readonly entityType: "deck" | "card" | "tag" | "folder" | "review" | "asset";
  readonly entityId: EntityId;
  readonly operation: "upsert" | "delete";
  readonly occurredAt: Date;
  readonly deviceId: EntityId;
  readonly status: "pending";
}

export interface SyncOperationRepository {
  enqueue(operation: PendingSyncOperation): Promise<void>;
}
