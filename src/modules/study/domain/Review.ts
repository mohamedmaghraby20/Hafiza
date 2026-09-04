import type { EntityId } from "@shared/index";
import type { SchedulingState } from "@modules/cards";

export type Rating = "again" | "hard" | "good" | "easy";

export interface ReviewEvent {
  readonly id: EntityId;
  readonly cardId: EntityId;
  readonly sessionId: EntityId;
  readonly rating: Rating;
  readonly reviewedAt: Date;
  readonly durationMs: number;
  readonly previousScheduling: SchedulingState;
  readonly newScheduling: SchedulingState;
  readonly deviceId: EntityId;
}

export interface StudySession {
  readonly id: EntityId;
  readonly deckId: EntityId | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly reviewedCount: number;
}

export interface StudySessionItem {
  readonly id: EntityId;
  readonly sessionId: EntityId;
  readonly cardId: EntityId;
  readonly position: number;
  readonly revealedAt: Date | null;
  readonly reviewedAt: Date | null;
}
