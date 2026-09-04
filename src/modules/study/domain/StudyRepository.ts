import type { EntityId } from "@shared/index";

import type { ReviewEvent, StudySession, StudySessionItem } from "./Review";

export interface ReviewRepository {
  append(review: ReviewEvent): Promise<void>;
  listByCard(cardId: EntityId): Promise<readonly ReviewEvent[]>;
}

export interface StudySessionRepository {
  save(session: StudySession): Promise<void>;
  findById(id: EntityId): Promise<StudySession | null>;
  saveItem(item: StudySessionItem): Promise<void>;
  findItem(id: EntityId): Promise<StudySessionItem | null>;
  listItems(sessionId: EntityId): Promise<readonly StudySessionItem[]>;
}
