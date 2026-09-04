import type { Card, CardRepository } from "@modules/cards";
import type { EntityId } from "@shared/index";

export class StudyQueue {
  constructor(private readonly cards: CardRepository) {}

  async build(
    now: Date,
    deckId?: EntityId,
    limit = 100,
  ): Promise<readonly Card[]> {
    const cards = await this.cards.listDue(now, deckId, limit);
    return [...cards].sort(
      (left, right) =>
        left.scheduling.dueAt.getTime() - right.scheduling.dueAt.getTime() ||
        left.id.localeCompare(right.id),
    );
  }
}
