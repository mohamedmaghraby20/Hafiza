import type {
  Clock,
  IdGenerator,
  Result,
  ValidationError,
} from "@shared/index";
import { NotFoundError } from "@shared/index";
import type { DeckRepository } from "@modules/decks";

import { createCard, type Card, type CreateCardInput } from "../domain/Card";
import type { CardRepository } from "../domain/CardRepository";

export class CreateCardUseCase {
  constructor(
    private readonly cards: CardRepository,
    private readonly decks: DeckRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    input: CreateCardInput,
  ): Promise<Result<Card, ValidationError>> {
    if (!(await this.decks.findById(input.deckId))) {
      throw new NotFoundError("Deck", input.deckId);
    }
    const result = createCard(input, { clock: this.clock, ids: this.ids });
    if (result.ok) await this.cards.save(result.value);
    return result;
  }
}
