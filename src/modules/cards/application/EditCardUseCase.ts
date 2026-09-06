import type { Clock, EntityId, Result, ValidationError } from "@shared/index";
import { NotFoundError, trimmedStringSchema, validate } from "@shared/index";

import type { Card, CardContentFormat, CardKind } from "../domain/Card";
import type { CardRepository } from "../domain/CardRepository";

export interface EditCardInput {
  readonly id: EntityId;
  readonly front: string;
  readonly back: string;
  readonly deviceId: EntityId;
  readonly kind?: CardKind;
  readonly frontFormat?: CardContentFormat;
  readonly backFormat?: CardContentFormat;
  readonly assetIds?: readonly EntityId[];
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
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.frontFormat ? { frontFormat: input.frontFormat } : {}),
      ...(input.backFormat ? { backFormat: input.backFormat } : {}),
      ...(input.assetIds ? { assetIds: input.assetIds } : {}),
      updatedAt: this.clock.now(),
      updatedByDeviceId: input.deviceId,
      revision: card.revision + 1,
    };
    await this.cards.save(updated);
    return { ok: true, value: updated };
  }
}
