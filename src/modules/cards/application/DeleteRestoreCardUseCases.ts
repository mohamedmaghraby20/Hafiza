import type { Clock, EntityId } from "@shared/index";

import type { CardRepository } from "../domain/CardRepository";

export interface CardMutationInput {
  readonly id: EntityId;
  readonly deviceId: EntityId;
}

export class DeleteCardUseCase {
  constructor(
    private readonly cards: CardRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: CardMutationInput): Promise<void> {
    return this.cards.softDelete(input.id, this.clock.now(), input.deviceId);
  }
}

export class RestoreCardUseCase {
  constructor(
    private readonly cards: CardRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: CardMutationInput): Promise<void> {
    return this.cards.restore(input.id, this.clock.now(), input.deviceId);
  }
}
