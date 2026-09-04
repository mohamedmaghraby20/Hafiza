import type { Card, CardRepository, CardSearchQuery } from "@modules/cards";
import type { Deck, DeckRepository } from "@modules/decks";
import type { EntityId, Page, PageRequest } from "@shared/index";

export interface DeckSummary {
  readonly deck: Deck;
  readonly cardCount: number;
  readonly dueCount: number;
}

export class LibraryQueries {
  constructor(
    private readonly decks: DeckRepository,
    private readonly cards: CardRepository,
  ) {}

  async listDecks(page: PageRequest, now: Date): Promise<Page<DeckSummary>> {
    const deckPage = await this.decks.list(page);
    const items = await Promise.all(
      deckPage.items.map(async (deck) => {
        const [cards, due] = await Promise.all([
          this.cards.countByDeck(deck.id),
          this.cards.countDue(now, deck.id),
        ]);
        return { deck, cardCount: cards, dueCount: due };
      }),
    );
    return { items, total: deckPage.total };
  }

  listCards(deckId: EntityId, page: PageRequest): Promise<Page<Card>> {
    return this.cards.listByDeck(deckId, page);
  }

  searchCards(query: CardSearchQuery): Promise<Page<Card>> {
    return this.cards.search(query);
  }
}
