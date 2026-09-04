import type { Clock, EntityId, Result, ValidationError } from "@shared/index";
import { NotFoundError, trimmedStringSchema, validate } from "@shared/index";

import type { Card } from "../domain/Card";
import type { CardRepository } from "../domain/CardRepository";

export interface EditCardInput {
  readonly id: EntityId;
  readonly front: string;
  readonly back: string;
  readonly deviceId: EntityId;
}

export class EditCardUseCase {
  constructor(
    private readonly cards: CardRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: EditCardInput): Promise<Result<Card, ValidationError>> {
    const card = await this.cards.findById(input.id);
    if (!card) throw new NotFoundError("Card", input.id);
    const front = validate(
      trimmedStringSchema("Card front", 10_000),
      input.front,
    );
    if (!front.ok) return front;
    const back = validate(trimmedStringSchema("Card back", 10_000), input.back);
    if (!back.ok) return back;
    const updated: Card = {
      ...card,
      front: front.value,
      back: back.value,
      updatedAt: this.clock.now(),
      updatedByDeviceId: input.deviceId,
      revision: card.revision + 1,
    };
    await this.cards.save(updated);
    return { ok: true, value: updated };
  }
}
