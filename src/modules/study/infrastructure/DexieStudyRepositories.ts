import type { EntityId } from "@shared/index";
import { ConflictError } from "@shared/index";
import type { HafizaDatabase } from "@shared/infrastructure/database/HafizaDatabase";

import type {
  ReviewEvent,
  StudySession,
  StudySessionItem,
} from "../domain/Review";
import type {
  ReviewRepository,
  StudySessionRepository,
} from "../domain/StudyRepository";

export class DexieReviewRepository implements ReviewRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async append(review: ReviewEvent): Promise<void> {
    try {
      await this.database.reviews.add(review);
    } catch (error: unknown) {
      throw new ConflictError(`Review '${review.id}' already exists.`, {
        cause: error,
      });
    }
  }

  listByCard(cardId: EntityId): Promise<readonly ReviewEvent[]> {
    return this.database.reviews
      .where("cardId")
      .equals(cardId)
      .sortBy("reviewedAt");
  }
}

export class DexieStudySessionRepository implements StudySessionRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async save(session: StudySession): Promise<void> {
    await this.database.sessions.put(session);
  }

  async findById(id: EntityId): Promise<StudySession | null> {
    return (await this.database.sessions.get(id)) ?? null;
  }

  async saveItem(item: StudySessionItem): Promise<void> {
    await this.database.sessionItems.put(item);
  }

  async findItem(id: EntityId): Promise<StudySessionItem | null> {
    return (await this.database.sessionItems.get(id)) ?? null;
  }

  listItems(sessionId: EntityId): Promise<readonly StudySessionItem[]> {
    return this.database.sessionItems
      .where("[sessionId+position]")
      .between([sessionId, 0], [sessionId, Number.MAX_SAFE_INTEGER])
      .toArray();
  }
}
