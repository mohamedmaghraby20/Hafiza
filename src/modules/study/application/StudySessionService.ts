import type { Card, CardRepository } from "@modules/cards";
import type {
  Clock,
  EntityId,
  IdGenerator,
  TransactionRunner,
} from "@shared/index";
import { ConflictError, NotFoundError } from "@shared/index";

import type { Rating, StudySession, StudySessionItem } from "../domain/Review";
import type { StudySessionRepository } from "../domain/StudyRepository";
import type { ReviewCardUseCase } from "./ReviewCardUseCase";
import { StudyQueue } from "./StudyQueue";

export interface StartStudySessionInput {
  readonly deckId?: EntityId;
  readonly limit?: number;
}

export interface StudySessionCard {
  readonly session: StudySession;
  readonly item: StudySessionItem;
  readonly card: Card;
}

export class StudySessionService {
  constructor(
    private readonly sessions: StudySessionRepository,
    private readonly cards: CardRepository,
    private readonly queue: StudyQueue,
    private readonly reviewCard: ReviewCardUseCase,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  start(input: StartStudySessionInput = {}): Promise<StudySession> {
    return this.transactions.run(async () => {
      const now = this.clock.now();
      const cards = await this.queue.build(
        now,
        input.deckId,
        input.limit ?? 100,
      );
      const session: StudySession = {
        id: this.ids.next(),
        deckId: input.deckId ?? null,
        startedAt: now,
        completedAt: null,
        reviewedCount: 0,
      };
      await this.sessions.save(session);
      await Promise.all(
        cards.map((card, position) =>
          this.sessions.saveItem({
            id: this.ids.next(),
            sessionId: session.id,
            cardId: card.id,
            position,
            revealedAt: null,
            reviewedAt: null,
          }),
        ),
      );
      return session;
    });
  }

  async next(sessionId: EntityId): Promise<StudySessionCard | null> {
    const session = await this.requireSession(sessionId);
    const items = await this.sessions.listItems(sessionId);
    const item = items.find((candidate) => candidate.reviewedAt === null);
    if (!item) return null;
    const card = await this.cards.findById(item.cardId);
    if (!card) throw new NotFoundError("Card", item.cardId);
    return { session, item, card };
  }

  async reveal(sessionItemId: EntityId): Promise<StudySessionItem> {
    const item = await this.sessions.findItem(sessionItemId);
    if (!item) throw new NotFoundError("Study session item", sessionItemId);
    if (item.reviewedAt)
      throw new ConflictError("A reviewed card cannot be revealed again.");
    const revealed = {
      ...item,
      revealedAt: item.revealedAt ?? this.clock.now(),
    };
    await this.sessions.saveItem(revealed);
    return revealed;
  }

  async rate(input: {
    readonly sessionItemId: EntityId;
    readonly rating: Rating;
    readonly deviceId: EntityId;
  }): Promise<void> {
    const item = await this.sessions.findItem(input.sessionItemId);
    if (!item)
      throw new NotFoundError("Study session item", input.sessionItemId);
    if (!item.revealedAt)
      throw new ConflictError("Reveal the answer before rating the card.");
    await this.reviewCard.execute({
      cardId: item.cardId,
      sessionId: item.sessionId,
      sessionItemId: item.id,
      rating: input.rating,
      durationMs: Math.max(
        0,
        this.clock.now().getTime() - item.revealedAt.getTime(),
      ),
      deviceId: input.deviceId,
    });
  }

  async complete(sessionId: EntityId): Promise<StudySession> {
    const session = await this.requireSession(sessionId);
    const completed = {
      ...session,
      completedAt: session.completedAt ?? this.clock.now(),
    };
    await this.sessions.save(completed);
    return completed;
  }

  private async requireSession(id: EntityId): Promise<StudySession> {
    const session = await this.sessions.findById(id);
    if (!session) throw new NotFoundError("Study session", id);
    return session;
  }
}
