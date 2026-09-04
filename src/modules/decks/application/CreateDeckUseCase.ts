import type {
  Clock,
  IdGenerator,
  Result,
  ValidationError,
} from "@shared/index";

import { createDeck, type CreateDeckInput, type Deck } from "../domain/Deck";
import type { DeckRepository } from "../domain/DeckRepository";

export class CreateDeckUseCase {
  constructor(
    private readonly repository: DeckRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: CreateDeckInput,
  ): Promise<Result<Deck, ValidationError>> {
    const result = createDeck(input, { clock: this.clock, ids: this.ids });
    if (result.ok) await this.repository.save(result.value);
    return result;
  }
}
