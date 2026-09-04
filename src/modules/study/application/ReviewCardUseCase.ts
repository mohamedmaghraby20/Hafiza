import type { CardRepository } from "@modules/cards";
import type {
  Clock,
  EntityId,
  IdGenerator,
  TransactionRunner,
} from "@shared/index";
import { NotFoundError } from "@shared/index";

import type { Rating, ReviewEvent } from "../domain/Review";
import type { Scheduler } from "../domain/Scheduler";
import type {
  ReviewRepository,
  StudySessionRepository,
} from "../domain/StudyRepository";
import type {
  DailyStudyStatsRepository,
  SyncOperationRepository,
} from "./ReviewSideEffectPorts";

export interface ReviewCardInput {
  readonly cardId: EntityId;
  readonly sessionId: EntityId;
  readonly sessionItemId: EntityId;
  readonly rating: Rating;
  readonly durationMs: number;
  readonly deviceId: EntityId;
}

export class ReviewCardUseCase {
  constructor(
    private readonly cards: CardRepository,
    private readonly reviews: ReviewRepository,
    private readonly sessions: StudySessionRepository,
    private readonly stats: DailyStudyStatsRepository,
    private readonly syncOperations: SyncOperationRepository,
    private readonly scheduler: Scheduler,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: ReviewCardInput): Promise<ReviewEvent> {
    return this.transactions.run(async () => {
      const [card, session, item] = await Promise.all([
        this.cards.findById(input.cardId),
        this.sessions.findById(input.sessionId),
        this.sessions.findItem(input.sessionItemId),
      ]);
      if (!card) throw new NotFoundError("Card", input.cardId);
      if (!session) throw new NotFoundError("Study session", input.sessionId);
      if (!item || item.cardId !== card.id || item.sessionId !== session.id) {
        throw new NotFoundError("Study session item", input.sessionItemId);
      }
      const reviewedAt = this.clock.now();
      const scheduling = this.scheduler.schedule(
        card.scheduling,
        input.rating,
        reviewedAt,
      ).state;
      const review: ReviewEvent = {
        id: this.ids.next(),
        cardId: card.id,
        sessionId: session.id,
        rating: input.rating,
        reviewedAt,
        durationMs: Math.max(0, input.durationMs),
        previousScheduling: card.scheduling,
        newScheduling: scheduling,
        deviceId: input.deviceId,
      };
      const date = reviewedAt.toISOString().slice(0, 10);
      const daily = (await this.stats.findByDate(date)) ?? {
        date,
        reviewedCards: 0,
        correctReviews: 0,
        studyTimeMs: 0,
      };
      await this.reviews.append(review);
      await this.cards.save({
        ...card,
        scheduling,
        updatedAt: reviewedAt,
        updatedByDeviceId: input.deviceId,
        revision: card.revision + 1,
      });
      await this.sessions.save({
        ...session,
        reviewedCount: session.reviewedCount + 1,
      });
      await this.sessions.saveItem({ ...item, reviewedAt });
      await this.stats.save({
        ...daily,
        reviewedCards: daily.reviewedCards + 1,
        correctReviews:
          daily.correctReviews + (input.rating === "again" ? 0 : 1),
        studyTimeMs: daily.studyTimeMs + review.durationMs,
      });
      await Promise.all([
        this.syncOperations.enqueue({
          id: this.ids.next(),
          entityType: "review",
          entityId: review.id,
          operation: "upsert",
          occurredAt: reviewedAt,
          deviceId: input.deviceId,
          status: "pending",
        }),
        this.syncOperations.enqueue({
          id: this.ids.next(),
          entityType: "card",
          entityId: card.id,
          operation: "upsert",
          occurredAt: reviewedAt,
          deviceId: input.deviceId,
          status: "pending",
        }),
      ]);
      return review;
    });
  }
}
