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
          this.cards.search({ deckId: deck.id, offset: 0, limit: 1 }),
          this.cards.listDue(now, deck.id, 1_000),
        ]);
        return { deck, cardCount: cards.total, dueCount: due.length };
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
