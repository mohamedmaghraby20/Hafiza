import type { Card } from "@modules/cards";
import type { Deck } from "@modules/decks";

import type { PersistedCard, PersistedDeck } from "./HafizaDatabase";

export function toPersistedDeck(deck: Deck): PersistedDeck {
  return { ...deck, active: deck.deletedAt === null ? 1 : 0 };
}

export function toDeck(deck: PersistedDeck): Deck {
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    folderId: deck.folderId,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    revision: deck.revision,
    updatedByDeviceId: deck.updatedByDeviceId,
    deletedAt: deck.deletedAt,
  };
}

export function toPersistedCard(card: Card): PersistedCard {
  return {
    ...card,
    active: card.deletedAt === null ? 1 : 0,
    dueAt: card.scheduling.dueAt,
    normalizedFront: card.front.toLocaleLowerCase(),
  };
}

export function toCard(card: PersistedCard): Card {
  return {
    id: card.id,
    deckId: card.deckId,
    kind: card.kind,
    front: card.front,
    back: card.back,
    scheduling: card.scheduling,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    revision: card.revision,
    updatedByDeviceId: card.updatedByDeviceId,
    deletedAt: card.deletedAt,
  };
}
